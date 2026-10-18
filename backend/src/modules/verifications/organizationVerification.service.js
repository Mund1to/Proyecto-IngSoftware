// Fase 7: la empresa sube sus documentos de soporte y solicita la verificación.
// Cada operación bloquea la fila de la organización (findOrganizationByUser con
// forUpdate) para que subir, borrar, enviar y retirar no se crucen entre sí.
import { withTransaction } from '../../core/database/database.js';
import { HttpError, badRequest, conflict, forbidden, notFound } from '../../core/http/errors.js';
import { cleanFileName, hasValidSignature, normalizeMime } from '../../core/http/files.js';
import { getBodyValue, toNullableString } from '../../core/http/payload.js';
import * as verificationsRepository from './verifications.repository.js';
import { notifyReviewersOfRequest } from './verifications.mail.js';
import {
  DOCUMENT_MIMES,
  MAX_DOCUMENTS,
  MAX_DOCUMENT_BYTES,
  MAX_MESSAGE_LENGTH,
  documentRequirements,
  documentsLocked,
  normalizeDocumentType,
  organizationStatus,
  submissionBlockers,
} from './verifications.rules.js';

const NOT_AN_ORGANIZATION = 'Solo las cuentas de empresa u organización pueden solicitar la verificación.';

async function requireOrganization(userId, options) {
  const organization = await verificationsRepository.findOrganizationByUser(userId, options);
  if (!organization) throw forbidden(NOT_AN_ORGANIZATION);
  return organization;
}

const mapDocument = (document) => ({
  id: document.id,
  tipo: document.tipo,
  nombre: document.nombre,
  mime: document.mime,
  tamano: document.tamano,
  createdAt: document.created_at,
});

function mapRequest(request) {
  if (!request) return null;
  return {
    id: request.id,
    estado: request.estado,
    mensaje: request.mensaje,
    observaciones: request.observaciones,
    enviadaPorEmpresa: request.solicitado_por !== null,
    enviadaAt: request.created_at,
    revisadaAt: request.revisado_at,
    revisor: request.revisor_nombre ?? null,
  };
}

// Estado completo que muestra la sección "Verificación" de Mi empresa.
async function buildState(organization) {
  const [documents, currentRequest] = await Promise.all([
    verificationsRepository.listDocuments(organization.organizacion_id),
    verificationsRepository.findCurrentRequest(organization.organizacion_id),
  ]);

  const hasPendingRequest = currentRequest?.estado === 'PENDIENTE' && currentRequest.solicitado_por !== null;
  const locked = documentsLocked({ verified: organization.verificada, hasPendingRequest });
  const blockers = submissionBlockers({ identificacionFiscal: organization.identificacion_fiscal, documents });

  return {
    estado: organizationStatus({ verified: organization.verificada, latestRequest: currentRequest }),
    verificada: organization.verificada,
    solicitud: mapRequest(currentRequest),
    documentos: documents.map(mapDocument),
    bloqueada: locked,
    faltantes: blockers,
    puedeEnviar: !locked && blockers.length === 0,
    requisitos: documentRequirements(),
  };
}

async function reloadState(userId) {
  return buildState(await requireOrganization(userId));
}

// Los documentos solo cambian si no hay revisión en curso ni aprobación vigente.
async function assertDocumentsEditable(db, organization) {
  if (organization.verificada) {
    throw conflict('Tu organización ya está verificada; los documentos aprobados no se pueden modificar.');
  }
  if (await verificationsRepository.findPendingRequest(db, organization.organizacion_id)) {
    throw conflict('Tu solicitud está en revisión. Retírala si necesitas cambiar los documentos.');
  }
}

export function getMyVerification(userId) {
  return reloadState(userId);
}

