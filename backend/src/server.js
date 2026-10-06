import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { pool, testDatabaseConnection } from './config/database.js';
import authRouter from './routes/auth.routes.js';
import healthRouter from './routes/health.routes.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);

app.get('/api/db-check', async (_request, response) => {
  const result = await testDatabaseConnection();

  if (!result.ok) {
    return response.status(500).json({ ok: false, message: result.message });
  }

  return response.json({ ok: true, now: result.now });
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
  } else {
    console.warn(`PostgreSQL connection failed: ${dbCheck.message}`);
  }
});

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});
