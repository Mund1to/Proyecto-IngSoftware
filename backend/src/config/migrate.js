import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const databaseDir = path.resolve(__dirname, '../../database');
const migrationsDir = path.join(databaseDir, 'migrations');

export function listMigrationFiles() {
  return fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

// Crea el esquema si la base está vacía y aplica, en orden, las migraciones de
// database/migrations que aún no figuren en schema_migrations. Todas las
// migraciones son idempotentes, así que aplicarlas sobre un esquema recién
// creado no altera nada.
export async function initializeDatabaseSchema() {
  const client = await pool.connect();
  try {
    const checkResult = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usuarios'`
    );

    let createdSchema = false;
    if (checkResult.rowCount === 0) {
      console.log('Initializing database schema in PostgreSQL...');
      await client.query(fs.readFileSync(path.join(databaseDir, 'schema.sql'), 'utf8'));
      createdSchema = true;
    }

    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         nombre TEXT PRIMARY KEY,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`
    );

    const appliedResult = await client.query('SELECT nombre FROM schema_migrations');
    const applied = new Set(appliedResult.rows.map((row) => row.nombre));
    const pending = listMigrationFiles().filter((file) => !applied.has(file));

    for (const file of pending) {
      console.log(`Applying migration ${file}...`);
      await client.query(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations (nombre) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
    }

    const message = createdSchema
      ? 'Schema created successfully'
      : pending.length > 0 ? `Applied ${pending.length} migration(s)` : 'Already initialized';
    console.log(`Database: ${message}.`);
    return { ok: true, message, applied: pending };
  } catch (error) {
    console.error('Error during database schema initialization:', error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Migration failed',
    };
  } finally {
    client.release();
  }
}
