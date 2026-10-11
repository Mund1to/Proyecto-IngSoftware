// Acceso a datos de cuentas y recuperación de contraseña. Las funciones reciben
// `db` (por defecto el pool) para poder participar en una transacción.
import { pool } from '../../core/database/database.js';

export async function emailExists(email, db = pool) {
  const result = await db.query('SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1)', [email]);
  return result.rowCount > 0;
}

export async function insertUser({ email, passwordHash, nombreCompleto, telefono }, db = pool) {
  const result = await db.query(
    `INSERT INTO usuarios (email, password_hash, nombre_completo, telefono)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, nombre_completo, telefono, activo, created_at`,
    [email, passwordHash, nombreCompleto, telefono]
  );
  return result.rows[0];
}

export async function findRoleByName(name, db = pool) {
  const result = await db.query('SELECT id, nombre FROM roles WHERE nombre = $1 LIMIT 1', [name]);
  return result.rows[0] ?? null;
}

export async function assignRole(userId, roleId, db = pool) {
  await db.query('INSERT INTO usuario_roles (usuario_id, rol_id) VALUES ($1, $2)', [userId, roleId]);
}

export async function insertProfile(userId, type, db = pool) {
  const result = await db.query(
    `INSERT INTO perfiles (usuario_id, tipo)
     VALUES ($1, $2)
     RETURNING id, tipo, visible`,
    [userId, type]
  );
  return result.rows[0];
}

export async function insertStudentProfile(profileId, data, db = pool) {
  await db.query(
    `INSERT INTO perfiles_estudiante
      (perfil_id, universidad, programa_academico, semestre, codigo_estudiante, fecha_graduacion_estimada)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [profileId, data.universidad, data.programaAcademico, data.semestre, data.codigoEstudiante, data.fechaGraduacionEstimada]
  );
}

export async function insertOrganization(profileId, data, db = pool) {
  await db.query(
    `INSERT INTO organizaciones
      (perfil_id, razon_social, identificacion_fiscal, sitio_web, descripcion)
     VALUES ($1, $2, $3, $4, $5)`,
    [profileId, data.razonSocial, data.identificacionFiscal, data.sitioWeb, data.descripcion]
  );
}

export async function insertCandidateProfile(profileId, data, db = pool) {
  await db.query(
    `INSERT INTO perfiles_candidato
      (perfil_id, resumen, ubicacion, disponibilidad, cv_url)
     VALUES ($1, $2, $3, $4, $5)`,
    [profileId, data.resumen, data.ubicacion, data.disponibilidad, data.cvUrl]
  );
}

// Usuario con hash, roles y tipos de perfil, para iniciar sesión.
export async function findLoginUser(email) {
  const result = await pool.query(
    `SELECT u.id, u.email, u.password_hash, u.nombre_completo, u.telefono, u.activo, u.token_version,
            COALESCE(array_agg(DISTINCT r.nombre ORDER BY r.nombre) FILTER (WHERE r.nombre IS NOT NULL), ARRAY[]::VARCHAR[]) AS roles,
            COALESCE(array_agg(DISTINCT p.tipo::text) FILTER (WHERE p.tipo IS NOT NULL), ARRAY[]::text[]) AS profile_types
     FROM usuarios u
     LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
     LEFT JOIN roles r ON r.id = ur.rol_id
     LEFT JOIN perfiles p ON p.usuario_id = u.id
     WHERE LOWER(u.email) = LOWER($1)
     GROUP BY u.id, u.email, u.password_hash, u.nombre_completo, u.telefono, u.activo, u.token_version`,
    [email]
  );
  return result.rows[0] ?? null;
}

export async function findActiveUserByEmail(email) {
  const result = await pool.query(
    'SELECT id, nombre_completo FROM usuarios WHERE LOWER(email) = LOWER($1) AND activo',
    [email]
  );
  return result.rows[0] ?? null;
}

export async function invalidatePendingResets(userId) {
  await pool.query('UPDATE password_resets SET used_at = NOW() WHERE usuario_id = $1 AND used_at IS NULL', [userId]);
}

export async function insertPasswordReset(userId, tokenHash, ttlMinutes) {
  await pool.query(
    `INSERT INTO password_resets (usuario_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval)`,
    [userId, tokenHash, String(ttlMinutes)]
  );
}

// Bloquea la fila para que dos usos simultáneos del mismo enlace no prosperen.
export async function findValidResetForUpdate(tokenHash, db) {
  const result = await db.query(
    `SELECT id, usuario_id FROM password_resets
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
     FOR UPDATE`,
    [tokenHash]
  );
  return result.rows[0] ?? null;
}

// Cambia la contraseña y sube token_version, lo que cierra las sesiones abiertas.
export async function updatePasswordHash(userId, passwordHash, db = pool) {
  await db.query(
    'UPDATE usuarios SET password_hash = $1, token_version = token_version + 1, updated_at = NOW() WHERE id = $2',
    [passwordHash, userId]
  );
}

export async function markResetUsed(resetId, db = pool) {
  await db.query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [resetId]);
}

// Correos de los administradores activos, sin incluir a quien hace la solicitud.
export async function listActiveAdminEmails(excludeEmail) {
  const result = await pool.query(
    `SELECT DISTINCT u.email
     FROM usuarios u
     INNER JOIN usuario_roles ur ON ur.usuario_id = u.id
     INNER JOIN roles r ON r.id = ur.rol_id
     WHERE r.nombre = 'ADMINISTRADOR' AND u.activo AND LOWER(u.email) <> LOWER($1)`,
    [excludeEmail]
  );
  return result.rows.map((row) => row.email);
}
