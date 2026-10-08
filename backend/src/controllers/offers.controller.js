import { pool } from '../config/database.js';

function getBodyValue(payload, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(payload, key) && payload[key] !== undefined && payload[key] !== null) {
      return payload[key];
    }
  }

  return undefined;
}

function normalizeString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text === '' ? null : text;
}

function normalizeNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

async function getOrganizationProfileId(userId) {
  const result = await pool.query(
    `SELECT id FROM perfiles WHERE usuario_id = $1 AND tipo = 'ORGANIZACION' LIMIT 1`,
    [userId]
  );

  return result.rows[0]?.id ?? null;
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
       WHERE o.id = $1`,
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

  if (!['PRACTICA', 'EMPLEO', 'EMPLEO_PUBLICO'].includes(type.toUpperCase())) {
    return response.status(400).json({
      ok: false,
      message: 'El tipo de oferta debe ser PRACTICA, EMPLEO o EMPLEO_PUBLICO.',
    });
  }

  if (!['BORRADOR', 'PUBLICADA', 'CERRADA', 'CANCELADA'].includes(status.toUpperCase())) {
    return response.status(400).json({
      ok: false,
      message: 'El estado de la oferta no es válido.',
    });
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
        remuneracion,
        remuneracion_maxima,
        fecha_publicacion,
        fecha_cierre
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        organizationId,
        title,
        description,
        type.toUpperCase(),
        status.toUpperCase(),
        location,
        modality,
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

    if (type && !['PRACTICA', 'EMPLEO', 'EMPLEO_PUBLICO'].includes(String(type).toUpperCase())) {
      return response.status(400).json({ ok: false, message: 'El tipo de oferta no es válido.' });
    }

    if (status && !['BORRADOR', 'PUBLICADA', 'CERRADA', 'CANCELADA'].includes(String(status).toUpperCase())) {
      return response.status(400).json({ ok: false, message: 'El estado de la oferta no es válido.' });
    }

    const result = await pool.query(
      `UPDATE ofertas
       SET titulo = COALESCE($1, titulo),
           descripcion = COALESCE($2, descripcion),
           tipo = COALESCE($3, tipo),
           estado = COALESCE($4, estado),
           ubicacion = COALESCE($5, ubicacion),
           modalidad = COALESCE($6, modalidad),
           remuneracion = COALESCE($7, remuneracion),
           remuneracion_maxima = COALESCE($8, remuneracion_maxima),
           fecha_publicacion = COALESCE($9, fecha_publicacion),
           fecha_cierre = COALESCE($10, fecha_cierre),
           updated_at = NOW()
       WHERE id = $11 AND organizacion_id = $12
       RETURNING *`,
      [
        normalizeString(title),
        normalizeString(description),
        type ? String(type).toUpperCase() : null,
        status ? String(status).toUpperCase() : null,
        normalizeString(location),
        normalizeString(modality),
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
      `DELETE FROM ofertas
       WHERE id = $1 AND organizacion_id = $2
       RETURNING id`,
      [id, organizationId]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'No se encontró una oferta propia para eliminar.' });
    }

    return response.json({ ok: true, deletedOfferId: Number(result.rows[0].id) });
  } catch (error) {
    console.error('deleteOfferController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo eliminar la oferta.' });
  }
}
