import { app } from './app.js';
import { env } from './core/config/env.js';
import { pool, testDatabaseConnection } from './core/database/database.js';
import { initializeDatabaseSchema } from './core/database/migrate.js';

const server = app.listen(env.port, async () => {
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

// Render envía SIGTERM antes de reemplazar la instancia en cada despliegue.
// Se dejan de aceptar conexiones, se terminan las peticiones en curso y se
// cierra el pool; si algo se cuelga, se fuerza la salida a los 10 segundos.
const SHUTDOWN_TIMEOUT_MS = 10000;
let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received. Closing SIPU backend...`);

  setTimeout(() => {
    console.error('Graceful shutdown timed out; forcing exit.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  server.close(async () => {
    await pool.end().catch((error) => console.error('Error closing PostgreSQL pool:', error));
    process.exit(0);
  });
  server.closeIdleConnections?.();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
