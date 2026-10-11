// #Fase 6: educación, experiencia y habilidades en PostgreSQL, y archivos del
// perfil (hoja de vida y foto). Antes estos datos solo vivían en el navegador.
import { withTransaction } from '../../core/database/database.js';
import { HttpError, badRequest, notFound } from '../../core/http/errors.js';
import * as detailsRepository from './profileDetails.repository.js';

const MAX_ITEMS = 30;
const MAX_SKILLS = 100;
const NO_RESUME_MESSAGE = 'Solo los perfiles de estudiante o candidato tienen hoja de vida.';

export const FILE_RULES = {
  cv: {
    tipo: 'CV',
    maxBytes: 5 * 1024 * 1024,
    label: 'La hoja de vida',
    allowed: { 'application/pdf': (buffer) => buffer.subarray(0, 5).toString('latin1') === '%PDF-' },
    candidateOnly: true,
  },
  foto: {
    tipo: 'FOTO',
    maxBytes: 2 * 1024 * 1024,
    label: 'La foto',
    allowed: {
      'image/png': (buffer) => buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
      'image/jpeg': (buffer) => buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
      'image/webp': (buffer) => buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP',
    },
    candidateOnly: false,
  },
};

function cleanText(value, maxLength) {
  const text = String(value ?? '').trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

async function requireResumeProfile(userId) {
  const profile = await detailsRepository.findProfile(userId, { candidateOnly: true });
  if (!profile) throw notFound(NO_RESUME_MESSAGE);
  return profile;
}

export async function getDetails(userId) {
  const profile = await requireResumeProfile(userId);
  return detailsRepository.loadDetails(profile.id);
}

// Colecciones de la hoja de vida. `parse` valida y limpia un elemento.
export const COLLECTIONS = {
  education: {
    table: 'perfil_educacion',
    columns: ['titulo', 'institucion', 'periodo', 'orden'],
    maxItems: MAX_ITEMS,
    label: 'La educación',
    parse: (item) => {
      const values = {
        titulo: cleanText(item.titulo ?? item.title, 200),
        institucion: cleanText(item.institucion ?? item.institution, 200),
        periodo: cleanText(item.periodo ?? item.period, 100),
      };
      if (!values.titulo || !values.institucion || !values.periodo) {
        throw badRequest('Cada formación necesita título, institución y periodo.');
      }
      return values;
    },
  },
  experience: {
    table: 'perfil_experiencia',
    columns: ['cargo', 'empresa', 'periodo', 'descripcion', 'orden'],
    maxItems: MAX_ITEMS,
    label: 'La experiencia',
    parse: (item) => {
      const values = {
        cargo: cleanText(item.cargo ?? item.title, 200),
        empresa: cleanText(item.empresa ?? item.company, 200),
        periodo: cleanText(item.periodo ?? item.period, 100),
        descripcion: cleanText(item.descripcion ?? item.description, 2000) || null,
      };
      if (!values.cargo || !values.empresa || !values.periodo) {
        throw badRequest('Cada experiencia necesita cargo, empresa y periodo.');
      }
      return values;
    },
  },
  skills: {
    table: 'perfil_habilidades',
    columns: ['categoria', 'nombre'],
    maxItems: MAX_SKILLS,
    label: 'Las habilidades',
    parse: (item) => {
      const values = {
        categoria: cleanText(item.categoria ?? item.category, 80),
        nombre: cleanText(item.nombre ?? item.name, 100),
      };
      if (!values.categoria || !values.nombre) {
        throw badRequest('Cada habilidad necesita categoría y nombre.');
      }
      return values;
    },
  },
};

// Reemplaza la colección completa en una transacción: el cliente envía la lista final.
export async function replaceCollection(userId, collection, items) {
  if (!Array.isArray(items)) throw badRequest('Debe enviar la lista items.');

  if (items.length > collection.maxItems) {
    throw badRequest(`${collection.label} admite como máximo ${collection.maxItems} elementos.`);
  }

  const rows = items.map((item) => collection.parse(item ?? {}));
  const profile = await requireResumeProfile(userId);

  try {
    await withTransaction((db) => detailsRepository.replaceCollection(db, collection, profile.id, rows));
  } catch (error) {
    if (error?.code === '23505') throw badRequest('Hay habilidades repetidas en la misma categoría.');
    throw error;
  }

  return detailsRepository.loadDetails(profile.id);
}

export function resolveFileRule(tipo) {
  const rule = FILE_RULES[String(tipo).toLowerCase()];
  if (!rule) throw notFound('Tipo de archivo no reconocido.');
  return rule;
}

function cleanFileName(rawName, rule) {
  let fileName;
  try {
    fileName = cleanText(decodeURIComponent(rawName ?? ''), 200);
  } catch {
    fileName = '';
  }
  return fileName.replace(/[\\/\r\n"]/g, '_') || (rule.tipo === 'CV' ? 'hoja-de-vida.pdf' : 'foto');
}

// Valida tamaño y tipo real del archivo (por su firma, no solo por la cabecera).
export async function uploadFile(userId, tipo, { buffer, contentType, rawName }) {
  const rule = resolveFileRule(tipo);

  if (!buffer || buffer.length === 0) throw badRequest('No se recibió ningún archivo.');

  if (buffer.length > rule.maxBytes) {
    throw new HttpError(413, `${rule.label} no puede superar ${rule.maxBytes / 1024 / 1024} MB.`);
  }

  const mime = String(contentType ?? '').split(';')[0].trim().toLowerCase();
  const matches = rule.allowed[mime];
  if (!matches || !matches(buffer)) {
    const formats = rule.tipo === 'CV' ? 'PDF' : 'PNG, JPG o WEBP';
    throw new HttpError(415, `${rule.label} debe ser un archivo ${formats} válido.`);
  }

  const nombre = cleanFileName(rawName, rule);

  const profile = await detailsRepository.findProfile(userId, { candidateOnly: rule.candidateOnly });
  if (!profile) throw notFound('Tu cuenta no tiene un perfil que admita este archivo.');

  return detailsRepository.upsertFile(profile.id, { tipo: rule.tipo, nombre, mime, contenido: buffer });
}

export async function getFile(userId, tipo) {
  const rule = resolveFileRule(tipo);
  const file = await detailsRepository.findUserFile(userId, rule.tipo);
  if (!file) throw notFound('No has subido este archivo.');
  return file;
}

export async function deleteFile(userId, tipo) {
  const rule = resolveFileRule(tipo);
  if (!(await detailsRepository.deleteUserFile(userId, rule.tipo))) throw notFound('No has subido este archivo.');
}
