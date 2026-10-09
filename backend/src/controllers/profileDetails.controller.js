import { pool } from '../config/database.js';
import { getBodyValue } from '../utils/payload.js';

// #Fase 6: educación, experiencia y habilidades en PostgreSQL, y archivos del
// perfil (hoja de vida y foto). Antes estos datos solo vivían en el navegador.

const MAX_ITEMS = 30;
const MAX_SKILLS = 100;

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

// Perfil del usuario al que se asocian detalles y archivos. Se prioriza el perfil
// candidato (igual que en las postulaciones); la organización solo tiene foto.
async function findProfile(userId, { candidateOnly }) {
  const result = await pool.query(
    `SELECT id, tipo FROM perfiles
     WHERE usuario_id = $1 AND tipo = ANY($2::profile_type[])
     ORDER BY CASE tipo WHEN 'CANDIDATO_EXTERNO' THEN 1 WHEN 'ESTUDIANTE' THEN 2 ELSE 3 END
     LIMIT 1`,
    [userId, candidateOnly ? ['CANDIDATO_EXTERNO', 'ESTUDIANTE'] : ['CANDIDATO_EXTERNO', 'ESTUDIANTE', 'ORGANIZACION']]
  );

  return result.rows[0] ?? null;
}

function cleanText(value, maxLength) {
  const text = String(value ?? '').trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

async function loadDetails(profileId) {
  const [education, experience, skills] = await Promise.all([
    pool.query(
      'SELECT id, titulo, institucion, periodo FROM perfil_educacion WHERE perfil_id = $1 ORDER BY orden, id',
      [profileId]
    ),
    pool.query(
      'SELECT id, cargo, empresa, periodo, descripcion FROM perfil_experiencia WHERE perfil_id = $1 ORDER BY orden, id',
      [profileId]
    ),
    pool.query(
      'SELECT id, categoria, nombre FROM perfil_habilidades WHERE perfil_id = $1 ORDER BY categoria, id',
      [profileId]
    ),
  ]);

  return { education: education.rows, experience: experience.rows, skills: skills.rows };
}

export async function getProfileDetailsController(request, response) {
  try {
    const profile = await findProfile(request.auth.sub, { candidateOnly: true });
    if (!profile) {
      return response.status(404).json({ ok: false, message: 'Solo los perfiles de estudiante o candidato tienen hoja de vida.' });
    }

    return response.json({ ok: true, details: await loadDetails(profile.id) });
  } catch (error) {
    console.error('getProfileDetailsController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo cargar el detalle del perfil.' });
  }
}

// Reemplaza la colección completa en una transacción: el cliente envía la lista final.
function makeReplaceController({ table, columns, parse, maxItems, label }) {
  return async (request, response) => {
    const items = getBodyValue(request.body ?? {}, ['items']);

    if (!Array.isArray(items)) {
      return response.status(400).json({ ok: false, message: 'Debe enviar la lista items.' });
    }

    if (items.length > maxItems) {
      return response.status(400).json({ ok: false, message: `${label} admite como máximo ${maxItems} elementos.` });
    }

    const rows = [];
    for (const item of items) {
      const parsed = parse(item ?? {});
      if (parsed.error) return response.status(400).json({ ok: false, message: parsed.error });
      rows.push(parsed.values);
    }

    const profile = await findProfile(request.auth.sub, { candidateOnly: true });
    if (!profile) {
      return response.status(404).json({ ok: false, message: 'Solo los perfiles de estudiante o candidato tienen hoja de vida.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM ${table} WHERE perfil_id = $1`, [profile.id]);

      for (const [index, values] of rows.entries()) {
        const placeholders = columns.map((_column, position) => `$${position + 2}`);
        await client.query(
          `INSERT INTO ${table} (perfil_id, ${columns.join(', ')}) VALUES ($1, ${placeholders.join(', ')})`,
          [profile.id, ...columns.map((column) => (column === 'orden' ? index : values[column]))]
        );
      }

      await client.query('COMMIT');
      return response.json({ ok: true, details: await loadDetails(profile.id) });
    } catch (error) {
      await client.query('ROLLBACK');
      if (error?.code === '23505') {
        return response.status(400).json({ ok: false, message: 'Hay habilidades repetidas en la misma categoría.' });
      }
      console.error(`replace ${table} error:`, error);
      return response.status(500).json({ ok: false, message: 'No se pudieron guardar los cambios.' });
    } finally {
      client.release();
    }
  };
}

export const replaceEducationController = makeReplaceController({
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
      return { error: 'Cada formación necesita título, institución y periodo.' };
    }
    return { values };
  },
});

