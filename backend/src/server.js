import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { pool, testDatabaseConnection } from './config/database.js';
import { initializeDatabaseSchema } from './config/migrate.js';
import applicationsRouter from './routes/applications.routes.js';
import authRouter from './routes/auth.routes.js';
import healthRouter from './routes/health.routes.js';
import offersRouter from './routes/offers.routes.js';
import profileRouter from './routes/profile.routes.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/offers', offersRouter);
app.use('/api/applications', applicationsRouter);

app.get('/api/db-check', async (_request, response) => {
  const result = await testDatabaseConnection();

  if (!result.ok) {
    return response.status(500).json({ ok: false, message: result.message });
  }

  return response.json({ ok: true, now: result.now });
});

app.get('/api/init-db', async (_request, response) => {
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
  console.error('Unhandled error:', error);
  response.status(500).json({ ok: false, message: 'Error interno del servidor.' });
});

app.listen(env.port, async () => {
  console.log(`SIPU backend listening on port ${env.port}`);

  if (!env.databaseUrl) {
    console.warn('DATABASE_URL is not configured. PostgreSQL connection is not active yet.');
    return;
  }

  const dbCheck = await testDatabaseConnection();

  if (dbCheck.ok) {
    console.log('PostgreSQL connected successfully.');
    await initializeDatabaseSchema();
  } else {
    console.warn(`PostgreSQL connection failed: ${dbCheck.message}`);
  }
});

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});
