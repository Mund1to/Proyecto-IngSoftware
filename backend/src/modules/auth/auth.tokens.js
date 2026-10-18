// Emisión de tokens de sesión. Cambiar el formato o la librería de JWT solo afecta este archivo.
import jwt from 'jsonwebtoken';
import { env } from '../../core/config/env.js';

// `ver` es token_version: al subirla en la base de datos se invalidan las sesiones abiertas.
export function buildToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      nombreCompleto: user.nombre_completo,
      roles: user.roles ?? [],
      profileTypes: user.profileTypes ?? [],
      ver: Number(user.token_version ?? 0),
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}
