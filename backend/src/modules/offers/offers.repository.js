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
];

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
  const values = [organizationId, ...INSERT_COLUMNS.slice(1).map((column) => offer[column])];
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
    [...columns.map((column) => changes[column]), id, organizationId]
  );
  return result.rows[0] ?? null;
}

export async function cancelOwned(id, organizationId) {
  const result = await pool.query(
    `UPDATE ofertas SET estado = 'CANCELADA', updated_at = NOW()
     WHERE id = $1 AND organizacion_id = $2
     RETURNING id`,
    [id, organizationId]
  );
  return result.rows[0] ?? null;
}
