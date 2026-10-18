import {
  getBodyValue,
  hasBodyValue,
  normalizeNumber,
  normalizeString,
  normalizeStringList,
} from '../../core/http/payload.js';
import { MODALITIES, OFFER_STATUSES, OFFER_TYPES, normalizeModality } from './offers.domain.js';

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

export const REQUIRED_TEXT_FIELDS = ['titulo', 'descripcion', 'tipo', 'estado', 'area'];

function isValidDateValue(value) {
  return Number.isFinite(new Date(value).getTime());
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Normaliza y valida los campos de una oferta presentes en el cuerpo.
// Devuelve { values } con los valores listos para SQL o { error } con el mensaje.
export function parseOfferPayload(payload) {
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
      return { error: `El tipo de oferta debe ser ${OFFER_TYPES.join(', ')}.` };
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
export function validateOfferState(offer) {
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
