// Capa HTTP de verificación de organizaciones.
import { asyncHandler } from '../../core/http/errors.js';
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
