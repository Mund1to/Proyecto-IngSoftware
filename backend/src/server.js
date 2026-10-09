import { app } from './app.js';
import { env } from './config/env.js';
import { pool, testDatabaseConnection } from './config/database.js';
import { initializeDatabaseSchema } from './config/migrate.js';

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
