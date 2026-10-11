// Capa HTTP de la cuenta y los perfiles.
import { asyncHandler } from '../../core/http/errors.js';
import * as profileService from './profile.service.js';

export const getCurrentUserController = asyncHandler(async function getCurrentUserController(request, response) {
  const user = await profileService.getCurrentUser(request.auth.sub);
  return response.json({ ok: true, user });
}, 'No se pudo obtener el perfil del usuario.');

export const updateCurrentUserController = asyncHandler(async function updateCurrentUserController(request, response) {
  const user = await profileService.updateCurrentUser(request.auth.sub, request.body ?? {});
  return response.json({ ok: true, user });
}, 'No se pudo actualizar el usuario.');

export const updateStudentProfileController = asyncHandler(async function updateStudentProfileController(request, response) {
  const user = await profileService.updateStudentProfile(request.auth.sub, request.body ?? {});
  return response.json({ ok: true, user });
}, 'No se pudo actualizar el perfil de estudiante.');

export const updateOrganizationProfileController = asyncHandler(async function updateOrganizationProfileController(request, response) {
  const user = await profileService.updateOrganizationProfile(request.auth.sub, request.body ?? {});
  return response.json({ ok: true, user });
}, 'No se pudo actualizar el perfil de organización.');

export const updateExternalProfileController = asyncHandler(async function updateExternalProfileController(request, response) {
  const user = await profileService.updateExternalProfile(request.auth.sub, request.body ?? {});
  return response.json({ ok: true, user });
}, 'No se pudo actualizar el perfil de candidato externo.');

export const changePasswordController = asyncHandler(async function changePasswordController(request, response) {
  const token = await profileService.changePassword(request.auth, request.body ?? {});
  return response.json({ ok: true, message: 'Contraseña actualizada.', token });
}, 'No se pudo cambiar la contraseña.');
