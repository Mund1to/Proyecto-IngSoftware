import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';
import { env } from '../config/env.js';
import { getBodyValue } from '../utils/payload.js';

const PROFILE_TYPES = new Map([
  ['student', 'ESTUDIANTE'],
  ['estudiante', 'ESTUDIANTE'],
  ['company', 'ORGANIZACION'],
  ['empresa', 'ORGANIZACION'],
  ['organizacion', 'ORGANIZACION'],
  ['external', 'CANDIDATO_EXTERNO'],
  ['candidato_externo', 'CANDIDATO_EXTERNO'],
]);

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

function buildToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      nombreCompleto: user.nombre_completo,
      roles: user.roles ?? [],
      profileTypes: user.profileTypes ?? [],
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
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

export async function registerController(request, response) {
  const payload = request.body ?? {};
  const profilePayload = getProfilePayload(payload);
  const email = normalizeEmail(getBodyValue(payload, ['email', 'correo']));
  const password = getBodyValue(payload, ['password', 'contrasena']);
  const nombreCompleto = String(getBodyValue(payload, ['nombreCompleto', 'nombre_completo', 'nombre']) ?? '').trim();
  const telefono = getBodyValue(payload, ['telefono', 'phone']) ?? null;
  const profileType = normalizeProfileType(getBodyValue(payload, ['profileType', 'tipoPerfil', 'role', 'tipo']))
    .toUpperCase();

  if (!email || !password || !nombreCompleto) {
    return response.status(400).json({
      ok: false,
      message: 'Se requieren email, password y nombre completo.',
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return response.status(400).json({
      ok: false,
      message: 'El email no tiene un formato válido.',
    });
  }

  if (String(password).length < 8) {
    return response.status(400).json({
      ok: false,
      message: 'La contraseña debe tener al menos 8 caracteres.',
    });
  }

  if (!['ESTUDIANTE', 'ORGANIZACION', 'CANDIDATO_EXTERNO'].includes(profileType)) {
    return response.status(400).json({
      ok: false,
      message: 'El tipo de perfil no es válido.',
    });
  }

  const razonSocial = String(
    getBodyValue(profilePayload, ['razonSocial', 'razon_social', 'companyName', 'nombreEmpresa']) ?? nombreCompleto
  ).trim();

  if (profileType === 'ORGANIZACION' && !razonSocial) {
    return response.status(400).json({
      ok: false,
      message: 'La empresa debe indicar su razón social.',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingUser = await client.query('SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1)', [email]);

    if (existingUser.rowCount > 0) {
      await client.query('ROLLBACK');
      return response.status(409).json({
        ok: false,
        message: 'Ya existe un usuario con ese email.',
      });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const userResult = await client.query(
      `INSERT INTO usuarios (email, password_hash, nombre_completo, telefono)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, nombre_completo, telefono, activo, created_at`,
      [email, passwordHash, nombreCompleto, telefono ? String(telefono).trim() : null]
    );

    const user = userResult.rows[0];
    const roleResult = await client.query('SELECT id, nombre FROM roles WHERE nombre = $1 LIMIT 1', ['USUARIO']);

    if (roleResult.rowCount === 0) {
      throw new Error('No existe el rol USUARIO en la base de datos.');
    }

    const role = roleResult.rows[0];
    await client.query('INSERT INTO usuario_roles (usuario_id, rol_id) VALUES ($1, $2)', [user.id, role.id]);

    const profileResult = await client.query(
      `INSERT INTO perfiles (usuario_id, tipo)
       VALUES ($1, $2)
       RETURNING id, tipo, visible`,
      [user.id, profileType]
    );

    const profile = profileResult.rows[0];

    if (profileType === 'ESTUDIANTE') {
      await client.query(
        `INSERT INTO perfiles_estudiante
          (perfil_id, universidad, programa_academico, semestre, codigo_estudiante, fecha_graduacion_estimada)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          profile.id,
          getBodyValue(profilePayload, ['universidad']) ?? null,
          getBodyValue(profilePayload, ['programaAcademico', 'programa_academico']) ?? null,
          getBodyValue(profilePayload, ['semestre']) ?? null,
          getBodyValue(profilePayload, ['codigoEstudiante', 'codigo_estudiante']) ?? null,
          getBodyValue(profilePayload, ['fechaGraduacionEstimada', 'fecha_graduacion_estimada']) ?? null,
        ]
      );
    }

    if (profileType === 'ORGANIZACION') {
      await client.query(
        `INSERT INTO organizaciones
          (perfil_id, razon_social, identificacion_fiscal, sitio_web, descripcion)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          profile.id,
          razonSocial,
          getBodyValue(profilePayload, ['identificacionFiscal', 'identificacion_fiscal']) ?? null,
          getBodyValue(profilePayload, ['sitioWeb', 'sitio_web']) ?? null,
          getBodyValue(profilePayload, ['descripcion']) ?? null,
        ]
      );
    }

    if (profileType === 'CANDIDATO_EXTERNO') {
      await client.query(
        `INSERT INTO perfiles_candidato
          (perfil_id, resumen, ubicacion, disponibilidad, cv_url)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          profile.id,
          getBodyValue(profilePayload, ['resumen']) ?? null,
          getBodyValue(profilePayload, ['ubicacion']) ?? null,
          getBodyValue(profilePayload, ['disponibilidad']) ?? null,
          getBodyValue(profilePayload, ['cvUrl', 'cv_url']) ?? null,
        ]
      );
    }

    await client.query('COMMIT');

    const roles = [role.nombre];
    const profileTypes = [profile.tipo];
    const token = buildToken({ ...user, roles, profileTypes });

    return response.status(201).json({
      ok: true,
      token,
      user: publicUser(user, roles, profileTypes),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('registerController error:', error);

    if (error?.code === '23505') {
      return response.status(409).json({
        ok: false,
        message: 'Los datos enviados ya están registrados.',
      });
    }

    return response.status(500).json({
      ok: false,
      message: 'No se pudo registrar el usuario.',
    });
  } finally {
    client.release();
  }
}

export async function loginController(request, response) {
  const payload = request.body ?? {};
  const email = normalizeEmail(getBodyValue(payload, ['email', 'correo']));
  const password = getBodyValue(payload, ['password', 'contrasena']);

  if (!email || !password) {
    return response.status(400).json({
      ok: false,
      message: 'Debe indicar email y password.',
    });
  }

  try {
    const userResult = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.nombre_completo, u.telefono, u.activo,
              COALESCE(array_agg(DISTINCT r.nombre ORDER BY r.nombre) FILTER (WHERE r.nombre IS NOT NULL), ARRAY[]::VARCHAR[]) AS roles,
              COALESCE(array_agg(DISTINCT p.tipo) FILTER (WHERE p.tipo IS NOT NULL), ARRAY[]::profile_type[]) AS profile_types
       FROM usuarios u
       LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
       LEFT JOIN roles r ON r.id = ur.rol_id
       LEFT JOIN perfiles p ON p.usuario_id = u.id
       WHERE LOWER(u.email) = LOWER($1)
       GROUP BY u.id, u.email, u.password_hash, u.nombre_completo, u.telefono, u.activo`,
      [email]
    );

    if (userResult.rowCount === 0) {
      return response.status(401).json({
        ok: false,
        message: 'Credenciales inválidas.',
      });
    }

    const user = userResult.rows[0];

    if (!user.activo) {
      return response.status(403).json({
        ok: false,
        message: 'El usuario está inactivo.',
      });
    }

    const isValidPassword = await bcrypt.compare(String(password), user.password_hash);

    if (!isValidPassword) {
      return response.status(401).json({
        ok: false,
        message: 'Credenciales inválidas.',
      });
    }

    const roles = Array.isArray(user.roles) ? user.roles : [];
    const profileTypes = Array.isArray(user.profile_types) ? user.profile_types : [];
    const token = buildToken({ ...user, roles, profileTypes });

    return response.json({
      ok: true,
      token,
      user: publicUser(user, roles, profileTypes),
    });
  } catch (error) {
    console.error('loginController error:', error);
    return response.status(500).json({
      ok: false,
      message: 'No se pudo iniciar sesión.',
    });
  }
}

