// Capa HTTP de la revisión de verificaciones (administradores y funcionarios).
import { asyncHandler } from '../../core/http/errors.js';
import { sendStoredFile } from '../../core/http/files.js';
import * as verificationsService from './verifications.service.js';

export const listOrganizationsController = asyncHandler(async function listOrganizationsController(_request, response) {
  const organizations = await verificationsService.listOrganizations();
  return response.json({ ok: true, organizations });
}, 'No se pudieron listar las organizaciones.');

export const updateOrganizationVerificationController = asyncHandler(async function updateOrganizationVerificationController(request, response) {
  const result = await verificationsService.updateOrganizationVerification(
    request.auth.sub,
    request.params.organizationId,
    request.body ?? {}
  );
  return response.json({ ok: true, ...result });
}, 'No se pudo actualizar la verificación.');

export const listRequestsController = asyncHandler(async function listRequestsController(request, response) {
  const result = await verificationsService.listRequests(request.query);
  return response.json({ ok: true, ...result });
}, 'No se pudieron listar las solicitudes de verificación.');

export const requestsSummaryController = asyncHandler(async function requestsSummaryController(_request, response) {
  const summary = await verificationsService.requestsSummary();
  return response.json({ ok: true, ...summary });
}, 'No se pudo consultar el resumen de solicitudes.');

export const decideRequestController = asyncHandler(async function decideRequestController(request, response) {
  const result = await verificationsService.decideRequest(request.auth.sub, request.params.requestId, request.body ?? {});
  return response.json({ ok: true, ...result });
}, 'No se pudo registrar la decisión.');

export const getDocumentController = asyncHandler(async function getDocumentController(request, response) {
  const document = await verificationsService.getDocument(request.params.documentId);
  return sendStoredFile(response, document);
}, 'No se pudo obtener el documento.');
