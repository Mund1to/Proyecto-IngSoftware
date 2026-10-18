// Acceso a datos de la hoja de vida estructurada y de los archivos del perfil.
import { pool } from '../../core/database/database.js';

// Perfil del usuario al que se asocian detalles y archivos. Se prioriza el perfil
// candidato (igual que en las postulaciones); la organización solo tiene foto.
export async function findProfile(userId, { candidateOnly }) {
  const result = await pool.query(
    `SELECT id, tipo FROM perfiles
     WHERE usuario_id = $1 AND tipo = ANY($2::profile_type[])
     ORDER BY CASE tipo WHEN 'CANDIDATO_EXTERNO' THEN 1 WHEN 'ESTUDIANTE' THEN 2 ELSE 3 END
     LIMIT 1`,
    [userId, candidateOnly ? ['CANDIDATO_EXTERNO', 'ESTUDIANTE'] : ['CANDIDATO_EXTERNO', 'ESTUDIANTE', 'ORGANIZACION']]
  );

  return result.rows[0] ?? null;
}

export async function loadDetails(profileId) {
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

// Reemplaza todas las filas de `table` del perfil por `rows`. La columna `orden`,
// si existe, toma la posición de cada fila. `table` y `columns` vienen del código, no del cliente.
export async function replaceCollection(db, { table, columns }, profileId, rows) {
  await db.query(`DELETE FROM ${table} WHERE perfil_id = $1`, [profileId]);

  for (const [index, values] of rows.entries()) {
    const placeholders = columns.map((_column, position) => `$${position + 2}`);
    await db.query(
      `INSERT INTO ${table} (perfil_id, ${columns.join(', ')}) VALUES ($1, ${placeholders.join(', ')})`,
      [profileId, ...columns.map((column) => (column === 'orden' ? index : values[column]))]
    );
  }
}

// Guarda o reemplaza el archivo de ese tipo del perfil.
export async function upsertFile(profileId, { tipo, nombre, mime, contenido }) {
  const result = await pool.query(
    `INSERT INTO archivos (perfil_id, tipo, nombre, mime, tamano, contenido)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (perfil_id, tipo) DO UPDATE
       SET nombre = EXCLUDED.nombre, mime = EXCLUDED.mime, tamano = EXCLUDED.tamano,
           contenido = EXCLUDED.contenido, created_at = NOW()
     RETURNING tipo, nombre, mime, tamano, created_at`,
    [profileId, tipo, nombre, mime, contenido.length, contenido]
  );
  return result.rows[0];
}

export async function findUserFile(userId, tipo) {
  const result = await pool.query(
    `SELECT a.nombre, a.mime, a.tamano, a.contenido
     FROM archivos a
     INNER JOIN perfiles p ON p.id = a.perfil_id
     WHERE p.usuario_id = $1 AND a.tipo = $2
     ORDER BY CASE p.tipo WHEN 'CANDIDATO_EXTERNO' THEN 1 WHEN 'ESTUDIANTE' THEN 2 ELSE 3 END
     LIMIT 1`,
    [userId, tipo]
  );
  return result.rows[0] ?? null;
}

export async function deleteUserFile(userId, tipo) {
  const result = await pool.query(
    `DELETE FROM archivos a USING perfiles p
     WHERE p.id = a.perfil_id AND p.usuario_id = $1 AND a.tipo = $2
     RETURNING a.id`,
    [userId, tipo]
  );
  return result.rowCount > 0;
}
