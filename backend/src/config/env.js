import 'dotenv/config';

const DEFAULT_JWT_SECRET = 'change-me-in-production';
const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

// En producción un secreto ausente o por defecto permitiría firmar tokens con
// cualquier rol. Es preferible que el servicio no arranque.
if (nodeEnv === 'production' && jwtSecret === DEFAULT_JWT_SECRET) {
  throw new Error('JWT_SECRET debe configurarse con un valor privado en producción.');
}

// CORS_ORIGIN admite una lista separada por comas. Vacío equivale a cualquier origen.
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = {
  nodeEnv,
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigins,
  // URL pública del frontend; se usa en los enlaces de los correos.
  appUrl: (process.env.APP_URL || corsOrigins[0] || 'http://localhost:5173').replace(/\/+$/, ''),
  resendApiKey: process.env.RESEND_API_KEY || '',
  mailFrom: process.env.MAIL_FROM || 'SIPU <onboarding@resend.dev>',
};
