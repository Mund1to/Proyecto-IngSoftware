// Reglas de registro, inicio de sesión y recuperación de contraseña.
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { env } from '../../core/config/env.js';
import { withTransaction } from '../../core/database/database.js';
import { HttpError, badRequest, conflict, forbidden } from '../../core/http/errors.js';
import { getBodyValue } from '../../core/http/payload.js';
import { escapeHtml, sendEmail } from '../../core/mail/mailer.js';
import { isStrongPassword, PASSWORD_RULE_MESSAGE } from '../../core/security/password.js';
import * as authRepository from './auth.repository.js';
import { buildToken } from './auth.tokens.js';

const PROFILE_TYPES = new Map([
  ['student', 'ESTUDIANTE'],
  ['estudiante', 'ESTUDIANTE'],
  ['company', 'ORGANIZACION'],
  ['empresa', 'ORGANIZACION'],
  ['organizacion', 'ORGANIZACION'],
  ['external', 'CANDIDATO_EXTERNO'],
  ['candidato_externo', 'CANDIDATO_EXTERNO'],
]);

const REGISTRABLE_PROFILE_TYPES = ['ESTUDIANTE', 'ORGANIZACION', 'CANDIDATO_EXTERNO'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_TOKEN_TTL_MINUTES = 60;

const unauthorized = (message) => new HttpError(401, message);
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function getProfilePayload(payload) {
  return payload.profile ?? payload.perfil ?? payload;
}

function normalizeProfileType(value) {
  if (value === undefined || value === null || value === '') {
    return 'ESTUDIANTE';
  }

  const normalized = String(value).trim().toLowerCase();
  return PROFILE_TYPES.get(normalized) ?? String(value).trim().toUpperCase();
}

function publicUser(user, roles, profileTypes) {
  return {
    id: user.id,
    email: user.email,
    nombreCompleto: user.nombre_completo,
    telefono: user.telefono,
    activo: user.activo,
    createdAt: user.created_at,
    roles,
    profileTypes,
  };
}

function session(user, roles, profileTypes) {
  return {
    token: buildToken({ ...user, roles, profileTypes }),
    user: publicUser(user, roles, profileTypes),
  };
}

// Crea la cuenta, su rol básico y el perfil del tipo elegido en una sola transacción.
export async function register(payload = {}) {
  const profilePayload = getProfilePayload(payload);
  const email = normalizeEmail(getBodyValue(payload, ['email', 'correo']));
  const password = getBodyValue(payload, ['password', 'contrasena']);
  const nombreCompleto = String(getBodyValue(payload, ['nombreCompleto', 'nombre_completo', 'nombre']) ?? '').trim();
  const telefono = getBodyValue(payload, ['telefono', 'phone']) ?? null;
  const profileType = normalizeProfileType(getBodyValue(payload, ['profileType', 'tipoPerfil', 'role', 'tipo']))
    .toUpperCase();

  if (!email || !password || !nombreCompleto) {
    throw badRequest('Se requieren email, password y nombre completo.');
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw badRequest('El email no tiene un formato válido.');
  }

  if (!isStrongPassword(password)) {
    throw badRequest(PASSWORD_RULE_MESSAGE);
  }

  if (!REGISTRABLE_PROFILE_TYPES.includes(profileType)) {
    throw badRequest('El tipo de perfil no es válido.');
  }

  const razonSocial = String(
    getBodyValue(profilePayload, ['razonSocial', 'razon_social', 'companyName', 'nombreEmpresa']) ?? nombreCompleto
  ).trim();

  if (profileType === 'ORGANIZACION' && !razonSocial) {
    throw badRequest('La empresa debe indicar su razón social.');
  }

  const field = (keys) => getBodyValue(profilePayload, keys) ?? null;

  try {
    const { user, role, profile } = await withTransaction(async (db) => {
      if (await authRepository.emailExists(email, db)) {
        throw conflict('Ya existe un usuario con ese email.');
      }

      const passwordHash = await bcrypt.hash(String(password), 10);
      const user = await authRepository.insertUser({
        email,
        passwordHash,
        nombreCompleto,
        telefono: telefono ? String(telefono).trim() : null,
      }, db);

      const role = await authRepository.findRoleByName('USUARIO', db);
      if (!role) {
        throw new Error('No existe el rol USUARIO en la base de datos.');
      }
      await authRepository.assignRole(user.id, role.id, db);

      const profile = await authRepository.insertProfile(user.id, profileType, db);

      if (profileType === 'ESTUDIANTE') {
        await authRepository.insertStudentProfile(profile.id, {
          universidad: field(['universidad']),
          programaAcademico: field(['programaAcademico', 'programa_academico']),
          semestre: field(['semestre']),
          codigoEstudiante: field(['codigoEstudiante', 'codigo_estudiante']),
          fechaGraduacionEstimada: field(['fechaGraduacionEstimada', 'fecha_graduacion_estimada']),
        }, db);
      }

      if (profileType === 'ORGANIZACION') {
        await authRepository.insertOrganization(profile.id, {
          razonSocial,
          identificacionFiscal: field(['identificacionFiscal', 'identificacion_fiscal']),
          sitioWeb: field(['sitioWeb', 'sitio_web']),
          descripcion: field(['descripcion']),
        }, db);
      }

      if (profileType === 'CANDIDATO_EXTERNO') {
        await authRepository.insertCandidateProfile(profile.id, {
          resumen: field(['resumen']),
          ubicacion: field(['ubicacion']),
          disponibilidad: field(['disponibilidad']),
          cvUrl: field(['cvUrl', 'cv_url']),
        }, db);
      }

      return { user, role, profile };
    });

    return session(user, [role.nombre], [profile.tipo]);
  } catch (error) {
    if (error?.code === '23505') {
      throw conflict('Los datos enviados ya están registrados.');
    }
    throw error;
  }
}

export async function login(payload = {}) {
  const email = normalizeEmail(getBodyValue(payload, ['email', 'correo']));
  const password = getBodyValue(payload, ['password', 'contrasena']);

  if (!email || !password) {
    throw badRequest('Debe indicar email y password.');
  }

  const user = await authRepository.findLoginUser(email);
  if (!user) throw unauthorized('Credenciales inválidas.');

  if (!user.activo) throw forbidden('El usuario está inactivo.');

  if (!(await bcrypt.compare(String(password), user.password_hash))) {
    throw unauthorized('Credenciales inválidas.');
  }

  const roles = Array.isArray(user.roles) ? user.roles : [];
  const profileTypes = Array.isArray(user.profile_types) ? user.profile_types : [];
  return session(user, roles, profileTypes);
}

// Avisa a los administradores activos de una solicitud de cambio de contraseña,
// para que puedan asignar una nueva desde Usuarios si el enlace no le llega a la persona.
async function notifyAdminsOfResetRequest(name, email) {
  const adminEmails = await authRepository.listActiveAdminEmails(email);
  const usersLink = `${env.appUrl}/`;
  await Promise.all(adminEmails.map((adminEmail) => sendEmail({
    to: adminEmail,
    subject: `Solicitud de cambio de contraseña: ${name}`,
    text: `${name} (${email}) pidió restablecer su contraseña de SIPU.\n\nSi no recibe el enlace, entra a SIPU como administrador, ve a Usuarios y usa "Cambiar contraseña" en su cuenta:\n${usersLink}`,
    html: `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) pidió restablecer su contraseña de SIPU.</p><p>Si no recibe el enlace, entra a SIPU como administrador, ve a <strong>Usuarios</strong> y usa <strong>Cambiar contraseña</strong> en su cuenta.</p><p><a href="${usersLink}">Abrir SIPU</a></p>`,
  })));
}

// No revela si el correo está registrado: quien llama responde siempre lo mismo.
export async function requestPasswordReset(payload = {}) {
  const email = normalizeEmail(getBodyValue(payload, ['email', 'correo']));

  if (!EMAIL_PATTERN.test(email)) {
    throw badRequest('El email no tiene un formato válido.');
  }

  const user = await authRepository.findActiveUserByEmail(email);
  if (!user) return;

  const token = crypto.randomBytes(32).toString('hex');

  // Solo el enlace más reciente sigue siendo válido.
  await authRepository.invalidatePendingResets(user.id);
  await authRepository.insertPasswordReset(user.id, hashToken(token), RESET_TOKEN_TTL_MINUTES);

  const link = `${env.appUrl}/?reset=${token}`;
  // Un fallo del proveedor se registra pero no cambia la respuesta, para no
  // revelar que el correo existe.
  await sendEmail({
    to: email,
    subject: 'Restablece tu contraseña de SIPU',
    text: `Hola ${user.nombre_completo}:\n\nPara crear una nueva contraseña abre este enlace (vence en ${RESET_TOKEN_TTL_MINUTES} minutos):\n${link}\n\nSi no solicitaste el cambio, ignora este mensaje.`,
    html: `<p>Hola ${escapeHtml(user.nombre_completo)}:</p><p>Para crear una nueva contraseña abre este enlace (vence en ${RESET_TOKEN_TTL_MINUTES} minutos):</p><p><a href="${link}">Restablecer contraseña</a></p><p>Si no solicitaste el cambio, ignora este mensaje.</p>`,
  }).catch((error) => console.error('forgotPassword sendEmail error:', error));

  await notifyAdminsOfResetRequest(user.nombre_completo, email)
    .catch((error) => console.error('forgotPassword notifyAdmins error:', error));
}

export async function resetPassword(payload = {}) {
  const token = String(getBodyValue(payload, ['token']) ?? '').trim();
  const password = getBodyValue(payload, ['password', 'contrasena', 'newPassword']);

  if (!/^[a-f0-9]{64}$/.test(token)) {
    throw badRequest('El enlace de recuperación no es válido.');
  }

  if (!isStrongPassword(password)) {
    throw badRequest(PASSWORD_RULE_MESSAGE);
  }

  await withTransaction(async (db) => {
    const reset = await authRepository.findValidResetForUpdate(hashToken(token), db);
    if (!reset) {
      throw badRequest('El enlace de recuperación venció o ya fue usado. Solicita uno nuevo.');
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    await authRepository.updatePasswordHash(reset.usuario_id, passwordHash, db);
    await authRepository.markResetUsed(reset.id, db);
  });
}
