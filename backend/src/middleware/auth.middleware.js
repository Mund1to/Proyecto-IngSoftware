import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function authenticate(request, response, next) {
  const authorization = request.get('authorization');
  const [scheme, token] = authorization?.split(' ') ?? [];

  if (scheme !== 'Bearer' || !token) {
    return response.status(401).json({
      ok: false,
      message: 'Se requiere un token Bearer válido.',
    });
  }

  try {
    request.auth = jwt.verify(token, env.jwtSecret);
    return next();
  } catch (_error) {
    return response.status(401).json({
      ok: false,
      message: 'El token no es válido o ha expirado.',
    });
  }
}

export function requireRole(...allowedRoles) {
  return (request, response, next) => {
    const userRoles = Array.isArray(request.auth?.roles) ? request.auth.roles : [];
    const hasAllowedRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasAllowedRole) {
      return response.status(403).json({
        ok: false,
        message: 'No tiene permisos para realizar esta operación.',
      });
    }

    return next();
  };
}
