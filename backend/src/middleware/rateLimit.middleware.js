// Limitador en memoria para frenar ataques de fuerza bruta sobre el login.
// Basta para una sola instancia; con varias instancias habría que usar un
// almacenamiento compartido.
export function createRateLimiter({ windowMs, max, keyGenerator, message }) {
  const hits = new Map();

  const limiter = (request, response, next) => {
    const now = Date.now();
    const key = keyGenerator(request);
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;

    if (entry.count > max) {
      response.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return response.status(429).json({ ok: false, message });
    }

    return next();
  };

  limiter.reset = () => hits.clear();
  return limiter;
}

export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (request) => `${request.ip}:${String(request.body?.email ?? request.body?.correo ?? '').trim().toLowerCase()}`,
  message: 'Demasiados intentos de inicio de sesión. Espera unos minutos e inténtalo de nuevo.',
});

export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (request) => `${request.ip}:${String(request.body?.email ?? request.body?.correo ?? '').trim().toLowerCase()}`,
  message: 'Demasiadas solicitudes de recuperación. Espera unos minutos e inténtalo de nuevo.',
});
