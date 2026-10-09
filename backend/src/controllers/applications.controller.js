import { pool } from '../config/database.js';
import { getOrganizationProfileId } from '../utils/profiles.js';
import { sendStoredFile } from './profileDetails.controller.js';

// Estados que puede asignar la organización. RETIRADA solo la aplica el candidato.
const COMPANY_STATUSES = ['ENVIADA', 'EN_REVISION', 'PRESELECCIONADA', 'RECHAZADA', 'ACEPTADA'];

async function getCurrentCandidateProfileId(userId) {
  const result = await pool.query(
    `SELECT id FROM perfiles WHERE usuario_id = $1 AND tipo IN ('ESTUDIANTE', 'CANDIDATO_EXTERNO') ORDER BY CASE WHEN tipo = 'CANDIDATO_EXTERNO' THEN 1 ELSE 2 END ASC LIMIT 1`,
    [userId]
  );

  return result.rows[0]?.id ?? null;
}

async function getOfferOwnerProfileId(offerId) {
  const result = await pool.query(
    `SELECT organizacion_id FROM ofertas WHERE id = $1`,
    [offerId]
  );

  return result.rows[0]?.organizacion_id ?? null;
}

export async function listMyApplicationsController(request, response) {
  const candidateProfileId = await getCurrentCandidateProfileId(request.auth.sub);

  if (!candidateProfileId) {
    return response.status(403).json({ ok: false, message: 'Solo un candidato o estudiante puede ver sus postulaciones.' });
  }

  try {
    const result = await pool.query(
      `SELECT p.*, o.titulo AS oferta_titulo, o.tipo AS oferta_tipo, o.modalidad, o.ubicacion, org.razon_social AS empresa
       FROM postulaciones p
       INNER JOIN ofertas o ON o.id = p.oferta_id
       INNER JOIN organizaciones org ON org.perfil_id = o.organizacion_id
       WHERE p.candidato_id = $1
       ORDER BY p.created_at DESC`,
      [candidateProfileId]
    );

    return response.json({ ok: true, applications: result.rows });
  } catch (error) {
    console.error('listMyApplicationsController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo listar tus postulaciones.' });
  }
}

export async function listApplicationsForOfferController(request, response) {
  const { offerId } = request.params;
  const ownerProfileId = await getOfferOwnerProfileId(offerId);

  if (!ownerProfileId) {
    return response.status(404).json({ ok: false, message: 'Oferta no encontrada.' });
  }

  const currentUserProfileId = await getOrganizationProfileId(request.auth.sub);

  if (currentUserProfileId !== ownerProfileId) {
    return response.status(403).json({ ok: false, message: 'No tienes permisos para ver estas postulaciones.' });
  }

  try {
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

    return response.json({ ok: true, applications: result.rows });
  } catch (error) {
    console.error('listApplicationsForOfferController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo obtener la información de postulaciones.' });
  }
}

export async function applyToOfferController(request, response) {
  const { offerId } = request.params;
  const candidateProfileId = await getCurrentCandidateProfileId(request.auth.sub);

  if (!candidateProfileId) {
    return response.status(403).json({ ok: false, message: 'Debes contar con un perfil de candidato o estudiante para postularte.' });
  }

  try {
    const offerResult = await pool.query(
      `SELECT id, estado, fecha_cierre FROM ofertas WHERE id = $1`,
      [offerId]
    );

    if (offerResult.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'Oferta no encontrada.' });
    }

    if (offerResult.rows[0].estado !== 'PUBLICADA') {
      return response.status(400).json({ ok: false, message: 'La oferta no está publicada para recibir postulaciones.' });
    }

    if (offerResult.rows[0].fecha_cierre && new Date(offerResult.rows[0].fecha_cierre) < new Date()) {
      return response.status(400).json({ ok: false, message: 'El plazo para postularse a esta oferta ya terminó.' });
    }

    const existingApplication = await pool.query(
      `SELECT id FROM postulaciones WHERE oferta_id = $1 AND candidato_id = $2`,
      [offerId, candidateProfileId]
    );

    if (existingApplication.rowCount > 0) {
      return response.status(409).json({ ok: false, message: 'Ya existe una postulación para esta oferta.' });
    }

    const payload = request.body ?? {};
    const coverLetter = payload.cartaPresentacion ?? payload.carta_presentacion ?? payload.message ?? null;

    const result = await pool.query(
      `INSERT INTO postulaciones (oferta_id, candidato_id, estado, carta_presentacion)
       VALUES ($1, $2, 'ENVIADA', $3)
       RETURNING *`,
      [offerId, candidateProfileId, coverLetter]
    );

    return response.status(201).json({ ok: true, application: result.rows[0] });
  } catch (error) {
    // Dos envíos simultáneos pueden superar la comprobación previa; la restricción
    // única de la tabla lo detecta.
    if (error?.code === '23505') {
      return response.status(409).json({ ok: false, message: 'Ya existe una postulación para esta oferta.' });
    }
    console.error('applyToOfferController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo registrar la postulación.' });
  }
}

