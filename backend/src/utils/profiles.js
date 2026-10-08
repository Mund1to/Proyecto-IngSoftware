import { pool } from '../config/database.js';

// Devuelve el id del perfil de organización del usuario autenticado (o null).
export async function getOrganizationProfileId(userId, client = pool) {
  const result = await client.query(
    `SELECT id FROM perfiles WHERE usuario_id = $1 AND tipo = 'ORGANIZACION' LIMIT 1`,
    [userId]
  );

  return result.rows[0]?.id ?? null;
}
