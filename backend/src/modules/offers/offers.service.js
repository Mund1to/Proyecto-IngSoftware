// Reglas de negocio de ofertas. No conoce Express ni SQL: recibe datos, aplica
// las reglas y lanza HttpError cuando algo no se cumple.
import { withTransaction } from '../../core/database/database.js';
import { badRequest, conflict, forbidden, notFound } from '../../core/http/errors.js';
import { getBodyValue } from '../../core/http/payload.js';
import { getOrganizationProfileId } from '../profile/profile.repository.js';
import { addOfferCancelledEvents } from '../applications/applications.repository.js';
import { notifyCandidatesOfCancellation } from '../applications/applications.mail.js';
import { EXTERNAL_OFFER_TYPES, MAX_CANCEL_REASON_LENGTH } from './offers.domain.js';
import * as offersRepository from './offers.repository.js';
import { offerAffinity, scoreOffer } from './offers.scoring.js';
import { REQUIRED_TEXT_FIELDS, applyTypeRules, parseOfferPayload, publicationErrors, validateOfferState } from './offers.validation.js';

async function requireOrganization(userId, message) {
  const organizationId = await getOrganizationProfileId(userId);
  if (!organizationId) throw forbidden(message);
  return organizationId;
}

function parseOrThrow(payload) {
  const parsed = parseOfferPayload(payload ?? {});
  if (parsed.error) throw badRequest(parsed.error);
  return parsed.values;
}

// Reglas sobre la oferta resultante: rango salarial y fechas siempre; además, una
// oferta publicada debe estar completa (un borrador puede guardarse a medias).
// `onlyFields` limita la revisión a los campos editados: así una oferta publicada
// antes de estas reglas puede, por ejemplo, ampliar su fecha de cierre.
function assertValidState(offer, { onlyFields = null } = {}) {
  const stateError = validateOfferState(offer);
  if (stateError) throw badRequest(stateError);

  if (offer.estado === 'PUBLICADA') {
    const all = publicationErrors(offer);
    const errors = onlyFields ? Object.fromEntries(Object.entries(all).filter(([field]) => onlyFields.includes(field))) : all;
    const fields = Object.keys(errors);
    if (fields.length > 0) {
      const message = fields.length === 1 ? errors[fields[0]] : `Completa la oferta antes de publicarla: ${Object.values(errors).join(' ')}`;
      throw badRequest(message, errors);
    }
  }
}

export function listPublishedOffers() {
  return offersRepository.listPublished();
}

export async function getPublishedOffer(id) {
  const offer = await offersRepository.findPublishedById(id);
  if (!offer) throw notFound('Oferta no encontrada.');
  return offer;
}

export async function listRecommendedOffers(userId) {
  const profile = await offersRepository.findRecommendationProfile(userId);
  if (!profile) {
    throw forbidden('Debes contar con un perfil de candidato o estudiante para recibir recomendaciones.');
  }

  const offers = await offersRepository.listPublished();

  // Las organizaciones verificadas reciben un pequeño empujón de confianza.
  // El candidato externo no recibe prácticas: son solo para estudiantes.
  const visible = profile.tipo === 'CANDIDATO_EXTERNO'
    ? offers.filter((offer) => EXTERNAL_OFFER_TYPES.includes(String(offer.tipo)))
    : offers;

  return visible
    .map((offer) => ({
      ...offer,
      recommendationScore: scoreOffer(offer, profile) + (offer.verificada ? 5 : 0),
      affinity: offerAffinity(offer, profile),
    }))
    .sort((a, b) => b.recommendationScore - a.recommendationScore);
}

export async function listOrganizationOffers(userId) {
  const organizationId = await requireOrganization(userId, 'Solo una organización puede consultar sus ofertas.');
  return offersRepository.listByOrganization(organizationId);
}

export async function createOffer(userId, payload) {
  const organizationId = await requireOrganization(userId, 'Solo una organización puede publicar ofertas.');
  const values = parseOrThrow(payload);

  const offer = applyTypeRules({
    titulo: null,
    descripcion: null,
    tipo: null,
    ubicacion: null,
    modalidad: null,
    requisitos: [],
    duracion: null,
    horario: null,
    contacto_email: null,
    remuneracion: null,
    remuneracion_maxima: null,
    fecha_publicacion: null,
    fecha_cierre: null,
    programas: [],
    semestre_minimo: null,
    habilidades: [],
    experiencia: null,
    idiomas: [],
    jornada: null,
    beneficios: [],
    vacantes: 1,
    ...values,
    estado: values.estado ?? 'BORRADOR',
    area: values.area ?? 'General',
  });

  if (!offer.titulo || !offer.descripcion || !offer.tipo) {
    throw badRequest('Se requieren título, descripción y tipo de oferta.');
  }

  // Una oferta publicada siempre registra cuándo se publicó.
  if (offer.estado === 'PUBLICADA' && !offer.fecha_publicacion) {
    offer.fecha_publicacion = new Date().toISOString();
  }

  assertValidState(offer);
  return offersRepository.insert(organizationId, offer);
}