// Valida el tipo declarado, el tamaño y la firma real del archivo antes de abrir la transacción.
export async function uploadDocument(userId, { tipo, buffer, contentType, rawName }) {
  const type = normalizeDocumentType(tipo);
  if (!type) throw badRequest('Indica el tipo de documento: RUT, CAMARA_COMERCIO, CEDULA_REPRESENTANTE u OTRO.');

  if (!buffer || buffer.length === 0) throw badRequest('No se recibió ningún archivo.');

  if (buffer.length > MAX_DOCUMENT_BYTES) {
    throw new HttpError(413, `El documento no puede superar ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB.`);
  }

  const mime = normalizeMime(contentType);
  if (!hasValidSignature(mime, buffer, DOCUMENT_MIMES)) {
    throw new HttpError(415, 'El documento debe ser un archivo PDF, PNG o JPG válido.');
  }

  const nombre = cleanFileName(rawName, 'documento');

  const document = await withTransaction(async (db) => {
    const organization = await requireOrganization(userId, { db, forUpdate: true });
    await assertDocumentsEditable(db, organization);

    if ((await verificationsRepository.countDocuments(db, organization.organizacion_id)) >= MAX_DOCUMENTS) {
      throw conflict(`Puedes adjuntar como máximo ${MAX_DOCUMENTS} documentos. Elimina alguno antes de subir otro.`);
    }

    return verificationsRepository.insertDocument(db, organization.organizacion_id, { tipo: type, nombre, mime, contenido: buffer });
  });

  return { document: mapDocument(document), verification: await reloadState(userId) };
}

export async function getMyDocument(userId, documentId) {
  const organization = await requireOrganization(userId);
  const document = await verificationsRepository.findDocument(documentId, organization.organizacion_id);
  if (!document) throw notFound('Documento no encontrado.');
  return document;
}

export async function deleteDocument(userId, documentId) {
  await withTransaction(async (db) => {
    const organization = await requireOrganization(userId, { db, forUpdate: true });
    await assertDocumentsEditable(db, organization);

    if (!(await verificationsRepository.deleteDocument(db, organization.organizacion_id, documentId))) {
      throw notFound('Documento no encontrado.');
    }
  });

  return reloadState(userId);
}

// Envía la solicitud con los documentos actuales y avisa a los revisores.
export async function submitRequest(userId, payload = {}) {
  const message = toNullableString(getBodyValue(payload, ['mensaje', 'message']));
  if (message && message.length > MAX_MESSAGE_LENGTH) {
    throw badRequest(`El mensaje admite como máximo ${MAX_MESSAGE_LENGTH} caracteres.`);
  }

  const submitted = await withTransaction(async (db) => {
    const organization = await requireOrganization(userId, { db, forUpdate: true });

    if (organization.verificada) throw conflict('Tu organización ya está verificada.');
    if (await verificationsRepository.findPendingRequest(db, organization.organizacion_id)) {
      throw conflict('Ya tienes una solicitud en revisión.');
    }

    const documents = await verificationsRepository.listDocuments(organization.organizacion_id, db);
    const blockers = submissionBlockers({ identificacionFiscal: organization.identificacion_fiscal, documents });
    if (blockers.includes('NIT')) {
      throw badRequest('Registra el NIT o identificación fiscal en los datos de la empresa antes de enviar la solicitud.');
    }
    if (blockers.length > 0) {
      throw badRequest('Adjunta los documentos obligatorios: RUT y certificado de Cámara de Comercio.');
    }

    await verificationsRepository.insertRequest(db, { organizationId: organization.organizacion_id, userId, message });
    return { organization, documentCount: documents.length };
  });

  const { organization, documentCount } = submitted;
  const requester = await verificationsRepository.findOrganizationContact(organization.organizacion_id);
  await notifyReviewersOfRequest({
    razonSocial: organization.razon_social,
    nit: organization.identificacion_fiscal,
    requesterEmail: requester?.email ?? '',
    documentCount,
  }).catch((error) => console.error('submitRequest notifyReviewers error:', error));

  return reloadState(userId);
}

// Retira la solicitud pendiente para poder corregir los documentos.
export async function withdrawRequest(userId) {
  await withTransaction(async (db) => {
    const organization = await requireOrganization(userId, { db, forUpdate: true });
    if (!(await verificationsRepository.deletePendingRequest(db, organization.organizacion_id))) {
      throw notFound('No tienes una solicitud en revisión.');
    }
  });

  return reloadState(userId);
}
