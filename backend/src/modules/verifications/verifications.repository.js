// Acceso a datos de verificación de organizaciones. Las funciones que escriben
// reciben `db` para poder participar en una transacción.
import { pool } from '../../core/database/database.js';

// Organizaciones con su estado de verificación más reciente.
export async function listOrganizationsWithLatestVerification() {
  const result = await pool.query(
    `SELECT o.perfil_id AS organizacion_id,
            o.razon_social,
            o.identificacion_fiscal,
            o.sitio_web,
            o.verificada,
            v.id AS verificacion_id,
            v.estado AS verificacion_estado,
            v.observaciones,
            v.updated_at AS verificacion_fecha
     FROM organizaciones o
     LEFT JOIN LATERAL (
       SELECT id, estado, observaciones, updated_at
       FROM verificaciones
       WHERE organizacion_id = o.perfil_id
       ORDER BY updated_at DESC
       LIMIT 1
     ) v ON TRUE
     ORDER BY o.verificada ASC, o.razon_social ASC`
  );
  return result.rows;
}

export async function organizationExists(db, organizationId) {
  const result = await db.query('SELECT perfil_id FROM organizaciones WHERE perfil_id = $1', [organizationId]);
  return result.rowCount > 0;
}

export async function insertVerification(db, { organizationId, reviewerId, status, observations }) {
  await db.query(
    `INSERT INTO verificaciones (organizacion_id, revisado_por, estado, observaciones)
     VALUES ($1, $2, $3, $4)`,
    [organizationId, reviewerId, status, observations]
  );
}

export async function setOrganizationVerified(db, organizationId, status) {
  const result = await db.query(
    `UPDATE organizaciones
     SET verificada = ($1 = 'APROBADA'), updated_at = NOW()
     WHERE perfil_id = $2
     RETURNING perfil_id AS organizacion_id, razon_social, verificada`,
    [status, organizationId]
  );
  return result.rows[0];
}
