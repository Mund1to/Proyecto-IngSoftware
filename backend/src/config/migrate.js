import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initializeDatabaseSchema() {
  const client = await pool.connect();
  try {
    const checkResult = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usuarios'`
    );

    if (checkResult.rowCount > 0) {
      await client.query(`
        ALTER TABLE ofertas
          ADD COLUMN IF NOT EXISTS remuneracion NUMERIC(12,2),
          ADD COLUMN IF NOT EXISTS remuneracion_maxima NUMERIC(12,2),
          ADD COLUMN IF NOT EXISTS area VARCHAR(100) NOT NULL DEFAULT 'General',
          ADD COLUMN IF NOT EXISTS requisitos TEXT[] NOT NULL DEFAULT '{}',
          ADD COLUMN IF NOT EXISTS duracion VARCHAR(120),
          ADD COLUMN IF NOT EXISTS horario VARCHAR(120),
          ADD COLUMN IF NOT EXISTS contacto_email VARCHAR(254);
      `);
      console.log('Database tables are already initialized.');
      return { ok: true, message: 'Already initialized' };
    }

    console.log('Initializing database schema in PostgreSQL...');
    const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    await client.query(sql);
    console.log('Database schema created and roles seeded successfully!');
    return { ok: true, message: 'Schema created successfully' };
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
