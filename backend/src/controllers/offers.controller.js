import { pool } from '../config/database.js';
import { getOrganizationProfileId } from '../utils/profiles.js';
import {
  getBodyValue,
  normalizeNumber,
  normalizeString,
  normalizeStringList,
} from '../utils/payload.js';

const OFFER_TYPES = ['PRACTICA', 'EMPLEO', 'EMPLEO_PUBLICO'];
const OFFER_STATUSES = ['BORRADOR', 'PUBLICADA', 'CERRADA', 'CANCELADA'];

// #20 HU-16: recomienda ofertas publicadas ordenadas por afinidad con el perfil.
// La puntuación combina área, ubicación, requisitos y tipo de oferta. No excluye
// ofertas: las ordena, para que el candidato siempre vea todo el catálogo.
function scoreOffer(offer, profile) {
  let score = 0;

  const normalize = (value) => String(value ?? '').trim().toLowerCase();
  const area = normalize(offer.area);
  const city = normalize(offer.ubicacion);
  const offerType = normalize(offer.tipo);
  const requirements = Array.isArray(offer.requisitos) ? offer.requisitos.map(normalize) : [];

  const profileArea = normalize(profile.programa_academico ?? profile.resumen);
  const profileCity = normalize(profile.ubicacion);
  const profileSkills = String(profile.resumen ?? '')
    .split(/[,\n]/)
    .map(normalize)
    .filter(Boolean);

  // Coincidencia exacta de área vale más que coincidencia parcial.
  if (area && profileArea) {
    if (area === profileArea) score += 40;
    else if (area.includes(profileArea) || profileArea.includes(area)) score += 25;
  }

  // Ubicación: misma ciudad suma.
  if (city && profileCity && city === profileCity) score += 25;

  // Requisitos que el candidato ya menciona en su resumen/habilidades.
  score += requirements.filter((req) => profileSkills.some((skill) => req.includes(skill))).length * 15;

  // Un estudiante puntúa más alto en prácticas; un externo, en empleos.
  const isStudent = profile.tipo === 'ESTUDIANTE';
  if (isStudent && offerType === 'practica') score += 20;
  if (!isStudent && (offerType === 'empleo' || offerType === 'empleo_publico')) score += 20;

  return score;
}

export async function listRecommendedOffersController(request, response) {
  try {
    const profileResult = await pool.query(
      `SELECT p.tipo, pe.programa_academico, pc.resumen, pc.ubicacion
       FROM perfiles p
       LEFT JOIN perfiles_estudiante pe ON pe.perfil_id = p.id
       LEFT JOIN perfiles_candidato pc ON pc.perfil_id = p.id
       WHERE p.usuario_id = $1 AND p.tipo IN ('ESTUDIANTE', 'CANDIDATO_EXTERNO')
       ORDER BY CASE WHEN p.tipo = 'CANDIDATO_EXTERNO' THEN 1 ELSE 2 END ASC
       LIMIT 1`,
      [request.auth.sub]
    );

    if (profileResult.rowCount === 0) {
      return response.status(403).json({
        ok: false,
        message: 'Debes contar con un perfil de candidato o estudiante para recibir recomendaciones.',
      });
    }

    const profile = profileResult.rows[0];

    const result = await pool.query(
      `SELECT o.*, org.razon_social AS empresa, org.verificada
       FROM ofertas o
       INNER JOIN organizaciones org ON org.perfil_id = o.organizacion_id
       WHERE o.estado = 'PUBLICADA'
       ORDER BY o.created_at DESC`
    );

    // Las organizaciones verificadas reciben un pequeño empujón de confianza.
    const ranked = result.rows
      .map((offer) => ({
        ...offer,
        recommendationScore: scoreOffer(offer, profile) + (offer.verificada ? 5 : 0),
      }))
      .sort((a, b) => b.recommendationScore - a.recommendationScore);

    return response.json({ ok: true, offers: ranked });
  } catch (error) {
    console.error('listRecommendedOffersController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudieron generar las recomendaciones.' });
  }
}

export async function listOffersController(_request, response) {
  try {
    const result = await pool.query(
      `SELECT o.*, org.razon_social AS empresa, org.verificada
       FROM ofertas o
       INNER JOIN organizaciones org ON org.perfil_id = o.organizacion_id
       WHERE o.estado = 'PUBLICADA'
       ORDER BY o.created_at DESC`
    );

    return response.json({ ok: true, offers: result.rows });
  } catch (error) {
    console.error('listOffersController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo listar las ofertas.' });
  }
}

