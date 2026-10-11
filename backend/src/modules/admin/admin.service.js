// Reglas de administración de cuentas: roles, activación y contraseñas.
import bcrypt from 'bcrypt';
import { withTransaction } from '../../core/database/database.js';
import { badRequest, conflict, notFound } from '../../core/http/errors.js';
import { getBodyValue } from '../../core/http/payload.js';
import { sendEmail } from '../../core/mail/mailer.js';
import { ASSIGNABLE_ROLES, isStrongPassword } from './admin.domain.js';
import * as adminRepository from './admin.repository.js';

export function listUsers(search) {
  return adminRepository.searchUsers(String(search ?? '').trim());
}

export async function updateUserRoles(userId, payload = {}) {
  const rawRoles = getBodyValue(payload, ['roles']);
  if (!Array.isArray(rawRoles)) throw badRequest('Debe enviar la lista de roles.');

  const roles = [...new Set(rawRoles.map((role) => String(role).trim().toUpperCase()))];
  if (roles.some((role) => !ASSIGNABLE_ROLES.includes(role))) {
    throw badRequest(`Los roles válidos son ${ASSIGNABLE_ROLES.join(', ')}.`);
  }

  // Toda cuenta conserva el rol básico.
  if (!roles.includes('USUARIO')) roles.push('USUARIO');

  await withTransaction(async (db) => {
    const user = await adminRepository.findUser(userId, db);
    if (!user) throw notFound('Usuario no encontrado.');

    const removesAdmin = user.roles.includes('ADMINISTRADOR') && !roles.includes('ADMINISTRADOR');
    if (removesAdmin && (await adminRepository.countOtherActiveAdmins(userId, db)) === 0) {
      throw conflict('Debe existir al menos un administrador activo.');
    }

    await adminRepository.replaceRoles(userId, roles, db);
  });

  return adminRepository.findUser(userId);
}

export async function updateUserActive(actorId, userId, payload = {}) {
  const active = getBodyValue(payload, ['activo', 'active']);
  if (typeof active !== 'boolean') throw badRequest('Debe indicar activo como true o false.');

  if (String(userId) === String(actorId) && !active) {
    throw conflict('No puedes desactivar tu propia cuenta.');
  }

  if (!(await adminRepository.setActive(userId, active))) throw notFound('Usuario no encontrado.');
  return adminRepository.findUser(userId);
}

// El administrador asigna una contraseña nueva a otra cuenta (por ejemplo, cuando
// la persona pidió recuperarla y el correo no le llegó). Cierra sus sesiones
// abiertas, invalida los enlaces de recuperación pendientes y le avisa por correo.
export async function setUserPassword(actorId, userId, payload = {}) {
  const password = getBodyValue(payload, ['password', 'contrasena', 'newPassword']);

  if (String(userId) === String(actorId)) {
    throw conflict('Cambia tu propia contraseña desde tu perfil.');
  }

  if (!isStrongPassword(password)) {
    throw badRequest('La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.');
  }

  const updated = await withTransaction(async (db) => {
    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await adminRepository.setPasswordHash(userId, passwordHash, db);
    if (!user) throw notFound('Usuario no encontrado.');

    await adminRepository.invalidatePendingResets(userId, db);
    return user;
  });

  const { email, nombre_completo: name } = updated;
  await sendEmail({
    to: email,
    subject: 'Un administrador cambió tu contraseña de SIPU',
    text: `Hola ${name}:\n\nUn administrador de SIPU asignó una contraseña nueva a tu cuenta y cerró tus sesiones abiertas. Te la entregará por un canal seguro; al entrar, cámbiala desde tu perfil.\n\nSi no pediste este cambio, comunícate con la universidad.`,
  }).catch((error) => console.error('setUserPassword sendEmail error:', error));

  return adminRepository.findUser(userId);
}
