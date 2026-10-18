// Capa HTTP de la verificación vista por la empresa: documentos y solicitud.
import { asyncHandler } from '../../core/http/errors.js';
import { sendStoredFile } from '../../core/http/files.js';
import * as organizationVerificationService from './organizationVerification.service.js';

export const getMyVerificationController = asyncHandler(async function getMyVerificationController(request, response) {
  const verification = await organizationVerificationService.getMyVerification(request.auth.sub);
  return response.json({ ok: true, verification });
}, 'No se pudo cargar la verificación.');

// El archivo llega como cuerpo binario; el tipo va en ?tipo= y el nombre en X-File-Name.
export const uploadDocumentController = asyncHandler(async function uploadDocumentController(request, response) {
  const result = await organizationVerificationService.uploadDocument(request.auth.sub, {
    tipo: request.query.tipo,
    buffer: Buffer.isBuffer(request.body) ? request.body : null,
    contentType: request.get('content-type'),
    rawName: request.get('x-file-name'),
  });
  return response.status(201).json({ ok: true, ...result });
}, 'No se pudo guardar el documento.');

export const getMyDocumentController = asyncHandler(async function getMyDocumentController(request, response) {
  const document = await organizationVerificationService.getMyDocument(request.auth.sub, request.params.documentId);
  return sendStoredFile(response, document);
}, 'No se pudo obtener el documento.');

export const deleteDocumentController = asyncHandler(async function deleteDocumentController(request, response) {
  const verification = await organizationVerificationService.deleteDocument(request.auth.sub, request.params.documentId);
  return response.json({ ok: true, verification });
}, 'No se pudo eliminar el documento.');

export const submitRequestController = asyncHandler(async function submitRequestController(request, response) {
  const verification = await organizationVerificationService.submitRequest(request.auth.sub, request.body ?? {});
  return response.status(201).json({ ok: true, verification });
}, 'No se pudo enviar la solicitud de verificación.');

export const withdrawRequestController = asyncHandler(async function withdrawRequestController(request, response) {
  const verification = await organizationVerificationService.withdrawRequest(request.auth.sub);
  return response.json({ ok: true, verification });
}, 'No se pudo retirar la solicitud.');