export async function listMyOffersController(request, response) {
  const organizationId = await getOrganizationProfileId(request.auth.sub);

  if (!organizationId) {
    return response.status(403).json({ ok: false, message: 'Solo una organización puede consultar sus ofertas.' });
  }

  try {
    const result = await pool.query(
      `SELECT o.*, org.razon_social AS empresa, org.verificada
       FROM ofertas o
       INNER JOIN organizaciones org ON org.perfil_id = o.organizacion_id
       WHERE o.organizacion_id = $1
       ORDER BY o.created_at DESC`,
      [organizationId]
    );

    return response.json({ ok: true, offers: result.rows });
  } catch (error) {
    console.error('listMyOffersController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo listar tus ofertas.' });
  }
}

export async function getOfferByIdController(request, response) {
  const { id } = request.params;

  try {
    const result = await pool.query(
      `SELECT o.*, org.razon_social AS empresa, org.verificada
       FROM ofertas o
       INNER JOIN organizaciones org ON org.perfil_id = o.organizacion_id
        WHERE o.id = $1 AND o.estado = 'PUBLICADA'`,
      [id]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'Oferta no encontrada.' });
    }

    return response.json({ ok: true, offer: result.rows[0] });
  } catch (error) {
    console.error('getOfferByIdController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo obtener la oferta.' });
  }
}

export async function createOfferController(request, response) {
  const organizationId = await getOrganizationProfileId(request.auth.sub);

  if (!organizationId) {
    return response.status(403).json({ ok: false, message: 'Solo una organización puede publicar ofertas.' });
  }

  const payload = request.body ?? {};
  const title = normalizeString(getBodyValue(payload, ['titulo', 'title']));
  const description = normalizeString(getBodyValue(payload, ['descripcion', 'description']));
  const type = normalizeString(getBodyValue(payload, ['tipo', 'type']));
  const status = normalizeString(getBodyValue(payload, ['estado', 'status'])) ?? 'BORRADOR';
  const location = normalizeString(getBodyValue(payload, ['ubicacion', 'location']));
  const modality = normalizeString(getBodyValue(payload, ['modalidad', 'modality']));
  const area = normalizeString(getBodyValue(payload, ['area'])) ?? 'General';
  const requirements = normalizeStringList(getBodyValue(payload, ['requisitos', 'requirements']));
  const duration = normalizeString(getBodyValue(payload, ['duracion', 'duration']));
  const schedule = normalizeString(getBodyValue(payload, ['horario', 'schedule']));
  const contactEmail = normalizeString(getBodyValue(payload, ['contactoEmail', 'contact_email', 'contact']));
  const remuneration = normalizeNumber(getBodyValue(payload, ['remuneracion', 'salary', 'salario', 'salaryMin']));
  const remunerationMax = normalizeNumber(getBodyValue(payload, ['remuneracionMaxima', 'remuneracion_maxima', 'salaryMax']));
  const publicationDate = getBodyValue(payload, ['fechaPublicacion', 'fecha_publicacion', 'publishedAt']) ?? null;
  const closeDate = getBodyValue(payload, ['fechaCierre', 'fecha_cierre', 'closeAt']) ?? null;

  if (!title || !description || !type) {
    return response.status(400).json({
      ok: false,
      message: 'Se requieren título, descripción y tipo de oferta.',
    });
  }

  if (!OFFER_TYPES.includes(type.toUpperCase())) {
    return response.status(400).json({
      ok: false,
      message: 'El tipo de oferta debe ser PRACTICA, EMPLEO o EMPLEO_PUBLICO.',
    });
  }

  if (!OFFER_STATUSES.includes(status.toUpperCase())) {
    return response.status(400).json({
      ok: false,
      message: 'El estado de la oferta no es válido.',
    });
  }

  if (closeDate && (!Number.isFinite(new Date(closeDate).getTime()) || new Date(closeDate) <= new Date())) {
    return response.status(400).json({ ok: false, message: 'La fecha de cierre debe ser una fecha futura válida.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO ofertas (
        organizacion_id,
        titulo,
        descripcion,
        tipo,
        estado,
        ubicacion,
        modalidad,
        area,
        requisitos,
        duracion,
        horario,
        contacto_email,
        remuneracion,
        remuneracion_maxima,
        fecha_publicacion,
        fecha_cierre
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        organizationId,
        title,
        description,
        type.toUpperCase(),
        status.toUpperCase(),
        location,
        modality,
        area,
        requirements,
        duration,
        schedule,
        contactEmail,
        remuneration,
        remunerationMax,
        publicationDate ?? null,
        closeDate ?? null,
      ]
    );

    return response.status(201).json({ ok: true, offer: result.rows[0] });
  } catch (error) {
    console.error('createOfferController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo crear la oferta.' });
  }
}

