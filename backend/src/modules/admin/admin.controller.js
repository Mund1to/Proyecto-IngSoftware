import bcrypt from 'bcrypt';
import { pool } from '../../core/database/database.js';
import { sendEmail } from '../../core/mail/mailer.js';
import { getBodyValue } from '../../core/http/payload.js';

export const ASSIGNABLE_ROLES = ['USUARIO', 'ADMINISTRADOR', 'FUNCIONARIO_PUBLICO'];

// Fecha de la última solicitud de cambio de contraseña sin atender (últimos 7 días).
// El enlace del correo vence en 60 minutos, pero el administrador puede atenderla después.
const PENDING_RESET_SQL = `(SELECT MAX(pr.created_at) FROM password_resets pr
              WHERE pr.usuario_id = u.id AND pr.used_at IS NULL
                AND pr.created_at > NOW() - INTERVAL '7 days')`;

// Mismas reglas que el formulario: 8 caracteres, una mayúscula y un número.
export function isStrongPassword(value) {
  const text = String(value ?? '');
  return text.length >= 8 && /[A-Z]/.test(text) && /\d/.test(text);
}

async function findAdminUser(userId, client = pool) {
  const result = await client.query(
    `SELECT u.id, u.email, u.nombre_completo, u.activo, u.created_at,
            COALESCE(array_agg(DISTINCT r.nombre) FILTER (WHERE r.nombre IS NOT NULL), ARRAY[]::VARCHAR[]) AS roles,
            COALESCE(array_agg(DISTINCT p.tipo::text) FILTER (WHERE p.tipo IS NOT NULL), ARRAY[]::text[]) AS profile_types,
            ${PENDING_RESET_SQL} AS solicitud_contrasena
     FROM usuarios u
     LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
     LEFT JOIN roles r ON r.id = ur.rol_id
     LEFT JOIN perfiles p ON p.usuario_id = u.id
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId]
  );

  return result.rows[0] ?? null;
}

// Cuenta los administradores activos distintos al usuario indicado, para no
// dejar el sistema sin ningún administrador.
async function countOtherActiveAdmins(userId, client = pool) {
  const result = await client.query(
    `SELECT COUNT(DISTINCT u.id)::int AS total
     FROM usuarios u
     INNER JOIN usuario_roles ur ON ur.usuario_id = u.id
     INNER JOIN roles r ON r.id = ur.rol_id
     WHERE r.nombre = 'ADMINISTRADOR' AND u.activo AND u.id <> $1`,
    [userId]
  );

  return result.rows[0].total;
}

export async function listUsersController(request, response) {
  const search = String(request.query.q ?? '').trim();

  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.nombre_completo, u.activo, u.created_at,
              COALESCE(array_agg(DISTINCT r.nombre) FILTER (WHERE r.nombre IS NOT NULL), ARRAY[]::VARCHAR[]) AS roles,
              COALESCE(array_agg(DISTINCT p.tipo::text) FILTER (WHERE p.tipo IS NOT NULL), ARRAY[]::text[]) AS profile_types,
              ${PENDING_RESET_SQL} AS solicitud_contrasena
       FROM usuarios u
       LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
       LEFT JOIN roles r ON r.id = ur.rol_id
       LEFT JOIN perfiles p ON p.usuario_id = u.id
       WHERE $1 = '' OR u.email ILIKE '%' || $1 || '%' OR u.nombre_completo ILIKE '%' || $1 || '%'
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT 200`,
      [search]
    );

    return response.json({ ok: true, users: result.rows });
  } catch (error) {
    console.error('listUsersController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudieron listar los usuarios.' });
  }
}

