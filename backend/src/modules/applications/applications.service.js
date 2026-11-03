// Reglas de negocio de postulaciones y del proceso de selección. No conoce
// Express ni SQL. Las reglas puras (etapas permitidas, datos de la entrevista)
// están en applications.domain.js.
import { withTransaction } from '../../core/database/database.js';
import { badRequest, conflict, forbidden, notFound } from '../../core/http/errors.js';
import { getBodyValue } from '../../core/http/payload.js';
import { EXTERNAL_OFFER_TYPES } from '../offers/offers.domain.js';
import {
  COMPANY_STATUSES,
  MAX_COVER_LETTER_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_NOTE_LENGTH,
  MIN_NOTE_LENGTH,
  RESOLVED_STATUSES,
  parseInterview,
  transitionError,
} from './applications.domain.js';
import { notifyCandidateOfStage } from './applications.mail.js';
import { getOrganizationProfileId } from '../profile/profile.repository.js';
import { parseUploadedFile } from '../profile/profileDetails.service.js';
import * as applicationsRepository from './applications.repository.js';

const DUPLICATE_MESSAGE = 'Ya existe una postulación para esta oferta.';

// Texto libre opcional: sin espacios sobrantes, null si queda vacío y con límite.
function optionalText(payload, keys, maxLength, label) {
  const raw = getBodyValue(payload, keys);
  const text = raw === undefined ? '' : String(raw).trim();
  if (text.length > maxLength) throw badRequest(`${label} admite como máximo ${maxLength} caracteres.`);
  return text || null;
}

const parseCoverLetter = (payload) => optionalText(payload, ['cartaPresentacion', 'carta_presentacion', 'message'], MAX_COVER_LETTER_LENGTH, 'El mensaje para la empresa');

// Por defecto se adjunta la hoja de vida del perfil; con cvPerfil: false el
// candidato la sube después, solo para esta postulación.
function wantsProfileCv(payload) {
  const value = getBodyValue(payload, ['cvPerfil', 'usarCvPerfil']);
  return !(value === false || value === 'false');
}

async function requireCandidate(userId, message) {
  const candidateProfileId = await applicationsRepository.findCandidateProfileId(userId);
  if (!candidateProfileId) throw forbidden(message);
  return candidateProfileId;
}

// Postulación de una oferta propia de la organización del usuario.
async function requireOwnedApplication(userId, id, message, db, options) {
  const application = await applicationsRepository.findWithOfferOwner(id, db, options);
  if (!application) throw notFound('Postulación no encontrada.');
  if (String(await getOrganizationProfileId(userId, db)) !== String(application.organizacion_id)) {
    throw forbidden(message);
  }
  return application;
}

// Un aviso que falla no debe deshacer un cambio ya confirmado.
function notifyStage(applicationId, data) {
  return notifyCandidateOfStage(applicationId, data)
    .catch((error) => console.error('application notifyCandidate error:', error));
}

export async function listMyApplications(userId) {
  const candidateProfileId = await requireCandidate(userId, 'Solo un candidato o estudiante puede ver sus postulaciones.');
  return applicationsRepository.listByCandidate(candidateProfileId);
}

export async function listApplicationsForOffer(userId, offerId) {
  const ownerProfileId = await applicationsRepository.findOfferOwnerId(offerId);
  if (!ownerProfileId) throw notFound('Oferta no encontrada.');

  if (await getOrganizationProfileId(userId) !== ownerProfileId) {
    throw forbidden('No tienes permisos para ver estas postulaciones.');
  }

  return applicationsRepository.listByOffer(offerId);
}

