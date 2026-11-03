// Reglas de negocio de postulaciones. No conoce Express ni SQL.
import { withTransaction } from '../../core/database/database.js';
import { badRequest, conflict, forbidden, notFound } from '../../core/http/errors.js';
import { getBodyValue } from '../../core/http/payload.js';
import { EXTERNAL_OFFER_TYPES } from '../offers/offers.domain.js';
import { COMPANY_STATUSES, MAX_COVER_LETTER_LENGTH, RESOLVED_STATUSES } from './applications.domain.js';
import { getOrganizationProfileId } from '../profile/profile.repository.js';
import { parseUploadedFile } from '../profile/profileDetails.service.js';
import * as applicationsRepository from './applications.repository.js';

const DUPLICATE_MESSAGE = 'Ya existe una postulación para esta oferta.';

// Carta o mensaje para la empresa: opcional, sin espacios sobrantes y con límite.
function parseCoverLetter(payload) {
  const raw = getBodyValue(payload, ['cartaPresentacion', 'carta_presentacion', 'message']);
  const text = raw === undefined ? '' : String(raw).trim();
  if (text.length > MAX_COVER_LETTER_LENGTH) {
    throw badRequest(`El mensaje para la empresa admite como máximo ${MAX_COVER_LETTER_LENGTH} caracteres.`);
  }
  return text || null;
}

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
    // La postulación y la copia de la hoja de vida se guardan juntas: si una falla,
    // no queda una postulación sin la hoja de vida que el candidato eligió enviar.
    return await withTransaction(async (db) => {
      const application = await applicationsRepository.insert(db, offerId, candidateProfileId, coverLetter);
      const cv = attachProfileCv ? await applicationsRepository.copyProfileCv(db, application.id, candidateProfileId) : null;
      return { ...application, cv };
    });
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

  const application = await applicationsRepository.findOwnedByCandidate(id, candidateProfileId);
  if (!application) throw notFound('Postulación no encontrada.');

  if (application.estado !== 'ENVIADA') {
    throw conflict('La empresa ya empezó a revisar esta postulación; la hoja de vida enviada ya no se puede cambiar.');
  }

  const { nombre, mime, contenido } = parseUploadedFile('cv', input);
  return applicationsRepository.upsertApplicationCv(id, { nombre, mime, contenido });
}