export async function updateUserRolesController(request, response) {
  const { userId } = request.params;
  const rawRoles = getBodyValue(request.body ?? {}, ['roles']);

  if (!Array.isArray(rawRoles)) {
    return response.status(400).json({ ok: false, message: 'Debe enviar la lista de roles.' });
  }

  const roles = [...new Set(rawRoles.map((role) => String(role).trim().toUpperCase()))];

  if (roles.some((role) => !ASSIGNABLE_ROLES.includes(role))) {
    return response.status(400).json({ ok: false, message: `Los roles válidos son ${ASSIGNABLE_ROLES.join(', ')}.` });
  }

  // Toda cuenta conserva el rol básico.
  if (!roles.includes('USUARIO')) roles.push('USUARIO');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const user = await findAdminUser(userId, client);
    if (!user) {
      await client.query('ROLLBACK');
      return response.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }

    const removesAdmin = user.roles.includes('ADMINISTRADOR') && !roles.includes('ADMINISTRADOR');
    if (removesAdmin && (await countOtherActiveAdmins(userId, client)) === 0) {
      await client.query('ROLLBACK');
      return response.status(409).json({ ok: false, message: 'Debe existir al menos un administrador activo.' });
    }

    await client.query('DELETE FROM usuario_roles WHERE usuario_id = $1', [userId]);
    await client.query(
      `INSERT INTO usuario_roles (usuario_id, rol_id)
       SELECT $1, id FROM roles WHERE nombre = ANY($2::varchar[])`,
      [userId, roles]
    );

    await client.query('COMMIT');

    return response.json({ ok: true, user: await findAdminUser(userId) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('updateUserRolesController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudieron actualizar los roles.' });
  } finally {
    client.release();
  }
}

export async function updateUserActiveController(request, response) {
  const { userId } = request.params;
  const active = getBodyValue(request.body ?? {}, ['activo', 'active']);

  if (typeof active !== 'boolean') {
    return response.status(400).json({ ok: false, message: 'Debe indicar activo como true o false.' });
  }

  if (String(userId) === String(request.auth.sub) && !active) {
    return response.status(409).json({ ok: false, message: 'No puedes desactivar tu propia cuenta.' });
  }

  try {
    const result = await pool.query(
      `UPDATE usuarios SET activo = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
      [active, userId]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }

    return response.json({ ok: true, user: await findAdminUser(userId) });
  } catch (error) {
    console.error('updateUserActiveController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo actualizar el estado del usuario.' });
  }
}

// El administrador asigna una contraseña nueva a otra cuenta (por ejemplo, cuando
// la persona pidió recuperarla y el correo no le llegó). Cierra sus sesiones
// abiertas, invalida los enlaces de recuperación pendientes y le avisa por correo.
export async function setUserPasswordController(request, response) {
  const { userId } = request.params;
  const password = getBodyValue(request.body ?? {}, ['password', 'contrasena', 'newPassword']);

  if (String(userId) === String(request.auth.sub)) {
    return response.status(409).json({ ok: false, message: 'Cambia tu propia contraseña desde tu perfil.' });
  }

  if (!isStrongPassword(password)) {
    return response.status(400).json({ ok: false, message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const passwordHash = await bcrypt.hash(String(password), 10);
    const updated = await client.query(
      `UPDATE usuarios SET password_hash = $1, token_version = token_version + 1, updated_at = NOW()
       WHERE id = $2 RETURNING email, nombre_completo`,
      [passwordHash, userId]
    );

    if (updated.rowCount === 0) {
      await client.query('ROLLBACK');
      return response.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }

    await client.query('UPDATE password_resets SET used_at = NOW() WHERE usuario_id = $1 AND used_at IS NULL', [userId]);
    await client.query('COMMIT');

    const { email, nombre_completo: name } = updated.rows[0];
    await sendEmail({
      to: email,
      subject: 'Un administrador cambió tu contraseña de SIPU',
      text: `Hola ${name}:\n\nUn administrador de SIPU asignó una contraseña nueva a tu cuenta y cerró tus sesiones abiertas. Te la entregará por un canal seguro; al entrar, cámbiala desde tu perfil.\n\nSi no pediste este cambio, comunícate con la universidad.`,
    }).catch((error) => console.error('setUserPassword sendEmail error:', error));

    return response.json({ ok: true, message: 'Contraseña actualizada.', user: await findAdminUser(userId) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('setUserPasswordController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo cambiar la contraseña.' });
  } finally {
    client.release();
  }
}