export const replaceExperienceController = makeReplaceController({
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
      return { error: 'Cada experiencia necesita cargo, empresa y periodo.' };
    }
    return { values };
  },
});

export const replaceSkillsController = makeReplaceController({
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
      return { error: 'Cada habilidad necesita categoría y nombre.' };
    }
    return { values };
  },
});

function resolveFileRule(request, response) {
  const rule = FILE_RULES[String(request.params.tipo).toLowerCase()];
  if (!rule) {
    response.status(404).json({ ok: false, message: 'Tipo de archivo no reconocido.' });
    return null;
  }
  return rule;
}

export function sendStoredFile(response, file) {
  const encodedName = encodeURIComponent(file.nombre);
  response.set('Content-Type', file.mime);
  response.set('Content-Length', String(file.tamano));
  response.set('Content-Disposition', `inline; filename*=UTF-8''${encodedName}`);
  response.set('Cache-Control', 'private, no-store');
  response.set('X-Content-Type-Options', 'nosniff');
  return response.send(file.contenido);
}

export async function uploadProfileFileController(request, response) {
  const rule = resolveFileRule(request, response);
  if (!rule) return undefined;

  const buffer = Buffer.isBuffer(request.body) ? request.body : null;
  if (!buffer || buffer.length === 0) {
    return response.status(400).json({ ok: false, message: 'No se recibió ningún archivo.' });
  }

  if (buffer.length > rule.maxBytes) {
    return response.status(413).json({ ok: false, message: `${rule.label} no puede superar ${rule.maxBytes / 1024 / 1024} MB.` });
  }

  const mime = String(request.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const matches = rule.allowed[mime];
  if (!matches || !matches(buffer)) {
    const formats = rule.tipo === 'CV' ? 'PDF' : 'PNG, JPG o WEBP';
    return response.status(415).json({ ok: false, message: `${rule.label} debe ser un archivo ${formats} válido.` });
  }

  let fileName;
  try {
    fileName = cleanText(decodeURIComponent(request.get('x-file-name') ?? ''), 200);
  } catch {
    fileName = '';
  }
  fileName = fileName.replace(/[\\/\r\n"]/g, '_') || (rule.tipo === 'CV' ? 'hoja-de-vida.pdf' : 'foto');

  try {
    const profile = await findProfile(request.auth.sub, { candidateOnly: rule.candidateOnly });
    if (!profile) {
      return response.status(404).json({ ok: false, message: 'Tu cuenta no tiene un perfil que admita este archivo.' });
    }

    const result = await pool.query(
      `INSERT INTO archivos (perfil_id, tipo, nombre, mime, tamano, contenido)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (perfil_id, tipo) DO UPDATE
         SET nombre = EXCLUDED.nombre, mime = EXCLUDED.mime, tamano = EXCLUDED.tamano,
             contenido = EXCLUDED.contenido, created_at = NOW()
       RETURNING tipo, nombre, mime, tamano, created_at`,
      [profile.id, rule.tipo, fileName, mime, buffer.length, buffer]
    );

    return response.status(201).json({ ok: true, file: result.rows[0] });
  } catch (error) {
    console.error('uploadProfileFileController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo guardar el archivo.' });
  }
}

export async function getProfileFileController(request, response) {
  const rule = resolveFileRule(request, response);
  if (!rule) return undefined;

  try {
    const result = await pool.query(
      `SELECT a.nombre, a.mime, a.tamano, a.contenido
       FROM archivos a
       INNER JOIN perfiles p ON p.id = a.perfil_id
       WHERE p.usuario_id = $1 AND a.tipo = $2
       ORDER BY CASE p.tipo WHEN 'CANDIDATO_EXTERNO' THEN 1 WHEN 'ESTUDIANTE' THEN 2 ELSE 3 END
       LIMIT 1`,
      [request.auth.sub, rule.tipo]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'No has subido este archivo.' });
    }

    return sendStoredFile(response, result.rows[0]);
  } catch (error) {
    console.error('getProfileFileController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo obtener el archivo.' });
  }
}

export async function deleteProfileFileController(request, response) {
  const rule = resolveFileRule(request, response);
  if (!rule) return undefined;

  try {
    const result = await pool.query(
      `DELETE FROM archivos a USING perfiles p
       WHERE p.id = a.perfil_id AND p.usuario_id = $1 AND a.tipo = $2
       RETURNING a.id`,
      [request.auth.sub, rule.tipo]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'No has subido este archivo.' });
    }

    return response.json({ ok: true });
  } catch (error) {
    console.error('deleteProfileFileController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo eliminar el archivo.' });
  }
}
