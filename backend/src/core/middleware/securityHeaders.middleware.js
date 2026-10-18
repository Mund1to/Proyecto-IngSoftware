import { env } from '../config/env.js';

// Cabeceras de seguridad básicas para una API JSON. Cubren lo esencial de
// helmet sin añadir dependencias:
// - nosniff: el navegador no reinterpreta un documento subido como HTML o script;
// - DENY y frame-ancestors: ninguna página puede incrustar la API en un iframe;
// - no-referrer: los enlaces de recuperación (?reset=) no se filtran a terceros;
// - default-src 'none': una respuesta abierta directamente no ejecuta nada;
// - HSTS (solo en producción, que se sirve siempre por HTTPS).
// No se fija Cross-Origin-Resource-Policy porque el frontend vive en otro origen.
const HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  ...(env.nodeEnv === 'production' ? { 'Strict-Transport-Security': 'max-age=15552000; includeSubDomains' } : {}),
};

export function securityHeaders(_request, response, next) {
  response.set(HEADERS);
  next();
}
