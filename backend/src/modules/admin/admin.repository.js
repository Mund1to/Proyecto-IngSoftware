// Acceso a datos de administración de cuentas. Las funciones reciben `db`
// (por defecto el pool) para poder participar en una transacción.
import { pool } from '../../core/database/database.js';

// Fecha de la última solicitud de cambio de contraseña sin atender (últimos 7 días).
// El enlace del correo vence en 60 minutos, pero el administrador puede atenderla después.
const PENDING_RESET_SQL = `(SELECT MAX(pr.created_at) FROM password_resets pr
              WHERE pr.usuario_id = u.id AND pr.used_at IS NULL
                AND pr.created_at > NOW() - INTERVAL '7 days')`;

const ADMIN_USER_SELECT = `SELECT u.id, u.email, u.nombre_completo, u.activo, u.created_at,
            COALESCE(array_agg(DISTINCT r.nombre) FILTER (WHERE r.nombre IS NOT NULL), ARRAY[]::VARCHAR[]) AS roles,
            COALESCE(array_agg(DISTINCT p.tipo::text) FILTER (WHERE p.tipo IS NOT NULL), ARRAY[]::text[]) AS profile_types,
            ${PENDING_RESET_SQL} AS solicitud_contrasena
     FROM usuarios u
     LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
     LEFT JOIN roles r ON r.id = ur.rol_id
     LEFT JOIN perfiles p ON p.usuario_id = u.id`;

export async function findUser(userId, db = pool) {
  const result = await db.query(`${ADMIN_USER_SELECT}
     WHERE u.id = $1
     GROUP BY u.id`, [userId]);
  return result.rows[0] ?? null;
}

// Busca por correo o nombre; una búsqueda vacía devuelve las cuentas más recientes.
export async function searchUsers(search) {
  const result = await pool.query(`${ADMIN_USER_SELECT}
     WHERE $1 = '' OR u.email ILIKE '%' || $1 || '%' OR u.nombre_completo ILIKE '%' || $1 || '%'
     GROUP BY u.id
     ORDER BY u.created_at DESC
     LIMIT 200`, [search]);
  return result.rows;
}

// Cuenta los administradores activos distintos al usuario indicado, para no
// dejar el sistema sin ningún administrador.
export async function countOtherActiveAdmins(userId, db = pool) {
  const result = await db.query(
    `SELECT COUNT(DISTINCT u.id)::int AS total
     FROM usuarios u
     INNER JOIN usuario_roles ur ON ur.usuario_id = u.id
     INNER JOIN roles r ON r.id = ur.rol_id
     WHERE r.nombre = 'ADMINISTRADOR' AND u.activo AND u.id <> $1`,
    [userId]
  );
  return result.rows[0].total;
}

export async function replaceRoles(userId, roles, db = pool) {
  await db.query('DELETE FROM usuario_roles WHERE usuario_id = $1', [userId]);
  await db.query(
    `INSERT INTO usuario_roles (usuario_id, rol_id)
     SELECT $1, id FROM roles WHERE nombre = ANY($2::varchar[])`,
    [userId, roles]
  );
}

export async function setActive(userId, active) {
  const result = await pool.query(
    'UPDATE usuarios SET activo = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
    [active, userId]
  );
  return result.rowCount > 0;
}

// Cambia la contraseña y sube token_version, lo que cierra las sesiones abiertas.
export async function setPasswordHash(userId, passwordHash, db = pool) {
  const result = await db.query(
    `UPDATE usuarios SET password_hash = $1, token_version = token_version + 1, updated_at = NOW()
     WHERE id = $2 RETURNING email, nombre_completo`,
    [passwordHash, userId]
  );
  return result.rows[0] ?? null;
}

export async function invalidatePendingResets(userId, db = pool) {
  await db.query('UPDATE password_resets SET used_at = NOW() WHERE usuario_id = $1 AND used_at IS NULL', [userId]);
}
