// Capa HTTP de autenticación.
import { asyncHandler } from '../../core/http/errors.js';
import * as authService from './auth.service.js';

export const registerController = asyncHandler(async function registerController(request, response) {
  const session = await authService.register(request.body ?? {});
  return response.status(201).json({ ok: true, ...session });
}, 'No se pudo registrar el usuario.');

export const loginController = asyncHandler(async function loginController(request, response) {
  const session = await authService.login(request.body ?? {});
  return response.json({ ok: true, ...session });
}, 'No se pudo iniciar sesión.');

// Responde siempre lo mismo para no revelar qué correos están registrados.
export const forgotPasswordController = asyncHandler(async function forgotPasswordController(request, response) {
  await authService.requestPasswordReset(request.body ?? {});
  return response.json({
    ok: true,
    message: 'Si el correo está registrado, recibirás un enlace para restablecer la contraseña.',
  });
}, 'No se pudo procesar la solicitud.');

export const resetPasswordController = asyncHandler(async function resetPasswordController(request, response) {
  await authService.resetPassword(request.body ?? {});
  return response.json({ ok: true, message: 'Contraseña restablecida. Ya puedes iniciar sesión.' });
}, 'No se pudo restablecer la contraseña.');
