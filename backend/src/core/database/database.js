import pg from 'pg';
import { env } from '../config/env.js';

const { Pool, types } = pg;

// Las columnas DATE (sin hora) se devuelven como texto 'YYYY-MM-DD'. Convertirlas
// a Date las desplazaba según la zona horaria del servidor.
types.setTypeParser(1082, (value) => value);

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
});

// Ejecuta `work(client)` dentro de una transacción: confirma si termina bien y
// revierte si lanza. Los repositorios reciben `client` como su parámetro `db`.
export async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function testDatabaseConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    return { ok: true, now: result.rows[0].now };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}
