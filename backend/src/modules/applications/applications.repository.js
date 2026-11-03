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

// Hoja de vida del perfil `$<param>` tal como está ahora. Se guarda en la
// postulación al enviarla (columna hoja_vida); la migración
// 20261102_application_resume_snapshot.sql usa la misma forma.
const resumeSnapshotSql = (param) => `(
  SELECT jsonb_build_object(
    'perfilTipo', pf.tipo,
    'universidad', pe.universidad,
    'programaAcademico', pe.programa_academico,
    'semestre', pe.semestre,
    'resumen', pc.resumen,
    'ubicacion', pc.ubicacion,
    'disponibilidad', pc.disponibilidad,
    'cvUrl', pc.cv_url,
    'educacion', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('titulo', e.titulo, 'institucion', e.institucion, 'periodo', e.periodo) ORDER BY e.orden, e.id)
      FROM perfil_educacion e WHERE e.perfil_id = pf.id
    ), '[]'::jsonb),
    'experiencia', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('cargo', x.cargo, 'empresa', x.empresa, 'periodo', x.periodo, 'descripcion', x.descripcion) ORDER BY x.orden, x.id)
      FROM perfil_experiencia x WHERE x.perfil_id = pf.id
    ), '[]'::jsonb),
    'habilidades', COALESCE((
      SELECT jsonb_agg(h.nombre ORDER BY h.categoria, h.id)
      FROM perfil_habilidades h WHERE h.perfil_id = pf.id
    ), '[]'::jsonb)
  )
  FROM perfiles pf
  LEFT JOIN perfiles_estudiante pe ON pe.perfil_id = pf.id
  LEFT JOIN perfiles_candidato pc ON pc.perfil_id = pf.id
  WHERE pf.id = ${param}
)`;

// Datos del archivo enviado con la postulación (sin el contenido).
const CV_COLUMNS = `cv.nombre AS cv_nombre, cv.tamano AS cv_tamano, cv.origen AS cv_origen, cv.created_at AS cv_fecha,
            (cv.postulacion_id IS NOT NULL) AS tiene_cv`;

export async function listByCandidate(candidateProfileId) {
  const result = await pool.query(
    `SELECT p.id, p.oferta_id, p.candidato_id, p.estado, p.carta_presentacion, p.created_at, p.updated_at,
            o.titulo AS oferta_titulo, o.tipo AS oferta_tipo, o.modalidad, o.ubicacion, org.razon_social AS empresa,
            ${CV_COLUMNS}
     FROM postulaciones p
     INNER JOIN ofertas o ON o.id = p.oferta_id
     INNER JOIN organizaciones org ON org.perfil_id = o.organizacion_id
     LEFT JOIN postulacion_cv cv ON cv.postulacion_id = p.id
     WHERE p.candidato_id = $1
     ORDER BY p.created_at DESC`,
    [candidateProfileId]
  );
  return result.rows;
}

// Postulaciones de una oferta. La hoja de vida es la copia guardada al postularse;
// nombre, correo y teléfono son los vigentes del perfil.
export async function listByOffer(offerId) {
  const result = await pool.query(
    `SELECT p.id, p.oferta_id, p.candidato_id, p.estado, p.carta_presentacion, p.created_at, p.updated_at,
            u.nombre_completo AS postulante_nombre, u.email AS postulante_email, u.telefono AS postulante_telefono,
            pf.tipo AS perfil_tipo,
            p.hoja_vida->>'programaAcademico' AS programa_academico,
            (p.hoja_vida->>'semestre')::int AS semestre,
            p.hoja_vida->>'universidad' AS universidad,
            p.hoja_vida->>'resumen' AS resumen,
            p.hoja_vida->>'ubicacion' AS candidato_ubicacion,
            p.hoja_vida->>'disponibilidad' AS disponibilidad,
            p.hoja_vida->>'cvUrl' AS cv_url,
            COALESCE(p.hoja_vida->'educacion', '[]'::jsonb) AS educacion,
            COALESCE(p.hoja_vida->'experiencia', '[]'::jsonb) AS experiencia,
            COALESCE(p.hoja_vida->'habilidades', '[]'::jsonb) AS habilidades,
            ${CV_COLUMNS}
     FROM postulaciones p
     INNER JOIN perfiles pf ON pf.id = p.candidato_id
     INNER JOIN usuarios u ON u.id = pf.usuario_id
     LEFT JOIN postulacion_cv cv ON cv.postulacion_id = p.id
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

// Crea la postulación con la copia de la hoja de vida actual del candidato.
export async function insert(db, offerId, candidateProfileId, coverLetter) {
  const result = await db.query(
    `INSERT INTO postulaciones (oferta_id, candidato_id, estado, carta_presentacion, hoja_vida)
     VALUES ($1, $2, 'ENVIADA', $3, ${resumeSnapshotSql('$2')})
     RETURNING id, oferta_id, candidato_id, estado, carta_presentacion, created_at, updated_at`,
    [offerId, candidateProfileId, coverLetter]
  );
  return result.rows[0];
}

// Copia en la postulación la hoja de vida PDF que el candidato tiene en su perfil.
// Devuelve los datos del archivo copiado o null si el perfil no tiene uno.
export async function copyProfileCv(db, applicationId, candidateProfileId) {
  const result = await db.query(
    `INSERT INTO postulacion_cv (postulacion_id, nombre, mime, tamano, contenido, origen)
     SELECT $1, a.nombre, a.mime, a.tamano, a.contenido, 'PERFIL'
     FROM archivos a
     WHERE a.perfil_id = $2 AND a.tipo = 'CV'
     ON CONFLICT (postulacion_id) DO NOTHING
     RETURNING nombre, tamano, origen, created_at`,
    [applicationId, candidateProfileId]
  );
  return result.rows[0] ?? null;
}

// Guarda o reemplaza el archivo propio de una postulación. No toca el perfil.
export async function upsertApplicationCv(applicationId, { nombre, mime, contenido }) {
  const result = await pool.query(
    `INSERT INTO postulacion_cv (postulacion_id, nombre, mime, tamano, contenido, origen)
     VALUES ($1, $2, $3, $4, $5, 'PROPIO')
     ON CONFLICT (postulacion_id) DO UPDATE
       SET nombre = EXCLUDED.nombre, mime = EXCLUDED.mime, tamano = EXCLUDED.tamano,
           contenido = EXCLUDED.contenido, origen = 'PROPIO', created_at = NOW()
     RETURNING nombre, tamano, origen, created_at`,
    [applicationId, nombre, mime, contenido.length, contenido]
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
     RETURNING id, oferta_id, candidato_id, estado, carta_presentacion, created_at, updated_at`,
    [status, id]
  );
  return result.rows[0];
}

// Hoja de vida enviada con la postulación (puede no existir), con el dueño de la
// oferta y el candidato para comprobar quién puede verla.
export async function findApplicationCv(id) {
  const result = await pool.query(
    `SELECT o.organizacion_id, p.candidato_id, cv.nombre, cv.mime, cv.tamano, cv.contenido
     FROM postulaciones p
     INNER JOIN ofertas o ON o.id = p.oferta_id
     LEFT JOIN postulacion_cv cv ON cv.postulacion_id = p.id
     WHERE p.id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}
