import {
  getBodyValue,
  hasBodyValue,
  normalizeNumber,
  normalizeString,
} from '../../core/http/payload.js';
import {
  EXPERIENCE_LEVELS,
  LANGUAGE_LEVELS,
  MODALITIES,
  OFFER_LIMITS as L,
  OFFER_STATUSES,
  OFFER_TYPES,
  PRACTICE_EXPERIENCE_LEVELS,
  WORK_SCHEDULES,
  normalizeModality,
} from './offers.domain.js';

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
  // Fase 8: requisitos y condiciones estructurados.
  programas: ['programas', 'programs'],
  semestre_minimo: ['semestreMinimo', 'semestre_minimo', 'minSemester'],
  habilidades: ['habilidades', 'skills'],
  experiencia: ['experiencia', 'experience'],
  idiomas: ['idiomas', 'languages'],
  jornada: ['jornada', 'workSchedule'],
  beneficios: ['beneficios', 'benefits'],
  vacantes: ['vacantes', 'vacancies'],
};

export const REQUIRED_TEXT_FIELDS = ['titulo', 'descripcion', 'tipo', 'estado', 'area'];

// Máximo de caracteres de los textos libres cortos.
const TEXT_MAX = { titulo: L.titleMax, descripcion: L.descriptionMax, ubicacion: 180, area: 100, duracion: 120, horario: 120, contacto_email: 254 };

class OfferInputError extends Error {}
const fail = (message) => { throw new OfferInputError(message); };

function isValidDateValue(value) {
  return Number.isFinite(new Date(value).getTime());
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const countWords = (text) => String(text ?? '').trim().split(/\s+/).filter((word) => /\p{L}/u.test(word)).length;
const countLetters = (text) => (String(text ?? '').match(/\p{L}/gu) ?? []).length;

// Lista de textos: acepta un arreglo o texto separado por comas o saltos de línea,
// quita espacios y repetidos (sin distinguir mayúsculas) y valida cantidad y largo.
function parseTextList(raw, { max, minChars, maxChars, label }) {
  const items = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/\r?\n|,/) : raw == null ? [] : fail(`${label} debe ser una lista.`);
  const seen = new Set();
  const values = [];
  for (const item of items) {
    const text = String(item ?? '').trim().replace(/\s+/g, ' ');
    if (!text) continue;
    if (text.length < minChars || text.length > maxChars) fail(`Cada elemento de ${label.toLowerCase()} debe tener entre ${minChars} y ${maxChars} caracteres.`);
    const key = text.toLocaleLowerCase('es');
    if (seen.has(key)) continue;
    seen.add(key);
    values.push(text);
  }
  if (values.length > max) fail(`${label} admite como máximo ${max} elementos.`);
  return values;
}

// Código de un catálogo ("tiempo_completo" -> "TIEMPO_COMPLETO"); vacío -> null.
function parseCode(raw, catalog, message) {
  const text = normalizeString(raw);
  if (text === null) return null;
  const code = text.toUpperCase();
  return catalog.includes(code) ? code : fail(message);
}

function parseInteger(raw, { min, max, message }) {
  if (raw === null || raw === '' || raw === undefined) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= min && value <= max ? value : fail(message);
}

// [{ idioma: 'Inglés', nivel: 'B2' }]; un idioma repetido conserva el primero.
function parseLanguages(raw) {
  if (raw === null || raw === undefined || raw === '') return [];
  if (!Array.isArray(raw)) fail('Los idiomas deben enviarse como una lista.');
  if (raw.length > L.languagesMax) fail(`Puedes pedir como máximo ${L.languagesMax} idiomas.`);
  const seen = new Set();
  const values = [];
  for (const item of raw) {
    const idioma = String(item?.idioma ?? item?.language ?? '').trim();
    const nivel = String(item?.nivel ?? item?.level ?? '').trim().toUpperCase();
    if (idioma.length < 2 || idioma.length > 40) fail('Indica el nombre de cada idioma (entre 2 y 40 caracteres).');
    if (!LANGUAGE_LEVELS.includes(nivel)) fail(`El nivel de ${idioma} debe ser ${LANGUAGE_LEVELS.join(', ')}.`);
    const key = idioma.toLocaleLowerCase('es');
    if (seen.has(key)) continue;
    seen.add(key);
    values.push({ idioma, nivel });
  }
  return values;
}

