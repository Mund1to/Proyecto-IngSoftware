// Reglas de la cuenta y de los perfiles de estudiante, organización y candidato.
import bcrypt from 'bcrypt';
import { withTransaction } from '../../core/database/database.js';
import { badRequest, conflict, notFound } from '../../core/http/errors.js';
import { getBodyValue, hasBodyValue, toNullableString } from '../../core/http/payload.js';
import { buildToken } from '../auth/auth.tokens.js';
import * as profileRepository from './profile.repository.js';

const NAME_KEYS = ['nombreCompleto', 'nombre_completo', 'nombre'];
const PHONE_KEYS = ['telefono', 'phone'];

function mapProfile(profile) {
  return {
    id: profile.id,
    tipo: profile.tipo,
    visible: profile.visible,
    universidad: profile.universidad,
    programaAcademico: profile.programa_academico,
    semestre: profile.semestre,
    codigoEstudiante: profile.codigo_estudiante,
    fechaGraduacionEstimada: profile.fecha_graduacion_estimada,
    razonSocial: profile.razon_social,
    identificacionFiscal: profile.identificacion_fiscal,
    sitioWeb: profile.sitio_web,
    descripcion: profile.descripcion,
    verificada: profile.verificada,
    resumen: profile.resumen,
    ubicacion: profile.ubicacion,
    disponibilidad: profile.disponibilidad,
    cvUrl: profile.cv_url,
  };
}

function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    nombreCompleto: user.nombre_completo,
    telefono: user.telefono,
    activo: user.activo,
    createdAt: user.created_at,
    roles: user.roles,
    perfiles: (user.perfiles ?? []).map(mapProfile),
    archivos: user.archivos ?? [],
  };
}

async function loadSerializedUser(userId) {
  return serializeUser(await profileRepository.findUserProfile(userId));
}

// { columna: { sent, value } } con los campos de texto opcionales presentes en el cuerpo.
function optionalTextFields(payload, fields) {
  return Object.fromEntries(Object.entries(fields).map(([column, keys]) => [
    column,
    { sent: hasBodyValue(payload, keys), value: toNullableString(getBodyValue(payload, keys)) },
  ]));
}

// Nombre y teléfono de la cuenta; undefined en el nombre significa "no cambiar".
function parseAccountChanges(payload) {
  const nombreCompleto = getBodyValue(payload, NAME_KEYS);
  if (nombreCompleto !== undefined && !String(nombreCompleto).trim()) {
    throw badRequest('El nombre completo no puede estar vacío.');
  }

  return {
    nameSent: nombreCompleto !== undefined,
    changes: {
      nombreCompleto: nombreCompleto === undefined ? null : String(nombreCompleto).trim(),
      phoneSent: hasBodyValue(payload, PHONE_KEYS),
      telefono: toNullableString(getBodyValue(payload, PHONE_KEYS)),
    },
  };
}

export async function getCurrentUser(userId) {
  const user = await profileRepository.findUserProfile(userId);
  if (!user) throw notFound('Usuario no encontrado.');
  return serializeUser(user);
}

export async function updateCurrentUser(userId, payload = {}) {
  const { changes } = parseAccountChanges(payload);
  if (!(await profileRepository.updateAccount(userId, changes))) throw notFound('Usuario no encontrado.');
  return loadSerializedUser(userId);
}

export async function updateStudentProfile(userId, payload = {}) {
  const semesterKeys = ['semestre'];
  const graduationKeys = ['fechaGraduacionEstimada', 'fecha_graduacion_estimada'];
  const semesterValue = getBodyValue(payload, semesterKeys);
  const semester = !hasBodyValue(payload, semesterKeys) || semesterValue === '' || semesterValue === undefined
    ? null
    : Number(semesterValue);

  if (semester !== null && (!Number.isInteger(semester) || semester < 1)) {
    throw badRequest('El semestre debe ser un número entero mayor que cero.');
  }

  await profileRepository.ensureProfileDetailRow(userId, 'ESTUDIANTE');
  const updated = await profileRepository.updateStudentProfile(userId, {
    ...optionalTextFields(payload, {
      universidad: ['universidad'],
      programa_academico: ['programaAcademico', 'programa_academico'],
    }),
    semestre: { sent: hasBodyValue(payload, semesterKeys), value: semester },
    ...optionalTextFields(payload, { codigo_estudiante: ['codigoEstudiante', 'codigo_estudiante'] }),
    fecha_graduacion_estimada: { sent: hasBodyValue(payload, graduationKeys), value: getBodyValue(payload, graduationKeys) || null },
  });

  if (!updated) throw notFound('No existe un perfil de estudiante para este usuario.');
  return loadSerializedUser(userId);
}

