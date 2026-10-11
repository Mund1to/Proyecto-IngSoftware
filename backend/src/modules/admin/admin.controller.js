// Capa HTTP de administración de cuentas.
import { asyncHandler } from '../../core/http/errors.js';
import * as adminService from './admin.service.js';

export const listUsersController = asyncHandler(async function listUsersController(request, response) {
  const users = await adminService.listUsers(request.query.q);
  return response.json({ ok: true, users });
}, 'No se pudieron listar los usuarios.');

export const updateUserRolesController = asyncHandler(async function updateUserRolesController(request, response) {
  const user = await adminService.updateUserRoles(request.params.userId, request.body ?? {});
  return response.json({ ok: true, user });
}, 'No se pudieron actualizar los roles.');

export const updateUserActiveController = asyncHandler(async function updateUserActiveController(request, response) {
  const user = await adminService.updateUserActive(request.auth.sub, request.params.userId, request.body ?? {});
  return response.json({ ok: true, user });
}, 'No se pudo actualizar el estado del usuario.');

export const setUserPasswordController = asyncHandler(async function setUserPasswordController(request, response) {
  const user = await adminService.setUserPassword(request.auth.sub, request.params.userId, request.body ?? {});
  return response.json({ ok: true, message: 'Contraseña actualizada.', user });
}, 'No se pudo cambiar la contraseña.');
