import { pool } from '../config/database.js';
import { getOrganizationProfileId } from '../utils/profiles.js';
import { MODALITIES, OFFER_STATUSES, OFFER_TYPES, normalizeModality } from '../utils/offers.js';
import {
  getBodyValue,
  hasBodyValue,
  normalizeNumber,
  normalizeString,
  normalizeStringList,
} from '../utils/payload.js';

// Campos editables de una oferta: claves aceptadas en el cuerpo y columna asociada.
const OFFER_FIELDS = {
  titulo: ['titulo', 'title'],
  descripcion: ['descripcion', 'description'],
  tipo: ['tipo', 'type'],
  estado: ['estado', 'status'],
  ubicacion: ['ubicacion', 'location'],
  modalidad: ['modalidad', 'modality'],
  area: ['area'],
  requisitos: ['requisitos', 'requirements'],
  duracion: ['duracion', 'duration'],
  horario: ['horario', 'schedule'],
  contacto_email: ['contactoEmail', 'contacto_email', 'contact_email', 'contact'],
  remuneracion: ['remuneracion', 'salary', 'salario', 'salaryMin'],
  remuneracion_maxima: ['remuneracionMaxima', 'remuneracion_maxima', 'salaryMax'],
  fecha_publicacion: ['fechaPublicacion', 'fecha_publicacion', 'publishedAt'],
  fecha_cierre: ['fechaCierre', 'fecha_cierre', 'closeAt'],
};

const REQUIRED_TEXT_FIELDS = ['titulo', 'descripcion', 'tipo', 'estado', 'area'];