export async function updateOrganizationProfile(userId, payload = {}) {
  const razonSocialKeys = ['razonSocial', 'razon_social'];
  const razonSocial = toNullableString(getBodyValue(payload, razonSocialKeys));

  if (hasBodyValue(payload, razonSocialKeys) && !razonSocial) {
    throw badRequest('La razón social no puede quedar vacía.');
  }

  const fields = optionalTextFields(payload, {
    identificacion_fiscal: ['identificacionFiscal', 'identificacion_fiscal'],
    sitio_web: ['sitioWeb', 'sitio_web'],
    descripcion: ['descripcion'],
  });

  let updated;
  try {
    await profileRepository.ensureProfileDetailRow(userId, 'ORGANIZACION');
    updated = await profileRepository.updateOrganizationProfile(userId, razonSocial, fields);
  } catch (error) {
    if (error?.code === '23505') {
      throw conflict('La identificación fiscal ya está registrada por otra organización.');
    }
    throw error;
  }

  if (!updated) throw notFound('No existe un perfil de organización para este usuario.');
  return loadSerializedUser(userId);
}

export async function updateExternalProfile(userId, payload = {}) {
  const cvUrl = toNullableString(getBodyValue(payload, ['cvUrl', 'cv_url']));
  if (cvUrl && !/^https?:\/\/\S+$/i.test(cvUrl)) {
    throw badRequest('El enlace de la hoja de vida debe empezar por http:// o https://.');
  }

  const account = parseAccountChanges(payload);
  const fields = optionalTextFields(payload, {
    resumen: ['resumen'],
    ubicacion: ['ubicacion'],
    disponibilidad: ['disponibilidad'],
    cv_url: ['cvUrl', 'cv_url'],
  });

  await withTransaction(async (db) => {
    await profileRepository.ensureProfileDetailRow(userId, 'CANDIDATO_EXTERNO', db);
    if (!(await profileRepository.updateCandidateProfile(userId, fields, db))) {
      throw notFound('No existe un perfil de candidato externo para este usuario.');
    }

    // El formulario del candidato también envía nombre y teléfono de la cuenta.
    if (account.nameSent || account.changes.phoneSent) {
      await profileRepository.updateAccount(userId, account.changes, db);
    }
  });

  return loadSerializedUser(userId);
}

// Devuelve un token nuevo: incrementar token_version cierra las demás sesiones
// abiertas y esta sesión continúa con el token entregado.
export async function changePassword(auth, payload = {}) {
  const currentPassword = getBodyValue(payload, ['currentPassword', 'contrasenaActual', 'passwordActual']);
  const newPassword = getBodyValue(payload, ['newPassword', 'contrasenaNueva', 'passwordNueva']);

  if (!currentPassword || !newPassword) {
    throw badRequest('Debe indicar la contraseña actual y la nueva.');
  }

  if (String(newPassword).length < 8) {
    throw badRequest('La contraseña debe tener al menos 8 caracteres.');
  }

  const user = await profileRepository.findPasswordData(auth.sub);
  if (!user) throw notFound('Usuario no encontrado.');

  if (!(await bcrypt.compare(String(currentPassword), user.password_hash))) {
    throw badRequest('La contraseña actual no es correcta.');
  }

  const passwordHash = await bcrypt.hash(String(newPassword), 10);
  const tokenVersion = await profileRepository.setPasswordHash(auth.sub, passwordHash);

  return buildToken({
    id: auth.sub,
    email: user.email,
    nombre_completo: user.nombre_completo,
    roles: auth.roles,
    token_version: tokenVersion,
  });
}
