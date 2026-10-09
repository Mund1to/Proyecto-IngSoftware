import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';
import { env } from '../config/env.js';

// Carga los roles vigentes y el estado de la cuenta desde la base de datos.
// Los roles del token solo sirven como pista: si un administrador retira un rol
// o desactiva la cuenta, el cambio aplica de inmediato aunque el token siga vigente.
export async function loadAccount(userId) {
  const result = await pool.query(
    `SELECT u.activo,
            COALESCE(array_agg(DISTINCT r.nombre) FILTER (WHERE r.nombre IS NOT NULL), ARRAY[]::VARCHAR[]) AS roles
     FROM usuarios u
     LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
     LEFT JOIN roles r ON r.id = ur.rol_id
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId]
  );

  return result.rows[0] ?? null;
}

export async function authenticate(request, response, next) {
  const authorization = request.get('authorization');
  const [scheme, token] = authorization?.split(' ') ?? [];

  if (scheme !== 'Bearer' || !token) {
    return response.status(401).json({
      ok: false,
      message: 'Se requiere un token Bearer válido.',
    });
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (_error) {
    return response.status(401).json({
      ok: false,
      message: 'El token no es válido o ha expirado.',
    });
  }

  if (!/^\d+$/.test(String(payload?.sub ?? ''))) {
    return response.status(401).json({ ok: false, message: 'El token no es válido o ha expirado.' });
  }

  try {
    const account = await loadAccount(payload.sub);

    if (!account) {
      return response.status(401).json({ ok: false, message: 'La cuenta asociada al token ya no existe.' });
    }

    if (!account.activo) {
      return response.status(403).json({ ok: false, message: 'El usuario está inactivo.' });
    }

    request.auth = { ...payload, roles: account.roles };
    return next();
  } catch (error) {
    return next(error);
  }
}

export function hasRole(request, ...roles) {
  const userRoles = Array.isArray(request.auth?.roles) ? request.auth.roles : [];
  return roles.some((role) => userRoles.includes(role));
}

export function requireRole(...allowedRoles) {
  return (request, response, next) => {
    if (!hasRole(request, ...allowedRoles)) {
      return response.status(403).json({
        ok: false,
        message: 'No tiene permisos para realizar esta operación.',
      });
    }

    return next();
  };
}