function parseField(column, raw) {
  switch (column) {
    case 'requisitos':
      return parseTextList(raw, { max: L.requirementsMax, minChars: L.requirementMinChars, maxChars: L.requirementMaxChars, label: 'Los requisitos adicionales' });
    case 'habilidades':
      return parseTextList(raw, { max: L.skillsMax, minChars: L.skillMinChars, maxChars: L.skillMaxChars, label: 'Las habilidades' });
    case 'programas':
      return parseTextList(raw, { max: L.programsMax, minChars: 3, maxChars: 120, label: 'Los programas' });
    case 'beneficios':
      return parseTextList(raw, { max: L.benefitsMax, minChars: 2, maxChars: 60, label: 'Los beneficios' });
    case 'idiomas':
      return parseLanguages(raw);
    case 'experiencia':
      return parseCode(raw, EXPERIENCE_LEVELS, 'La experiencia requerida no es una opción válida.');
    case 'jornada':
      return parseCode(raw, WORK_SCHEDULES, 'La jornada no es una opción válida.');
    case 'semestre_minimo':
      return parseInteger(raw, { min: 1, max: L.semesterMax, message: `El semestre mínimo debe estar entre 1 y ${L.semesterMax}.` });
    case 'vacantes':
      return parseInteger(raw, { min: 1, max: L.vacanciesMax, message: `Las vacantes deben ser un número entre 1 y ${L.vacanciesMax}.` }) ?? 1;
    case 'remuneracion':
    case 'remuneracion_maxima': {
      const amount = normalizeNumber(raw);
      if (raw !== null && raw !== '' && (amount === null || amount < 0)) fail('La remuneración debe ser un número positivo.');
      if (amount !== null && amount > L.salaryMax) fail('La remuneración supera el máximo permitido.');
      return amount;
    }
    case 'fecha_publicacion':
    case 'fecha_cierre': {
      const date = raw === null || raw === '' ? null : String(raw);
      if (date !== null && !isValidDateValue(date)) fail('Las fechas de la oferta no son válidas.');
      return date;
    }
    default: {
      const text = normalizeString(raw);
      if (text !== null && TEXT_MAX[column] && text.length > TEXT_MAX[column]) {
        fail(`El campo ${column.replace('_', ' ')} admite como máximo ${TEXT_MAX[column]} caracteres.`);
      }
      return text;
    }
  }
}

// Normaliza y valida los campos de una oferta presentes en el cuerpo.
// Devuelve { values } con los valores listos para SQL o { error } con el mensaje.
export function parseOfferPayload(payload) {
  const values = {};

  try {
    for (const [column, keys] of Object.entries(OFFER_FIELDS)) {
      if (!hasBodyValue(payload, keys)) continue;
      values[column] = parseField(column, getBodyValue(payload, keys) ?? null);
    }
  } catch (error) {
    if (error instanceof OfferInputError) return { error: error.message };
    throw error;
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

  if (values.fecha_cierre && new Date(values.fecha_cierre).getTime() > Date.now() + L.closeMaxDays * 86400000) {
    return { error: 'La fecha de cierre no puede ser posterior a un año.' };
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

// Ajusta los campos que no aplican al tipo de oferta: la formación no tiene
// remuneración, experiencia ni semestre; solo la práctica pide semestre.
export function applyTypeRules(offer) {
  const adjusted = { ...offer };
  if (adjusted.tipo === 'FORMACION') {
    adjusted.remuneracion = null;
    adjusted.remuneracion_maxima = null;
    adjusted.experiencia = null;
    adjusted.semestre_minimo = null;
  } else if (adjusted.tipo !== 'PRACTICA') {
    adjusted.semestre_minimo = null;
  }
  if (adjusted.tipo === 'PRACTICA') adjusted.remuneracion_maxima = null;
  return adjusted;
}

// Lo que una oferta necesita para publicarse. Devuelve { campo: mensaje } con los
// problemas encontrados (vacío si puede publicarse). El formulario del frontend
// aplica las mismas reglas antes de enviar.
export function publicationErrors(offer) {
  const errors = {};
  const title = String(offer.titulo ?? '').trim();
  const description = String(offer.descripcion ?? '').trim();

  if (title.length < L.titleMin || countLetters(title) < 3) {
    errors.titulo = `El título debe describir el cargo (al menos ${L.titleMin} caracteres).`;
  }
  if (description.length < L.descriptionMinChars || countWords(description) < L.descriptionMinWords) {
    errors.descripcion = `Describe la oportunidad con al menos ${L.descriptionMinWords} palabras (${L.descriptionMinChars} caracteres): qué hará la persona y qué ofreces.`;
  }
  if (!normalizeString(offer.area)) errors.area = 'Elige el área de la oferta.';
  if (!normalizeString(offer.ubicacion)) errors.ubicacion = 'Indica la ciudad de la oferta.';
  if (!normalizeString(offer.modalidad)) errors.modalidad = 'Elige la modalidad.';
  if (!normalizeString(offer.contacto_email)) errors.contacto_email = 'Indica un correo de contacto.';
  if (!offer.fecha_cierre) errors.fecha_cierre = 'Indica hasta cuándo se reciben postulaciones.';

  const skills = Array.isArray(offer.habilidades) ? offer.habilidades : [];
  if (skills.length < L.skillsMin) {
    errors.habilidades = offer.tipo === 'FORMACION'
      ? 'Agrega al menos un tema o habilidad que se aprenderá.'
      : 'Agrega al menos una habilidad que buscas en el candidato.';
  }

  if (offer.tipo === 'PRACTICA' && offer.experiencia && !PRACTICE_EXPERIENCE_LEVELS.includes(offer.experiencia)) {
    errors.experiencia = 'Una práctica es para estudiantes: no puede exigir más de un año de experiencia.';
  }

  const salary = offer.remuneracion === null || offer.remuneracion === undefined ? null : Number(offer.remuneracion);
  if (offer.tipo === 'PRACTICA' && salary !== null && salary <= 0) {
    errors.remuneracion = 'Si la práctica no tiene apoyo económico, deja la remuneración vacía.';
  }
  if ((offer.tipo === 'EMPLEO' || offer.tipo === 'EMPLEO_PUBLICO') && !(salary > 0)) {
    errors.remuneracion = 'Indica el salario mensual del empleo.';
  }

  return errors;
}