export async function updateApplicationStatusController(request, response) {
  const { id } = request.params;
  const payload = request.body ?? {};
  const nextStatus = String(payload.estado ?? payload.status ?? '').trim().toUpperCase();

  if (!COMPANY_STATUSES.includes(nextStatus)) {
    return response.status(400).json({ ok: false, message: 'El estado de la postulación no es válido.' });
  }

  try {
    const applicationResult = await pool.query(
      `SELECT p.id, p.oferta_id, p.estado, o.organizacion_id
       FROM postulaciones p
       INNER JOIN ofertas o ON o.id = p.oferta_id
       WHERE p.id = $1`,
      [id]
    );

    if (applicationResult.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'Postulación no encontrada.' });
    }

    const app = applicationResult.rows[0];
    const organizationProfileId = await getOrganizationProfileId(request.auth.sub);

    if (organizationProfileId !== app.organizacion_id) {
      return response.status(403).json({ ok: false, message: 'No tienes permisos para cambiar el estado de esta postulación.' });
    }

    if (app.estado === 'RETIRADA') {
      return response.status(409).json({ ok: false, message: 'El candidato retiró esta postulación.' });
    }

    const result = await pool.query(
      `UPDATE postulaciones
       SET estado = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [nextStatus, id]
    );

    return response.json({ ok: true, application: result.rows[0] });
  } catch (error) {
    console.error('updateApplicationStatusController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo actualizar la postulación.' });
  }
}

// El candidato puede retirar su postulación mientras no esté resuelta.
export async function withdrawApplicationController(request, response) {
  const { id } = request.params;
  const candidateProfileId = await getCurrentCandidateProfileId(request.auth.sub);

  if (!candidateProfileId) {
    return response.status(403).json({ ok: false, message: 'Solo un candidato o estudiante puede retirar sus postulaciones.' });
  }

  try {
    const existing = await pool.query(
      `SELECT id, estado FROM postulaciones WHERE id = $1 AND candidato_id = $2`,
      [id, candidateProfileId]
    );

    if (existing.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'Postulación no encontrada.' });
    }

    if (['ACEPTADA', 'RECHAZADA', 'RETIRADA'].includes(existing.rows[0].estado)) {
      return response.status(409).json({ ok: false, message: 'La postulación ya fue resuelta y no puede retirarse.' });
    }

    const result = await pool.query(
      `UPDATE postulaciones SET estado = 'RETIRADA', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    return response.json({ ok: true, application: result.rows[0] });
  } catch (error) {
    console.error('withdrawApplicationController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo retirar la postulación.' });
  }
}

// La organización dueña de la oferta descarga la hoja de vida del postulante.
export async function getApplicationCvController(request, response) {
  const { id } = request.params;

  try {
    const result = await pool.query(
      `SELECT o.organizacion_id, a.nombre, a.mime, a.tamano, a.contenido
       FROM postulaciones p
       INNER JOIN ofertas o ON o.id = p.oferta_id
       LEFT JOIN archivos a ON a.perfil_id = p.candidato_id AND a.tipo = 'CV'
       WHERE p.id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'Postulación no encontrada.' });
    }

    const row = result.rows[0];
    const organizationProfileId = await getOrganizationProfileId(request.auth.sub);
    if (String(organizationProfileId) !== String(row.organizacion_id)) {
      return response.status(403).json({ ok: false, message: 'No tienes permisos para ver esta hoja de vida.' });
    }

    if (!row.contenido) {
      return response.status(404).json({ ok: false, message: 'El candidato no ha subido una hoja de vida.' });
    }

    return sendStoredFile(response, row);
  } catch (error) {
    console.error('getApplicationCvController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo obtener la hoja de vida.' });
  }
}