export async function applyToOffer(userId, offerId, payload = {}) {
  const candidateProfileId = await requireCandidate(userId, 'Debes contar con un perfil de candidato o estudiante para postularte.');

  const offer = await applicationsRepository.findOfferForApplication(offerId, candidateProfileId);
  if (!offer) throw notFound('Oferta no encontrada.');

  if (offer.estado !== 'PUBLICADA') {
    throw badRequest('La oferta no está publicada para recibir postulaciones.');
  }

  // Las prácticas son solo para estudiantes de la universidad.
  if (offer.perfil_tipo === 'CANDIDATO_EXTERNO' && !EXTERNAL_OFFER_TYPES.includes(offer.tipo)) {
    throw forbidden('Las prácticas son solo para estudiantes de la universidad.');
  }

  if (offer.fecha_cierre && new Date(offer.fecha_cierre) < new Date()) {
    throw badRequest('El plazo para postularse a esta oferta ya terminó.');
  }

  if (await applicationsRepository.existsForCandidate(offerId, candidateProfileId)) {
    throw conflict(DUPLICATE_MESSAGE);
  }

  const coverLetter = parseCoverLetter(payload);
  const attachProfileCv = wantsProfileCv(payload);

  try {
    // La postulación, la copia de la hoja de vida y el primer evento del historial
    // se guardan juntos: si algo falla, no queda una postulación a medias.
    return await withTransaction(async (db) => {
      const application = await applicationsRepository.insert(db, offerId, candidateProfileId, coverLetter);
      const cv = attachProfileCv ? await applicationsRepository.copyProfileCv(db, application.id, candidateProfileId) : null;
      await applicationsRepository.insertEvent(db, {
        applicationId: application.id,
        authorId: userId,
        tipo: 'POSTULACION',
        nextStatus: 'ENVIADA',
        message: coverLetter,
      });
      return { ...application, cv };
    });
  } catch (error) {
    // Dos envíos simultáneos pueden superar la comprobación previa; la restricción
    // única de la tabla lo detecta.
    if (error?.code === '23505') throw conflict(DUPLICATE_MESSAGE);
    throw error;
  }
}

// La organización mueve la postulación a otra etapa. Cada cambio queda en el
// historial con el mensaje para el candidato; citar a entrevista exige fecha,
// modalidad y lugar o enlace, y repetir PRESELECCIONADA reprograma la entrevista.
export async function updateApplicationStatus(userId, id, payload = {}) {
  const nextStatus = String(getBodyValue(payload, ['estado', 'status']) ?? '').trim().toUpperCase();
  if (!COMPANY_STATUSES.includes(nextStatus)) {
    throw badRequest('El estado de la postulación no es válido.');
  }

  const message = optionalText(payload, ['mensaje', 'message'], MAX_MESSAGE_LENGTH, 'El mensaje para el candidato');

  let interview;
  if (nextStatus === 'PRESELECCIONADA') {
    const parsed = parseInterview(getBodyValue(payload, ['entrevista', 'interview']));
    if (parsed.error) throw badRequest(parsed.error);
    interview = parsed.value;
  }

  const result = await withTransaction(async (db) => {
    const application = await requireOwnedApplication(userId, id, 'No tienes permisos para cambiar el estado de esta postulación.', db, { forUpdate: true });

    // Una oferta en la papelera conserva su historial, pero el proceso se detiene.
    if (application.oferta_estado === 'CANCELADA') {
      throw conflict('La oferta está cancelada. Restáurala para continuar con el proceso.');
    }

    const blocked = transitionError(application.estado, nextStatus, application.oferta_tipo);
    if (blocked) throw conflict(blocked);

    const rescheduled = application.estado === 'PRESELECCIONADA' && nextStatus === 'PRESELECCIONADA';
    // Volver a revisión borra la entrevista vigente; decidir tras ella la conserva.
    const interviewChange = nextStatus === 'PRESELECCIONADA' ? interview : nextStatus === 'EN_REVISION' ? null : undefined;
    const updated = await applicationsRepository.updateStatus(db, id, nextStatus, interviewChange);
    const event = await applicationsRepository.insertEvent(db, {
      applicationId: id,
      authorId: userId,
      tipo: nextStatus === 'PRESELECCIONADA' ? 'ENTREVISTA' : 'ESTADO',
      previousStatus: application.estado,
      nextStatus,
      message,
      interview: interview ?? null,
    });
    return { updated, event, rescheduled };
  });

  await notifyStage(id, { status: nextStatus, message, interview, rescheduled: result.rescheduled });
  return { ...result.updated, evento: result.event };
}

