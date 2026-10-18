// Reglas de revisión de la verificación de organizaciones.
// El acceso se restringe en la ruta a ADMINISTRADOR y FUNCIONARIO_PUBLICO.
import { withTransaction } from '../../core/database/database.js';
import { badRequest, conflict, notFound } from '../../core/http/errors.js';
import { parsePagination } from '../../core/http/pagination.js';
import { getBodyValue, toNullableString } from '../../core/http/payload.js';
import * as verificationsRepository from './verifications.repository.js';
import { notifyOrganizationOfDecision } from './verifications.mail.js';
import {
  MAX_MESSAGE_LENGTH,
  MIN_REJECTION_REASON_LENGTH,
  REVIEW_DECISIONS,
  VERIFICATION_STATUSES,
} from './verifications.rules.js';

export function listOrganizations() {
  return verificationsRepository.listOrganizationsWithLatestVerification();
}

function parseStatus(payload, allowed, message) {
  const status = String(getBodyValue(payload, ['estado', 'status']) ?? '').trim().toUpperCase();
  if (!allowed.includes(status)) throw badRequest(message);
  return status;
}

function parseObservations(payload) {
  const observations = toNullableString(getBodyValue(payload, ['observaciones', 'observations']));
  if (observations && observations.length > MAX_MESSAGE_LENGTH) {
    throw badRequest(`Las observaciones admiten como máximo ${MAX_MESSAGE_LENGTH} caracteres.`);
  }
  return observations;
}

// La decisión se comunica a la empresa después de confirmar la transacción.
function notifyDecision(organizationId, status, observations) {
  if (status === 'PENDIENTE') return Promise.resolve();
  return notifyOrganizationOfDecision(organizationId, { status, observations })
    .catch((error) => console.error('verification notifyOrganization error:', error));
}

// Registra la decisión de verificación de una organización.
// Aprobar activa organizaciones.verificada; rechazar la desactiva. Si la empresa
// tiene una solicitud en revisión, la decisión la resuelve en lugar de crear otra fila.
export async function updateOrganizationVerification(reviewerId, organizationId, payload = {}) {
  const status = parseStatus(payload, VERIFICATION_STATUSES, 'El estado de verificación debe ser PENDIENTE, APROBADA o RECHAZADA.');
  const observations = parseObservations(payload);

  const organization = await withTransaction(async (db) => {
    if (!(await verificationsRepository.lockOrganization(db, organizationId))) {
      throw notFound('Organización no encontrada.');
    }

    const pending = status === 'PENDIENTE' ? null : await verificationsRepository.findPendingRequest(db, organizationId);
    if (pending) {
      await verificationsRepository.resolveRequest(db, pending.id, { reviewerId, status, observations });
    } else {
      await verificationsRepository.insertVerification(db, { organizationId, reviewerId, status, observations });
    }

    return verificationsRepository.setOrganizationVerified(db, organizationId, status);
  });

  await notifyDecision(organizationId, status, observations);
  return { organization, verificationStatus: status };
}

const mapRequestRow = (row) => ({
  id: row.id,
  estado: row.estado,
  mensaje: row.mensaje,
  observaciones: row.observaciones,
  documentos: row.documentos ?? [],
  enviadaAt: row.created_at,
  revisadaAt: row.revisado_at,
  revisor: row.revisor_nombre ?? null,
  organizacion: {
    id: row.organizacion_id,
    razonSocial: row.razon_social,
    identificacionFiscal: row.identificacion_fiscal,
    sitioWeb: row.sitio_web,
    descripcion: row.descripcion,
    verificada: row.verificada,
  },
  solicitante: {
    nombre: row.solicitante_nombre,
    email: row.solicitante_email,
    telefono: row.solicitante_telefono,
  },
});

// ?estado=PENDIENTE (por defecto), APROBADA, RECHAZADA o TODAS; ?page= y ?limit=.
export async function listRequests(query = {}) {
  const rawStatus = String(query.estado ?? 'PENDIENTE').trim().toUpperCase();
  if (rawStatus !== 'TODAS' && !VERIFICATION_STATUSES.includes(rawStatus)) {
    throw badRequest('El filtro estado debe ser PENDIENTE, APROBADA, RECHAZADA o TODAS.');
  }

  const { page, limit, offset } = parsePagination(query);
  const { rows, total } = await verificationsRepository.listRequests({
    status: rawStatus === 'TODAS' ? null : rawStatus,
    limit,
    offset,
  });

  return { requests: rows.map(mapRequestRow), total, page, limit };
}

export async function requestsSummary() {
  return { pendientes: await verificationsRepository.countPendingRequests() };
}

export async function getDocument(documentId) {
  const document = await verificationsRepository.findDocument(documentId);
  if (!document) throw notFound('El documento ya no está disponible.');
  return document;
}

// Aprueba o rechaza una solicitud enviada por la empresa. Rechazar exige un
// motivo para que la empresa sepa qué corregir.
export async function decideRequest(reviewerId, requestId, payload = {}) {
  const status = parseStatus(payload, REVIEW_DECISIONS, 'La decisión debe ser APROBADA o RECHAZADA.');
  const observations = parseObservations(payload);

  if (status === 'RECHAZADA' && (observations ?? '').length < MIN_REJECTION_REASON_LENGTH) {
    throw badRequest(`Explica el motivo del rechazo (mínimo ${MIN_REJECTION_REASON_LENGTH} caracteres) para que la empresa pueda corregirlo.`);
  }

  const result = await withTransaction(async (db) => {
    // Se bloquea primero la organización y luego la solicitud (ver el repositorio).
    const organizationId = await verificationsRepository.findRequestOrganizationId(db, requestId);
    if (!organizationId) throw notFound('Solicitud no encontrada.');
    await verificationsRepository.lockOrganization(db, organizationId);

    const request = await verificationsRepository.findRequestForUpdate(db, requestId);
    if (!request) throw notFound('Solicitud no encontrada.');
    if (request.estado !== 'PENDIENTE') throw conflict('Esta solicitud ya fue revisada.');

    const resolved = await verificationsRepository.resolveRequest(db, requestId, { reviewerId, status, observations });
    const organization = await verificationsRepository.setOrganizationVerified(db, organizationId, status);
    return { request: resolved, organization };
  });

  await notifyDecision(result.organization.organizacion_id, status, observations);
  return { ...result, verificationStatus: status };
}
