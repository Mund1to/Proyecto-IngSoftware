import { pool } from '../config/database.js';
import { getBodyValue, hasBodyValue, normalizeString, toNullableString } from '../utils/payload.js';

// #18 HU-14: convocatorias públicas (Fase 4).
// Lectura abierta a cualquier usuario; creación y edición solo para
// ADMINISTRADOR o FUNCIONARIO_PUBLICO.

function isValidDate(value) {
  return value === null || Number.isFinite(new Date(`${value}T00:00:00Z`).getTime());
}

export async function listConvocatoriasController(_request, response) {
  try {
    const result = await pool.query(
      `SELECT c.*, COUNT(o.id)::int AS total_ofertas
       FROM convocatorias c
       LEFT JOIN ofertas o ON o.convocatoria_id = c.id
       GROUP BY c.id
       ORDER BY c.created_at DESC`
    );

    return response.json({ ok: true, convocatorias: result.rows });
  } catch (error) {
    console.error('listConvocatoriasController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudieron listar las convocatorias.' });
  }
}

export async function getConvocatoriaByIdController(request, response) {
  const { id } = request.params;

  try {
    const result = await pool.query(
      `SELECT c.*, COUNT(o.id)::int AS total_ofertas
       FROM convocatorias c
       LEFT JOIN ofertas o ON o.convocatoria_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [id]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'Convocatoria no encontrada.' });
    }

    return response.json({ ok: true, convocatoria: result.rows[0] });
  } catch (error) {
    console.error('getConvocatoriaByIdController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo obtener la convocatoria.' });
  }
}

export async function createConvocatoriaController(request, response) {
  const payload = request.body ?? {};
  const titulo = normalizeString(getBodyValue(payload, ['titulo', 'title']));
  const descripcion = normalizeString(getBodyValue(payload, ['descripcion', 'description']));
  const fechaInicio = toNullableString(getBodyValue(payload, ['fechaInicio', 'fecha_inicio']));
  const fechaFin = toNullableString(getBodyValue(payload, ['fechaFin', 'fecha_fin']));

  if (!titulo) {
    return response.status(400).json({ ok: false, message: 'La convocatoria requiere un título.' });
  }

  if (!isValidDate(fechaInicio) || !isValidDate(fechaFin)) {
    return response.status(400).json({ ok: false, message: 'Las fechas de la convocatoria no son válidas.' });
  }

  if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
    return response.status(400).json({ ok: false, message: 'La fecha de fin no puede ser anterior a la de inicio.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO convocatorias (titulo, descripcion, fecha_inicio, fecha_fin)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [titulo, descripcion, fechaInicio, fechaFin]
    );

    return response.status(201).json({ ok: true, convocatoria: result.rows[0] });
  } catch (error) {
    console.error('createConvocatoriaController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo crear la convocatoria.' });
  }
}

export async function updateConvocatoriaController(request, response) {
  const { id } = request.params;
  const payload = request.body ?? {};
  const titulo = normalizeString(getBodyValue(payload, ['titulo', 'title']));
  const descripcion = normalizeString(getBodyValue(payload, ['descripcion', 'description']));
  const fechaInicio = toNullableString(getBodyValue(payload, ['fechaInicio', 'fecha_inicio']));
  const fechaFin = toNullableString(getBodyValue(payload, ['fechaFin', 'fecha_fin']));

  if (!isValidDate(fechaInicio) || !isValidDate(fechaFin)) {
    return response.status(400).json({ ok: false, message: 'Las fechas de la convocatoria no son válidas.' });
  }

  if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
    return response.status(400).json({ ok: false, message: 'La fecha de fin no puede ser anterior a la de inicio.' });
  }

  try {
    const result = await pool.query(
      `UPDATE convocatorias
       SET titulo = COALESCE($1, titulo),
           descripcion = COALESCE($2, descripcion),
           fecha_inicio = CASE WHEN $3::boolean THEN $4::date ELSE fecha_inicio END,
           fecha_fin = CASE WHEN $5::boolean THEN $6::date ELSE fecha_fin END
       WHERE id = $7
       RETURNING *`,
      [
        titulo,
        descripcion,
        hasBodyValue(payload, ['fechaInicio', 'fecha_inicio']),
        fechaInicio,
        hasBodyValue(payload, ['fechaFin', 'fecha_fin']),
        fechaFin,
        id,
      ]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'Convocatoria no encontrada.' });
    }

    return response.json({ ok: true, convocatoria: result.rows[0] });
  } catch (error) {
    // La fecha enviada choca con la que ya estaba guardada (restricción de la tabla).
    if (error?.code === '23514') {
      return response.status(400).json({ ok: false, message: 'La fecha de fin no puede ser anterior a la de inicio.' });
    }
    console.error('updateConvocatoriaController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo actualizar la convocatoria.' });
  }
}

export async function deleteConvocatoriaController(request, response) {
  const { id } = request.params;

  try {
    const result = await pool.query(
      `DELETE FROM convocatorias WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'Convocatoria no encontrada.' });
    }

    return response.json({ ok: true, deletedConvocatoriaId: Number(result.rows[0].id) });
  } catch (error) {
    console.error('deleteConvocatoriaController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo eliminar la convocatoria.' });
  }
}

export async function listConvocatoriaOffersController(request, response) {
  const { id } = request.params;

  try {
    const exists = await pool.query('SELECT id FROM convocatorias WHERE id = $1', [id]);
    if (exists.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'Convocatoria no encontrada.' });
    }

    const result = await pool.query(
      `SELECT o.*, org.razon_social AS empresa, org.verificada
       FROM ofertas o
       INNER JOIN organizaciones org ON org.perfil_id = o.organizacion_id
       WHERE o.convocatoria_id = $1 AND o.estado = 'PUBLICADA'
       ORDER BY o.created_at DESC`,
      [id]
    );

    return response.json({ ok: true, offers: result.rows });
  } catch (error) {
    console.error('listConvocatoriaOffersController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudieron listar las ofertas de la convocatoria.' });
  }
}

// Asocia la oferta :offerId a la convocatoria :id.
export async function assignOfferToConvocatoriaController(request, response) {
  const { id, offerId } = request.params;

  try {
    const exists = await pool.query('SELECT id FROM convocatorias WHERE id = $1', [id]);
    if (exists.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'Convocatoria no encontrada.' });
    }

    const result = await pool.query(
      `UPDATE ofertas
       SET convocatoria_id = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, convocatoria_id`,
      [id, offerId]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'Oferta no encontrada.' });
    }

    return response.json({ ok: true, offer: result.rows[0] });
  } catch (error) {
    console.error('assignOfferToConvocatoriaController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo asociar la oferta a la convocatoria.' });
  }
}

// Quita la oferta :offerId de la convocatoria :id.
export async function unassignOfferFromConvocatoriaController(request, response) {
  const { id, offerId } = request.params;

  try {
    const result = await pool.query(
      `UPDATE ofertas
       SET convocatoria_id = NULL, updated_at = NOW()
       WHERE id = $1 AND convocatoria_id = $2
       RETURNING id, convocatoria_id`,
      [offerId, id]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'La oferta no pertenece a esta convocatoria.' });
    }

    return response.json({ ok: true, offer: result.rows[0] });
  } catch (error) {
    console.error('unassignOfferFromConvocatoriaController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo quitar la oferta de la convocatoria.' });
  }
}
