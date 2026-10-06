import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
});

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
