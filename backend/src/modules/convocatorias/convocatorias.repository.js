// Acceso a datos de convocatorias. Es la única parte del módulo que conoce SQL.
import { pool } from '../../core/database/database.js';

const CONVOCATORIA_WITH_TOTAL = `SELECT c.*, COUNT(o.id)::int AS total_ofertas
     FROM convocatorias c
     LEFT JOIN ofertas o ON o.convocatoria_id = c.id`;

export async function list() {
  const result = await pool.query(`${CONVOCATORIA_WITH_TOTAL}
     GROUP BY c.id
     ORDER BY c.created_at DESC`);
  return result.rows;
}

export async function findById(id) {
  const result = await pool.query(`${CONVOCATORIA_WITH_TOTAL}
     WHERE c.id = $1
     GROUP BY c.id`, [id]);
  return result.rows[0] ?? null;
}

export async function exists(id) {
  const result = await pool.query('SELECT id FROM convocatorias WHERE id = $1', [id]);
  return result.rowCount > 0;
}

export async function insert({ titulo, descripcion, fechaInicio, fechaFin }) {
  const result = await pool.query(
    `INSERT INTO convocatorias (titulo, descripcion, fecha_inicio, fecha_fin)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [titulo, descripcion, fechaInicio, fechaFin]
  );
  return result.rows[0];
}

// Título y descripción nulos conservan el valor guardado; las fechas solo
// cambian si se enviaron (setFechaInicio / setFechaFin), incluso para vaciarlas.
export async function update(id, { titulo, descripcion, setFechaInicio, fechaInicio, setFechaFin, fechaFin }) {
  const result = await pool.query(
    `UPDATE convocatorias
     SET titulo = COALESCE($1, titulo),
         descripcion = COALESCE($2, descripcion),
         fecha_inicio = CASE WHEN $3::boolean THEN $4::date ELSE fecha_inicio END,
         fecha_fin = CASE WHEN $5::boolean THEN $6::date ELSE fecha_fin END
     WHERE id = $7
     RETURNING *`,
    [titulo, descripcion, setFechaInicio, fechaInicio, setFechaFin, fechaFin, id]
  );
  return result.rows[0] ?? null;
}

export async function remove(id) {
  const result = await pool.query('DELETE FROM convocatorias WHERE id = $1 RETURNING id', [id]);
  return result.rows[0] ?? null;
}

export async function listPublishedOffers(id) {
  const result = await pool.query(
    `SELECT o.*, org.razon_social AS empresa, org.verificada
     FROM ofertas o
     INNER JOIN organizaciones org ON org.perfil_id = o.organizacion_id
     WHERE o.convocatoria_id = $1 AND o.estado = 'PUBLICADA'
     ORDER BY o.created_at DESC`,
    [id]
  );
  return result.rows;
}

export async function assignOffer(id, offerId) {
  const result = await pool.query(
    `UPDATE ofertas
     SET convocatoria_id = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, convocatoria_id`,
    [id, offerId]
  );
  return result.rows[0] ?? null;
}

export async function unassignOffer(id, offerId) {
  const result = await pool.query(
    `UPDATE ofertas
     SET convocatoria_id = NULL, updated_at = NOW()
     WHERE id = $1 AND convocatoria_id = $2
     RETURNING id, convocatoria_id`,
    [offerId, id]
  );
  return result.rows[0] ?? null;
}
