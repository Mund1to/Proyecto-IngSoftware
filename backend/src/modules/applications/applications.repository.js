// Acceso a datos de postulaciones. Es la única parte del módulo que conoce SQL.
import { pool } from '../../core/database/database.js';

// Perfil con el que el usuario se postula. Si tiene ambos, prima el de candidato externo.
export async function findCandidateProfileId(userId) {
  const result = await pool.query(
    `SELECT id FROM perfiles WHERE usuario_id = $1 AND tipo IN ('ESTUDIANTE', 'CANDIDATO_EXTERNO') ORDER BY CASE WHEN tipo = 'CANDIDATO_EXTERNO' THEN 1 ELSE 2 END ASC LIMIT 1`,
    [userId]
  );
  return result.rows[0]?.id ?? null;
}

export async function findOfferOwnerId(offerId) {
  const result = await pool.query('SELECT organizacion_id FROM ofertas WHERE id = $1', [offerId]);
  return result.rows[0]?.organizacion_id ?? null;
}

export async function listByCandidate(candidateProfileId) {
  const result = await pool.query(
    `SELECT p.*, o.titulo AS oferta_titulo, o.tipo AS oferta_tipo, o.modalidad, o.ubicacion, org.razon_social AS empresa
     FROM postulaciones p
     INNER JOIN ofertas o ON o.id = p.oferta_id
     INNER JOIN organizaciones org ON org.perfil_id = o.organizacion_id
     WHERE p.candidato_id = $1
     ORDER BY p.created_at DESC`,
    [candidateProfileId]
  );
  return result.rows;
}

// Postulaciones de una oferta con la hoja de vida resumida de cada postulante.
export async function listByOffer(offerId) {
  const result = await pool.query(
    `SELECT p.*, u.nombre_completo AS postulante_nombre, u.email AS postulante_email, u.telefono AS postulante_telefono,
            pf.tipo AS perfil_tipo, pe.programa_academico, pe.semestre, pe.universidad,
            pc.resumen, pc.ubicacion AS candidato_ubicacion, pc.disponibilidad, pc.cv_url,
            EXISTS (SELECT 1 FROM archivos a WHERE a.perfil_id = pf.id AND a.tipo = 'CV') AS tiene_cv,
            COALESCE((SELECT json_agg(json_build_object('titulo', e.titulo, 'institucion', e.institucion, 'periodo', e.periodo) ORDER BY e.orden, e.id)
                      FROM perfil_educacion e WHERE e.perfil_id = pf.id), '[]'::json) AS educacion,
            COALESCE((SELECT json_agg(json_build_object('cargo', x.cargo, 'empresa', x.empresa, 'periodo', x.periodo, 'descripcion', x.descripcion) ORDER BY x.orden, x.id)
                      FROM perfil_experiencia x WHERE x.perfil_id = pf.id), '[]'::json) AS experiencia,
            COALESCE((SELECT json_agg(h.nombre ORDER BY h.categoria, h.id)
                      FROM perfil_habilidades h WHERE h.perfil_id = pf.id), '[]'::json) AS habilidades
     FROM postulaciones p
     INNER JOIN perfiles pf ON pf.id = p.candidato_id
     INNER JOIN usuarios u ON u.id = pf.usuario_id
     LEFT JOIN perfiles_estudiante pe ON pe.perfil_id = pf.id
     LEFT JOIN perfiles_candidato pc ON pc.perfil_id = pf.id
     WHERE p.oferta_id = $1
     ORDER BY p.created_at DESC`,
    [offerId]
  );
  return result.rows;
}

// Datos de la oferta necesarios para aceptar una postulación, junto con el tipo de perfil.
export async function findOfferForApplication(offerId, candidateProfileId) {
  const result = await pool.query(
    `SELECT o.id, o.estado, o.fecha_cierre, o.tipo::text AS tipo,
            (SELECT p.tipo::text FROM perfiles p WHERE p.id = $2) AS perfil_tipo
     FROM ofertas o WHERE o.id = $1`,
    [offerId, candidateProfileId]
  );
  return result.rows[0] ?? null;
}

export async function existsForCandidate(offerId, candidateProfileId) {
  const result = await pool.query(
    'SELECT id FROM postulaciones WHERE oferta_id = $1 AND candidato_id = $2',
    [offerId, candidateProfileId]
  );
  return result.rowCount > 0;
}

export async function insert(offerId, candidateProfileId, coverLetter) {
  const result = await pool.query(
    `INSERT INTO postulaciones (oferta_id, candidato_id, estado, carta_presentacion)
     VALUES ($1, $2, 'ENVIADA', $3)
     RETURNING *`,
    [offerId, candidateProfileId, coverLetter]
  );
  return result.rows[0];
}

export async function findWithOfferOwner(id) {
  const result = await pool.query(
    `SELECT p.id, p.oferta_id, p.estado, o.organizacion_id
     FROM postulaciones p
     INNER JOIN ofertas o ON o.id = p.oferta_id
     WHERE p.id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function findOwnedByCandidate(id, candidateProfileId) {
  const result = await pool.query(
    'SELECT id, estado FROM postulaciones WHERE id = $1 AND candidato_id = $2',
    [id, candidateProfileId]
  );
  return result.rows[0] ?? null;
}

export async function updateStatus(id, status) {
  const result = await pool.query(
    `UPDATE postulaciones
     SET estado = $1,
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [status, id]
  );
  return result.rows[0];
}

// Hoja de vida del postulante (puede no existir) con el dueño de la oferta.
export async function findCvWithOfferOwner(id) {
  const result = await pool.query(
    `SELECT o.organizacion_id, a.nombre, a.mime, a.tamano, a.contenido
     FROM postulaciones p
     INNER JOIN ofertas o ON o.id = p.oferta_id
     LEFT JOIN archivos a ON a.perfil_id = p.candidato_id AND a.tipo = 'CV'
     WHERE p.id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}
