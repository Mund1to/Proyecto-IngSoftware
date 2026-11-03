// Acceso a datos de ofertas. Es la única parte del módulo que conoce SQL:
// cambiar de motor de base de datos o usar un ORM solo afecta este archivo.
import { pool } from '../../core/database/database.js';

const OFFER_WITH_COMPANY = `SELECT o.*, org.razon_social AS empresa, org.verificada
       FROM ofertas o
       INNER JOIN organizaciones org ON org.perfil_id = o.organizacion_id`;

const INSERT_COLUMNS = [
  'organizacion_id', 'titulo', 'descripcion', 'tipo', 'estado', 'ubicacion', 'modalidad', 'area',
  'requisitos', 'duracion', 'horario', 'contacto_email', 'remuneracion', 'remuneracion_maxima',
  'fecha_publicacion', 'fecha_cierre',
  'programas', 'semestre_minimo', 'habilidades', 'experiencia', 'idiomas', 'jornada', 'beneficios', 'vacantes',
];

// idiomas es JSONB: pg necesita el texto JSON, no el arreglo de objetos.
const toSqlValue = (column, value) => (column === 'idiomas' ? JSON.stringify(value ?? []) : value);

export async function listPublished() {
  const result = await pool.query(`${OFFER_WITH_COMPANY}
       WHERE o.estado = 'PUBLICADA'
       ORDER BY o.created_at DESC`);
  return result.rows;
}

export async function findPublishedById(id) {
  const result = await pool.query(`${OFFER_WITH_COMPANY}
       WHERE o.id = $1 AND o.estado = 'PUBLICADA'`, [id]);
  return result.rows[0] ?? null;
}

// conteo_estados: postulaciones por estado ({ "ENVIADA": 3, ... }) para la barra
// por etapa del panel; nuevos_semana: postulaciones de los últimos 7 días.
export async function listByOrganization(organizationId) {
  const result = await pool.query(
    `SELECT o.*, org.razon_social AS empresa, org.verificada,
            COALESCE(c.conteo, '{}'::jsonb) AS conteo_estados,
            COALESCE(c.nuevos, 0)::int AS nuevos_semana
     FROM ofertas o
     INNER JOIN organizaciones org ON org.perfil_id = o.organizacion_id
     LEFT JOIN LATERAL (
       SELECT jsonb_object_agg(s.estado, s.n) AS conteo, SUM(s.nuevos) AS nuevos
       FROM (
         SELECT p.estado::text AS estado,
                COUNT(*)::int AS n,
                COUNT(*) FILTER (WHERE p.created_at >= NOW() - INTERVAL '7 days')::int AS nuevos
         FROM postulaciones p
         WHERE p.oferta_id = o.id
         GROUP BY p.estado
       ) s
     ) c ON TRUE
     WHERE o.organizacion_id = $1
     ORDER BY o.created_at DESC`,
    [organizationId]
  );
  return result.rows;
}

// Perfil del candidato o estudiante usado para calcular la afinidad.
export async function findRecommendationProfile(userId) {
  const result = await pool.query(
    `SELECT p.tipo, pe.programa_academico, pc.resumen, pc.ubicacion,
            COALESCE((SELECT array_agg(h.nombre::text) FROM perfil_habilidades h WHERE h.perfil_id = p.id), ARRAY[]::text[]) AS habilidades
     FROM perfiles p
     LEFT JOIN perfiles_estudiante pe ON pe.perfil_id = p.id
     LEFT JOIN perfiles_candidato pc ON pc.perfil_id = p.id
     WHERE p.usuario_id = $1 AND p.tipo IN ('ESTUDIANTE', 'CANDIDATO_EXTERNO')
     ORDER BY CASE WHEN p.tipo = 'CANDIDATO_EXTERNO' THEN 1 ELSE 2 END ASC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function insert(organizationId, offer) {
  const values = [organizationId, ...INSERT_COLUMNS.slice(1).map((column) => toSqlValue(column, offer[column]))];
  const placeholders = INSERT_COLUMNS.map((_, index) => `$${index + 1}`).join(', ');
  const result = await pool.query(
    `INSERT INTO ofertas (${INSERT_COLUMNS.join(', ')}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function findOwned(id, organizationId) {
  const result = await pool.query('SELECT * FROM ofertas WHERE id = $1 AND organizacion_id = $2', [id, organizationId]);
  return result.rows[0] ?? null;
}

// Actualiza solo las columnas indicadas en `changes`.
export async function updateOwned(id, organizationId, changes) {
  const columns = Object.keys(changes);
  const assignments = columns.map((column, index) => `${column} = $${index + 1}`);
  const result = await pool.query(
    `UPDATE ofertas
     SET ${assignments.join(', ')}, updated_at = NOW()
     WHERE id = $${columns.length + 1} AND organizacion_id = $${columns.length + 2}
     RETURNING *`,
    [...columns.map((column) => toSqlValue(column, changes[column])), id, organizationId]
  );
  return result.rows[0] ?? null;
}

// Papelera: cancelar guarda la fecha y el motivo; restaurar vuelve a borrador.
export async function cancelOwned(db, id, organizationId, reason) {
  const result = await db.query(
    `UPDATE ofertas
     SET estado = 'CANCELADA', cancelada_at = NOW(), motivo_cancelacion = $3, updated_at = NOW()
     WHERE id = $1 AND organizacion_id = $2 AND estado <> 'CANCELADA'
     RETURNING *`,
    [id, organizationId, reason]
  );
  return result.rows[0] ?? null;
}

export async function restoreOwned(id, organizationId) {
  const result = await pool.query(
    `UPDATE ofertas
     SET estado = 'BORRADOR', cancelada_at = NULL, motivo_cancelacion = NULL, updated_at = NOW()
     WHERE id = $1 AND organizacion_id = $2 AND estado = 'CANCELADA'
     RETURNING *`,
    [id, organizationId]
  );
  return result.rows[0] ?? null;
}

export async function countApplications(offerId) {
  const result = await pool.query('SELECT COUNT(*)::int AS total FROM postulaciones WHERE oferta_id = $1', [offerId]);
  return result.rows[0].total;
}

// Borra una oferta cancelada sin postulaciones (la condición se repite en SQL
// por si llega una postulación entre la comprobación y el borrado).
export async function deleteOwned(id, organizationId) {
  const result = await pool.query(
    `DELETE FROM ofertas o
     WHERE o.id = $1 AND o.organizacion_id = $2 AND o.estado = 'CANCELADA'
       AND NOT EXISTS (SELECT 1 FROM postulaciones p WHERE p.oferta_id = o.id)
     RETURNING o.id`,
    [id, organizationId]
  );
  return result.rows[0] ?? null;
}
