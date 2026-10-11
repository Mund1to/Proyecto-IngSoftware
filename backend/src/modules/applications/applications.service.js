// Reglas de negocio de postulaciones. No conoce Express ni SQL.
import { badRequest, conflict, forbidden, notFound } from '../../core/http/errors.js';
import { EXTERNAL_OFFER_TYPES } from '../offers/offers.domain.js';
import { getOrganizationProfileId } from '../profile/profile.repository.js';
import * as applicationsRepository from './applications.repository.js';

// Estados que puede asignar la organización. RETIRADA solo la aplica el candidato.
const COMPANY_STATUSES = ['ENVIADA', 'EN_REVISION', 'PRESELECCIONADA', 'RECHAZADA', 'ACEPTADA'];
const RESOLVED_STATUSES = ['ACEPTADA', 'RECHAZADA', 'RETIRADA'];

const DUPLICATE_MESSAGE = 'Ya existe una postulación para esta oferta.';

async function requireCandidate(userId, message) {
  const candidateProfileId = await applicationsRepository.findCandidateProfileId(userId);
  if (!candidateProfileId) throw forbidden(message);
  return candidateProfileId;
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

  const coverLetter = payload.cartaPresentacion ?? payload.carta_presentacion ?? payload.message ?? null;

  try {
    return await applicationsRepository.insert(offerId, candidateProfileId, coverLetter);
  } catch (error) {
    // Dos envíos simultáneos pueden superar la comprobación previa; la restricción
    // única de la tabla lo detecta.
    if (error?.code === '23505') throw conflict(DUPLICATE_MESSAGE);
    throw error;
  }
}

export async function updateApplicationStatus(userId, id, payload = {}) {
  const nextStatus = String(payload.estado ?? payload.status ?? '').trim().toUpperCase();
  if (!COMPANY_STATUSES.includes(nextStatus)) {
    throw badRequest('El estado de la postulación no es válido.');
  }

  const application = await applicationsRepository.findWithOfferOwner(id);
  if (!application) throw notFound('Postulación no encontrada.');

  if (await getOrganizationProfileId(userId) !== application.organizacion_id) {
    throw forbidden('No tienes permisos para cambiar el estado de esta postulación.');
  }

  if (application.estado === 'RETIRADA') {
    throw conflict('El candidato retiró esta postulación.');
  }

  return applicationsRepository.updateStatus(id, nextStatus);
}

// El candidato puede retirar su postulación mientras no esté resuelta.
export async function withdrawApplication(userId, id) {
  const candidateProfileId = await requireCandidate(userId, 'Solo un candidato o estudiante puede retirar sus postulaciones.');

  const application = await applicationsRepository.findOwnedByCandidate(id, candidateProfileId);
  if (!application) throw notFound('Postulación no encontrada.');

  if (RESOLVED_STATUSES.includes(application.estado)) {
    throw conflict('La postulación ya fue resuelta y no puede retirarse.');
  }

  return applicationsRepository.updateStatus(id, 'RETIRADA');
}

// La organización dueña de la oferta descarga la hoja de vida del postulante.
export async function getApplicationCv(userId, id) {
  const row = await applicationsRepository.findCvWithOfferOwner(id);
  if (!row) throw notFound('Postulación no encontrada.');

  const organizationProfileId = await getOrganizationProfileId(userId);
  if (String(organizationProfileId) !== String(row.organizacion_id)) {
    throw forbidden('No tienes permisos para ver esta hoja de vida.');
  }

  if (!row.contenido) throw notFound('El candidato no ha subido una hoja de vida.');
  return row;
}