function isValidDateValue(value) {
  return Number.isFinite(new Date(value).getTime());
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Normaliza y valida los campos de una oferta presentes en el cuerpo.
// Devuelve { values } con los valores listos para SQL o { error } con el mensaje.
function parseOfferPayload(payload) {
  const values = {};

  for (const [column, keys] of Object.entries(OFFER_FIELDS)) {
    if (!hasBodyValue(payload, keys)) continue;
    const raw = getBodyValue(payload, keys) ?? null;

    if (column === 'requisitos') {
      values[column] = normalizeStringList(raw);
    } else if (column === 'remuneracion' || column === 'remuneracion_maxima') {
      const amount = normalizeNumber(raw);
      if (raw !== null && raw !== '' && (amount === null || amount < 0)) {
        return { error: 'La remuneración debe ser un número positivo.' };
      }
      values[column] = amount;
    } else if (column === 'fecha_publicacion' || column === 'fecha_cierre') {
      const date = raw === null || raw === '' ? null : String(raw);
      if (date !== null && !isValidDateValue(date)) {
        return { error: 'Las fechas de la oferta no son válidas.' };
      }
      values[column] = date;
    } else {
      values[column] = normalizeString(raw);
    }
  }

  if (values.tipo) {
    values.tipo = values.tipo.toUpperCase();
    if (!OFFER_TYPES.includes(values.tipo)) {
      return { error: 'El tipo de oferta debe ser PRACTICA, EMPLEO o EMPLEO_PUBLICO.' };
    }
  }

  if (values.estado) {
    values.estado = values.estado.toUpperCase();
    if (!OFFER_STATUSES.includes(values.estado)) {
      return { error: 'El estado de la oferta no es válido.' };
    }
  }

  if (values.modalidad !== undefined) {
    const modality = normalizeModality(values.modalidad);
    if (modality === undefined) {
      return { error: `La modalidad debe ser ${MODALITIES.join(', ')}.` };
    }
    values.modalidad = modality;
  }

  if (values.contacto_email && !isValidEmail(values.contacto_email)) {
    return { error: 'El correo de contacto no tiene un formato válido.' };
  }

  if (values.fecha_cierre && new Date(values.fecha_cierre) <= new Date()) {
    return { error: 'La fecha de cierre debe ser una fecha futura válida.' };
  }

  return { values };
}

// Reglas que dependen de varios campos; se evalúan sobre la oferta resultante.
function validateOfferState(offer) {
  if (offer.remuneracion !== null && offer.remuneracion_maxima !== null
    && Number(offer.remuneracion_maxima) < Number(offer.remuneracion)) {
    return 'La remuneración máxima no puede ser menor que la mínima.';
  }

  if (offer.fecha_cierre && offer.fecha_publicacion
    && new Date(offer.fecha_cierre) < new Date(offer.fecha_publicacion)) {
    return 'La fecha de cierre no puede ser anterior a la de publicación.';
  }

  return null;
}

// #20 HU-16: recomienda ofertas publicadas ordenadas por afinidad con el perfil.
// La puntuación combina área, ubicación, requisitos y tipo de oferta. No excluye
// ofertas: las ordena, para que el candidato siempre vea todo el catálogo.
export function scoreOffer(offer, profile) {
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

  const parsed = parseOfferPayload(request.body ?? {});
  if (parsed.error) {
    return response.status(400).json({ ok: false, message: parsed.error });
  }

  const offer = {
    titulo: null,
    descripcion: null,
    tipo: null,
    ubicacion: null,
    modalidad: null,
    requisitos: [],
    duracion: null,
    horario: null,
    contacto_email: null,
    remuneracion: null,
    remuneracion_maxima: null,
    fecha_publicacion: null,
    fecha_cierre: null,
    ...parsed.values,
    estado: parsed.values.estado ?? 'BORRADOR',
    area: parsed.values.area ?? 'General',
  };

  if (!offer.titulo || !offer.descripcion || !offer.tipo) {
    return response.status(400).json({
      ok: false,
      message: 'Se requieren título, descripción y tipo de oferta.',
    });
  }

  // Una oferta publicada siempre registra cuándo se publicó.
  if (offer.estado === 'PUBLICADA' && !offer.fecha_publicacion) {
    offer.fecha_publicacion = new Date().toISOString();
  }

  const stateError = validateOfferState(offer);
  if (stateError) {
    return response.status(400).json({ ok: false, message: stateError });
  }

  try {
    const result = await pool.query(
      `INSERT INTO ofertas (
        organizacion_id, titulo, descripcion, tipo, estado, ubicacion, modalidad, area,
        requisitos, duracion, horario, contacto_email, remuneracion, remuneracion_maxima,
        fecha_publicacion, fecha_cierre
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        organizationId,
        offer.titulo,
        offer.descripcion,
        offer.tipo,
        offer.estado,
        offer.ubicacion,
        offer.modalidad,
        offer.area,
        offer.requisitos,
        offer.duracion,
        offer.horario,
        offer.contacto_email,
        offer.remuneracion,
        offer.remuneracion_maxima,
        offer.fecha_publicacion,
        offer.fecha_cierre,
      ]
    );

    return response.status(201).json({ ok: true, offer: result.rows[0] });
  } catch (error) {
    console.error('createOfferController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo crear la oferta.' });
  }
}

// Actualización parcial: solo cambian los campos enviados. Los campos opcionales
// pueden vaciarse enviando null o una cadena vacía; los obligatorios no.
export async function updateOfferController(request, response) {
  const organizationId = await getOrganizationProfileId(request.auth.sub);
  const { id } = request.params;

  if (!organizationId) {
    return response.status(403).json({ ok: false, message: 'Solo una organización puede actualizar ofertas.' });
  }

  const parsed = parseOfferPayload(request.body ?? {});
  if (parsed.error) {
    return response.status(400).json({ ok: false, message: parsed.error });
  }

  const changes = parsed.values;
  const clearedRequired = REQUIRED_TEXT_FIELDS.find((column) => column in changes && !changes[column]);
  if (clearedRequired) {
    return response.status(400).json({ ok: false, message: 'Título, descripción, tipo, estado y área no pueden quedar vacíos.' });
  }

  try {
    const existing = await pool.query(
      `SELECT * FROM ofertas WHERE id = $1 AND organizacion_id = $2`,
      [id, organizationId]
    );

    if (existing.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'No se encontró una oferta propia para actualizar.' });
    }

    const current = existing.rows[0];
    if (changes.estado === 'PUBLICADA' && !current.fecha_publicacion && !changes.fecha_publicacion) {
      changes.fecha_publicacion = new Date().toISOString();
    }

    const stateError = validateOfferState({ ...current, ...changes });
    if (stateError) {
      return response.status(400).json({ ok: false, message: stateError });
    }

    const columns = Object.keys(changes);
    if (columns.length === 0) {
      return response.json({ ok: true, offer: current });
    }

    const assignments = columns.map((column, index) => `${column} = $${index + 1}`);
    const result = await pool.query(
      `UPDATE ofertas
       SET ${assignments.join(', ')}, updated_at = NOW()
       WHERE id = $${columns.length + 1} AND organizacion_id = $${columns.length + 2}
       RETURNING *`,
      [...columns.map((column) => changes[column]), id, organizationId]
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
