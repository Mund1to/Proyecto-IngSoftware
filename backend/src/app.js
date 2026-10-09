import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { testDatabaseConnection } from './config/database.js';
import { initializeDatabaseSchema } from './config/migrate.js';
import { authenticate, requireRole } from './middleware/auth.middleware.js';
import adminRouter from './routes/admin.routes.js';
import applicationsRouter from './routes/applications.routes.js';
import authRouter from './routes/auth.routes.js';
import convocatoriasRouter from './routes/convocatorias.routes.js';
import healthRouter from './routes/health.routes.js';
import offersRouter from './routes/offers.routes.js';
import profileRouter from './routes/profile.routes.js';
import statsRouter from './routes/stats.routes.js';
import verificationsRouter from './routes/verifications.routes.js';

export const app = express();

// Render y Vercel actúan como proxy; sin esto request.ip sería la IP del proxy
// y el limitador de login agruparía a todos los usuarios.
app.set('trust proxy', 1);

app.use(cors(env.corsOrigins.length > 0 ? { origin: env.corsOrigins } : undefined));
app.use(express.json({ limit: '1mb' }));

// Un cliente que no envía UTF-8 deja caracteres de reemplazo (U+FFFD) en el
// texto; se rechaza la petición en lugar de guardar datos dañados.
function containsReplacementChar(value) {
  if (typeof value === 'string') return value.includes('�');
  if (Array.isArray(value)) return value.some(containsReplacementChar);
  if (value && typeof value === 'object') return Object.values(value).some(containsReplacementChar);
  return false;
}

app.use((request, response, next) => {
  if (containsReplacementChar(request.body)) {
    return response.status(400).json({
      ok: false,
      message: 'El texto contiene caracteres con codificación inválida. Envía la petición en UTF-8.',
    });
  }
  return next();
});

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/offers', offersRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/verifications', verificationsRouter);
app.use('/api/convocatorias', convocatoriasRouter);
app.use('/api/stats', statsRouter);
app.use('/api/admin', adminRouter);

app.get('/api/db-check', async (_request, response) => {
  const result = await testDatabaseConnection();

  if (!result.ok) {
    return response.status(500).json({ ok: false, message: result.message });
  }

  return response.json({ ok: true, now: result.now });
});

// Las migraciones se ejecutan al arrancar. Este endpoint solo permite repetirlas
// a un administrador autenticado.
app.post('/api/init-db', authenticate, requireRole('ADMINISTRADOR'), async (_request, response) => {
  const result = await initializeDatabaseSchema();
  if (!result.ok) {
    return response.status(500).json(result);
  }
  return response.json(result);
});

app.use('/api', (_request, response) => {
  response.status(404).json({ ok: false, message: 'Ruta no encontrada.' });
});

app.use((error, _request, response, _next) => {
  if (error?.type === 'entity.parse.failed') {
    return response.status(400).json({ ok: false, message: 'El cuerpo de la petición no es JSON válido.' });
  }

  console.error('Unhandled error:', error);
  return response.status(500).json({ ok: false, message: 'Error interno del servidor.' });
});