// Nota interna de la organización sobre el candidato. El candidato no la ve.
export async function addApplicationNote(userId, id, payload = {}) {
  const text = optionalText(payload, ['texto', 'nota', 'text'], MAX_NOTE_LENGTH, 'La nota');
  if (!text || text.length < MIN_NOTE_LENGTH) throw badRequest('Escribe la nota antes de guardarla.');

  await requireOwnedApplication(userId, id, 'No tienes permisos para anotar en esta postulación.');
  return withTransaction((db) => applicationsRepository.insertEvent(db, {
    applicationId: id,
    authorId: userId,
    tipo: 'NOTA',
    message: text,
    privado: true,
  }));
}

// Calificación interna de 1 a 5 estrellas; null la quita.
export async function rateApplication(userId, id, payload = {}) {
  const raw = getBodyValue(payload, ['calificacion', 'rating']);
  const rating = raw === undefined || raw === '' ? null : Number(raw);
  if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
    throw badRequest('La calificación debe ser un número entero de 1 a 5.');
  }

  await requireOwnedApplication(userId, id, 'No tienes permisos para calificar esta postulación.');
  return applicationsRepository.setRating(id, rating);
}

// El candidato puede retirar su postulación mientras no esté resuelta.
export async function withdrawApplication(userId, id, payload = {}) {
  const candidateProfileId = await requireCandidate(userId, 'Solo un candidato o estudiante puede retirar sus postulaciones.');
  const reason = optionalText(payload, ['motivo', 'reason'], MAX_MESSAGE_LENGTH, 'El motivo');

  return withTransaction(async (db) => {
    const application = await applicationsRepository.findOwnedByCandidate(id, candidateProfileId, db, { forUpdate: true });
    if (!application) throw notFound('Postulación no encontrada.');

    if (RESOLVED_STATUSES.includes(application.estado)) {
      throw conflict('La postulación ya fue resuelta y no puede retirarse.');
    }

    const updated = await applicationsRepository.updateStatus(db, id, 'RETIRADA');
    await applicationsRepository.insertEvent(db, {
      applicationId: id,
      authorId: userId,
      tipo: 'RETIRO',
      previousStatus: application.estado,
      nextStatus: 'RETIRADA',
      message: reason,
    });
    return updated;
  });
}

// Hoja de vida enviada con la postulación. La ven la organización dueña de la
// oferta y el propio candidato; es la copia guardada al postularse, no la del perfil.
export async function getApplicationCv(userId, id) {
  const row = await applicationsRepository.findApplicationCv(id);
  if (!row) throw notFound('Postulación no encontrada.');

  const [organizationProfileId, candidateProfileId] = await Promise.all([
    getOrganizationProfileId(userId),
    applicationsRepository.findCandidateProfileId(userId),
  ]);
  const isOwnerCompany = organizationProfileId !== null && String(organizationProfileId) === String(row.organizacion_id);
  const isCandidate = candidateProfileId !== null && String(candidateProfileId) === String(row.candidato_id);
  if (!isOwnerCompany && !isCandidate) {
    throw forbidden('No tienes permisos para ver esta hoja de vida.');
  }

  if (!row.contenido) throw notFound('Esta postulación se envió sin hoja de vida.');
  return row;
}

// El candidato cambia la hoja de vida de UNA postulación (no la de su perfil ni
// la de otras postulaciones). Solo mientras la empresa no haya empezado a revisarla.
export async function replaceApplicationCv(userId, id, input) {
  const candidateProfileId = await requireCandidate(userId, 'Solo el candidato puede cambiar la hoja de vida de su postulación.');
  const { nombre, mime, contenido } = parseUploadedFile('cv', input);

  return withTransaction(async (db) => {
    const application = await applicationsRepository.findOwnedByCandidate(id, candidateProfileId, db, { forUpdate: true });
    if (!application) throw notFound('Postulación no encontrada.');

    if (application.estado !== 'ENVIADA') {
      throw conflict('La empresa ya empezó a revisar esta postulación; la hoja de vida enviada ya no se puede cambiar.');
    }

    const cv = await applicationsRepository.upsertApplicationCv(db, id, { nombre, mime, contenido });
    await applicationsRepository.insertEvent(db, { applicationId: id, authorId: userId, tipo: 'CV', message: nombre });
    return cv;
  });
}
