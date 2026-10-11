// Reglas de negocio de ofertas. No conoce Express ni SQL: recibe datos, aplica
// las reglas y lanza HttpError cuando algo no se cumple.
import { badRequest, forbidden, notFound } from '../../core/http/errors.js';
import { getOrganizationProfileId } from '../profile/profile.repository.js';
import { EXTERNAL_OFFER_TYPES } from './offers.domain.js';
import * as offersRepository from './offers.repository.js';
import { offerAffinity, scoreOffer } from './offers.scoring.js';
import { REQUIRED_TEXT_FIELDS, parseOfferPayload, validateOfferState } from './offers.validation.js';

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

function assertValidState(offer) {
  const stateError = validateOfferState(offer);
  if (stateError) throw badRequest(stateError);
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

  const offer = {
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
    ...values,
    estado: values.estado ?? 'BORRADOR',
    area: values.area ?? 'General',
  };

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

  if (changes.estado === 'PUBLICADA' && !current.fecha_publicacion && !changes.fecha_publicacion) {
    changes.fecha_publicacion = new Date().toISOString();
  }

  assertValidState({ ...current, ...changes });

  if (Object.keys(changes).length === 0) return current;
  return offersRepository.updateOwned(id, organizationId, changes);
}

export async function cancelOffer(userId, id) {
  const organizationId = await requireOrganization(userId, 'Solo una organización puede eliminar ofertas.');
  const cancelled = await offersRepository.cancelOwned(id, organizationId);
  if (!cancelled) throw notFound('No se encontró una oferta propia para cancelar.');
  return Number(cancelled.id);
}