// Actualización parcial: solo cambian los campos enviados. Los campos opcionales
// pueden vaciarse enviando null o una cadena vacía; los obligatorios no.
export async function updateOffer(userId, id, payload) {
  const organizationId = await requireOrganization(userId, 'Solo una organización puede actualizar ofertas.');
  const changes = parseOrThrow(payload);

  if (REQUIRED_TEXT_FIELDS.some((column) => column in changes && !changes[column])) {
    throw badRequest('Título, descripción, tipo, estado y área no pueden quedar vacíos.');
  }

  const current = await offersRepository.findOwned(id, organizationId);
  if (!current) throw notFound('No se encontró una oferta propia para actualizar.');

  // La papelera tiene su propio flujo: cancelar guarda fecha, motivo y avisa a
  // los candidatos; una oferta cancelada se restaura antes de editarla.
  if (current.estado === 'CANCELADA') throw conflict('La oferta está en Canceladas. Restáurala para editarla.');
  if (changes.estado === 'CANCELADA') throw badRequest('Para cancelar una oferta usa la opción Cancelar oferta.');

  if (changes.estado === 'PUBLICADA' && !current.fecha_publicacion && !changes.fecha_publicacion) {
    changes.fecha_publicacion = new Date().toISOString();
  }

  // Cambiar el tipo puede dejar campos que ya no aplican (salario en formación...).
  const merged = applyTypeRules({ ...current, ...changes });
  for (const column of ['remuneracion', 'remuneracion_maxima', 'experiencia', 'semestre_minimo']) {
    if (merged[column] !== ({ ...current, ...changes })[column]) changes[column] = merged[column];
  }

  // Al publicar se revisa la oferta completa; al editar una ya publicada, lo editado.
  // Cambiar el tipo cambia las reglas de salario y experiencia.
  const publishing = current.estado !== 'PUBLICADA' && merged.estado === 'PUBLICADA';
  const edited = [...Object.keys(changes), ...('tipo' in changes ? ['remuneracion', 'experiencia'] : [])];
  assertValidState(merged, { onlyFields: publishing ? null : edited });

  if (Object.keys(changes).length === 0) return current;
  return offersRepository.updateOwned(id, organizationId, changes);
}

// Papelera de ofertas. Cancelar no borra: la oferta pasa a "Canceladas" con la
// fecha y el motivo, sale del catálogo y conserva sus postulaciones. Los
// candidatos con postulaciones abiertas reciben un evento en su historial y un correo.
export async function cancelOffer(userId, id, payload = {}) {
  const organizationId = await requireOrganization(userId, 'Solo una organización puede eliminar ofertas.');
  const raw = getBodyValue(payload, ['motivo', 'reason']);
  const reason = raw === undefined ? null : String(raw).trim() || null;
  if (reason && reason.length > MAX_CANCEL_REASON_LENGTH) {
    throw badRequest(`El motivo admite como máximo ${MAX_CANCEL_REASON_LENGTH} caracteres.`);
  }

  const current = await offersRepository.findOwned(id, organizationId);
  if (!current) throw notFound('No se encontró una oferta propia para cancelar.');
  if (current.estado === 'CANCELADA') throw conflict('La oferta ya está en Canceladas.');

  const { offer, notified } = await withTransaction(async (db) => {
    const cancelled = await offersRepository.cancelOwned(db, id, organizationId, reason);
    const events = await addOfferCancelledEvents(db, id, userId, reason);
    return { offer: cancelled, notified: events.length };
  });

  if (notified > 0) {
    await notifyCandidatesOfCancellation(id, reason)
      .catch((error) => console.error('offer notifyCandidatesOfCancellation error:', error));
  }
  return { offer, notified };
}

// Saca la oferta de la papelera como borrador: la empresa la revisa (la fecha de
// cierre pudo vencer) y la publica de nuevo desde el formulario.
export async function restoreOffer(userId, id) {
  const organizationId = await requireOrganization(userId, 'Solo una organización puede restaurar ofertas.');
  const current = await offersRepository.findOwned(id, organizationId);
  if (!current) throw notFound('No se encontró una oferta propia para restaurar.');
  if (current.estado !== 'CANCELADA') throw conflict('Solo se pueden restaurar ofertas canceladas.');
  return offersRepository.restoreOwned(id, organizationId);
}

// Borrado definitivo desde la papelera. Una oferta con postulaciones no se
// borra: el historial de esos candidatos (y sus hojas de vida enviadas) depende de ella.
export async function deleteOfferPermanently(userId, id) {
  const organizationId = await requireOrganization(userId, 'Solo una organización puede eliminar ofertas.');
  const current = await offersRepository.findOwned(id, organizationId);
  if (!current) throw notFound('No se encontró una oferta propia para eliminar.');
  if (current.estado !== 'CANCELADA') throw conflict('Primero cancela la oferta; solo se eliminan definitivamente las ofertas de la papelera.');

  const applications = await offersRepository.countApplications(id);
  if (applications > 0) {
    throw conflict(`La oferta tiene ${applications === 1 ? '1 postulación' : `${applications} postulaciones`}: se conserva en Canceladas para no borrar el historial de los candidatos.`);
  }

  await offersRepository.deleteOwned(id, organizationId);
  return Number(id);
}