export async function updateOfferController(request, response) {
  const organizationId = await getOrganizationProfileId(request.auth.sub);
  const { id } = request.params;

  if (!organizationId) {
    return response.status(403).json({ ok: false, message: 'Solo una organización puede actualizar ofertas.' });
  }

  const payload = request.body ?? {};
  const title = getBodyValue(payload, ['titulo', 'title']);
  const description = getBodyValue(payload, ['descripcion', 'description']);
  const type = getBodyValue(payload, ['tipo', 'type']);
  const status = getBodyValue(payload, ['estado', 'status']);
  const location = getBodyValue(payload, ['ubicacion', 'location']);
  const modality = getBodyValue(payload, ['modalidad', 'modality']);
  const area = getBodyValue(payload, ['area']);
  const requirements = getBodyValue(payload, ['requisitos', 'requirements']);
  const duration = getBodyValue(payload, ['duracion', 'duration']);
  const schedule = getBodyValue(payload, ['horario', 'schedule']);
  const contactEmail = getBodyValue(payload, ['contactoEmail', 'contact_email', 'contact']);
  const remuneration = normalizeNumber(getBodyValue(payload, ['remuneracion', 'salary', 'salario', 'salaryMin']));
  const remunerationMax = normalizeNumber(getBodyValue(payload, ['remuneracionMaxima', 'remuneracion_maxima', 'salaryMax']));
  const publicationDate = getBodyValue(payload, ['fechaPublicacion', 'fecha_publicacion', 'publishedAt']);
  const closeDate = getBodyValue(payload, ['fechaCierre', 'fecha_cierre', 'closeAt']);

  try {
    const existing = await pool.query(
      `SELECT id FROM ofertas WHERE id = $1 AND organizacion_id = $2`,
      [id, organizationId]
    );

    if (existing.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'No se encontró una oferta propia para actualizar.' });
    }

    if (type && !OFFER_TYPES.includes(String(type).toUpperCase())) {
      return response.status(400).json({ ok: false, message: 'El tipo de oferta no es válido.' });
    }

    if (status && !OFFER_STATUSES.includes(String(status).toUpperCase())) {
      return response.status(400).json({ ok: false, message: 'El estado de la oferta no es válido.' });
    }

    if (closeDate && (!Number.isFinite(new Date(closeDate).getTime()) || new Date(closeDate) <= new Date())) {
      return response.status(400).json({ ok: false, message: 'La fecha de cierre debe ser una fecha futura válida.' });
    }

    const result = await pool.query(
      `UPDATE ofertas
       SET titulo = COALESCE($1, titulo),
           descripcion = COALESCE($2, descripcion),
           tipo = COALESCE($3, tipo),
           estado = COALESCE($4, estado),
           ubicacion = COALESCE($5, ubicacion),
           modalidad = COALESCE($6, modalidad),
           area = COALESCE($7, area),
           requisitos = COALESCE($8, requisitos),
           duracion = COALESCE($9, duracion),
           horario = COALESCE($10, horario),
           contacto_email = COALESCE($11, contacto_email),
           remuneracion = COALESCE($12, remuneracion),
           remuneracion_maxima = COALESCE($13, remuneracion_maxima),
           fecha_publicacion = COALESCE($14, fecha_publicacion),
           fecha_cierre = COALESCE($15, fecha_cierre),
           updated_at = NOW()
       WHERE id = $16 AND organizacion_id = $17
       RETURNING *`,
      [
        normalizeString(title),
        normalizeString(description),
        type ? String(type).toUpperCase() : null,
        status ? String(status).toUpperCase() : null,
        normalizeString(location),
        normalizeString(modality),
        normalizeString(area),
        requirements === undefined ? null : normalizeStringList(requirements),
        normalizeString(duration),
        normalizeString(schedule),
        normalizeString(contactEmail),
        remuneration,
        remunerationMax,
        publicationDate ?? null,
        closeDate ?? null,
        id,
        organizationId,
      ]
    );

    return response.json({ ok: true, offer: result.rows[0] });
  } catch (error) {
    console.error('updateOfferController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo actualizar la oferta.' });
  }
}

export async function deleteOfferController(request, response) {
  const organizationId = await getOrganizationProfileId(request.auth.sub);
  const { id } = request.params;

  if (!organizationId) {
    return response.status(403).json({ ok: false, message: 'Solo una organización puede eliminar ofertas.' });
  }

  try {
    const result = await pool.query(
      `UPDATE ofertas
       SET estado = 'CANCELADA', updated_at = NOW()
       WHERE id = $1 AND organizacion_id = $2
       RETURNING id`,
      [id, organizationId]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'No se encontró una oferta propia para cancelar.' });
    }

    return response.json({ ok: true, deletedOfferId: Number(result.rows[0].id) });
  } catch (error) {
    console.error('deleteOfferController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo eliminar la oferta.' });
  }
}
