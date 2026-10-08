import { pool } from '../config/database.js';
import { getBodyValue, normalizeString, toNullableString } from '../utils/payload.js';

// #18 HU-14: convocatorias públicas (Fase 4).
// Lectura abierta a cualquier usuario; creación y edición solo para
// ADMINISTRADOR o FUNCIONARIO_PUBLICO.

function isValidDate(value) {
  return value === null || Number.isFinite(new Date(`${value}T00:00:00Z`).getTime());
}

export async function listConvocatoriasController(_request, response) {
  try {
    const result = await pool.query(
      `SELECT c.*, COUNT(o.id) AS total_ofertas
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
      `SELECT c.*, COUNT(o.id) AS total_ofertas
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
        getBodyValue(payload, ['fechaInicio', 'fecha_inicio']) !== undefined,
        fechaInicio,
        getBodyValue(payload, ['fechaFin', 'fecha_fin']) !== undefined,
        fechaFin,
        id,
      ]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'Convocatoria no encontrada.' });
    }

    return response.json({ ok: true, convocatoria: result.rows[0] });
  } catch (error) {
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

// Asocia o desasocia una oferta a una convocatoria.
// Solo la organización propietaria de la oferta o un funcionario puede hacerlo.
export async function assignOfferToConvocatoriaController(request, response) {
  const { id, offerId } = request.params;
  const payload = request.body ?? {};
  const rawConvocatoriaId = getBodyValue(payload, ['convocatoriaId', 'convocatoria_id']);
  const convocatoriaId = rawConvocatoriaId === null ? null : Number(rawConvocatoriaId);

  if (rawConvocatoriaId !== null && !Number.isInteger(convocatoriaId)) {
    return response.status(400).json({ ok: false, message: 'La convocatoria indicada no es válida.' });
  }

  try {
    if (convocatoriaId !== null) {
      const exists = await pool.query('SELECT id FROM convocatorias WHERE id = $1', [convocatoriaId]);
      if (exists.rowCount === 0) {
        return response.status(404).json({ ok: false, message: 'Convocatoria no encontrada.' });
      }
    }

    const result = await pool.query(
      `UPDATE ofertas
       SET convocatoria_id = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, convocatoria_id`,
      [convocatoriaId, offerId]
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
