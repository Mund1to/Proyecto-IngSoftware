// Acceso a datos de la cuenta y los perfiles. Las funciones que escriben reciben
// `db` (por defecto el pool) para poder participar en una transacción.
import { pool } from '../../core/database/database.js';

// Devuelve el id del perfil de organización del usuario autenticado (o null).
export async function getOrganizationProfileId(userId, client = pool) {
  const result = await client.query(
    `SELECT id FROM perfiles WHERE usuario_id = $1 AND tipo = 'ORGANIZACION' LIMIT 1`,
    [userId]
  );

  return result.rows[0]?.id ?? null;
}

// Cuenta con roles, perfiles (con sus datos de detalle) y archivos subidos.
export async function findUserProfile(userId, db = pool) {
  const result = await db.query(
    `SELECT u.id, u.email, u.nombre_completo, u.telefono, u.activo, u.created_at,
            COALESCE(array_agg(DISTINCT r.nombre) FILTER (WHERE r.nombre IS NOT NULL), ARRAY[]::VARCHAR[]) AS roles,
            COALESCE(
              json_agg(DISTINCT jsonb_build_object(
                'id', p.id,
                'tipo', p.tipo,
                'visible', p.visible,
                'universidad', pe.universidad,
                'programa_academico', pe.programa_academico,
                'semestre', pe.semestre,
                'codigo_estudiante', pe.codigo_estudiante,
                'fecha_graduacion_estimada', pe.fecha_graduacion_estimada,
                'razon_social', o.razon_social,
                'identificacion_fiscal', o.identificacion_fiscal,
                'sitio_web', o.sitio_web,
                'descripcion', o.descripcion,
                'verificada', o.verificada,
                'resumen', pc.resumen,
                'ubicacion', pc.ubicacion,
                'disponibilidad', pc.disponibilidad,
                'cv_url', pc.cv_url
              )) FILTER (WHERE p.id IS NOT NULL),
              '[]'::json
            ) AS perfiles,
            COALESCE((
              SELECT json_agg(json_build_object('tipo', a.tipo, 'nombre', a.nombre, 'mime', a.mime, 'tamano', a.tamano, 'createdAt', a.created_at))
              FROM archivos a
              INNER JOIN perfiles pa ON pa.id = a.perfil_id
              WHERE pa.usuario_id = u.id
            ), '[]'::json) AS archivos
     FROM usuarios u
     LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
     LEFT JOIN roles r ON r.id = ur.rol_id
     LEFT JOIN perfiles p ON p.usuario_id = u.id
     LEFT JOIN perfiles_estudiante pe ON pe.perfil_id = p.id
     LEFT JOIN perfiles_candidato pc ON pc.perfil_id = p.id
     LEFT JOIN organizaciones o ON o.perfil_id = p.id
     WHERE u.id = $1
     GROUP BY u.id, u.email, u.nombre_completo, u.telefono, u.activo, u.created_at`,
    [userId]
  );

  return result.rows[0] ?? null;
}

// Nombre nulo conserva el actual; el teléfono solo cambia si se envió (puede vaciarse).
export async function updateAccount(userId, { nombreCompleto, phoneSent, telefono }, db = pool) {
  const result = await db.query(
    `UPDATE usuarios
     SET nombre_completo = COALESCE($1, nombre_completo),
         telefono = CASE WHEN $2::boolean THEN $3 ELSE telefono END,
         updated_at = NOW()
     WHERE id = $4
     RETURNING id`,
    [nombreCompleto, phoneSent, telefono, userId]
  );
  return result.rowCount > 0;
}

// Crea la fila de detalle del perfil si falta (cuentas antiguas o creadas a
// mano), para que el UPDATE siguiente no responda 404.
const DETAIL_ROW_SQL = {
  ESTUDIANTE: `INSERT INTO perfiles_estudiante (perfil_id)
               SELECT id FROM perfiles WHERE usuario_id = $1 AND tipo = 'ESTUDIANTE'
               ON CONFLICT (perfil_id) DO NOTHING`,
  CANDIDATO_EXTERNO: `INSERT INTO perfiles_candidato (perfil_id)
                      SELECT id FROM perfiles WHERE usuario_id = $1 AND tipo = 'CANDIDATO_EXTERNO'
                      ON CONFLICT (perfil_id) DO NOTHING`,
  ORGANIZACION: `INSERT INTO organizaciones (perfil_id, razon_social)
                 SELECT p.id, u.nombre_completo FROM perfiles p JOIN usuarios u ON u.id = p.usuario_id
                 WHERE p.usuario_id = $1 AND p.tipo = 'ORGANIZACION'
                 ON CONFLICT (perfil_id) DO NOTHING`,
};

export async function ensureProfileDetailRow(userId, profileType, db = pool) {
  await db.query(DETAIL_ROW_SQL[profileType], [userId]);
}

// `fields` es { columna: { sent, value } }. Construye
// "columna = CASE WHEN enviado THEN valor ELSE columna END" para que solo cambien
// los campos presentes en el cuerpo y puedan vaciarse con null.
function optionalAssignments(fields, alias, offset = 0) {
  const assignments = [];
  const values = [];

  for (const [column, { sent, value }] of Object.entries(fields)) {
    values.push(sent, value);
    assignments.push(`${column} = CASE WHEN $${offset + values.length - 1}::boolean THEN $${offset + values.length} ELSE ${alias}.${column} END`);
  }

  return { assignments, values };
}

export async function updateStudentProfile(userId, fields, db = pool) {
  const { assignments, values } = optionalAssignments(fields, 'pe');
  const result = await db.query(
    `UPDATE perfiles_estudiante pe
     SET ${assignments.join(',\n         ')}
     FROM perfiles p
     WHERE pe.perfil_id = p.id
       AND p.usuario_id = $${values.length + 1}
       AND p.tipo = 'ESTUDIANTE'
     RETURNING pe.perfil_id`,
    [...values, userId]
  );
  return result.rowCount > 0;
}

// razonSocial nula conserva la actual.
export async function updateOrganizationProfile(userId, razonSocial, fields, db = pool) {
  const { assignments, values } = optionalAssignments(fields, 'o', 1);
  const result = await db.query(
    `UPDATE organizaciones o
     SET razon_social = COALESCE($1, o.razon_social),
         ${assignments.join(',\n         ')},
         updated_at = NOW()
     FROM perfiles p
     WHERE o.perfil_id = p.id
       AND p.usuario_id = $${values.length + 2}
       AND p.tipo = 'ORGANIZACION'
     RETURNING o.perfil_id`,
    [razonSocial, ...values, userId]
  );
  return result.rowCount > 0;
}

export async function updateCandidateProfile(userId, fields, db = pool) {
  const { assignments, values } = optionalAssignments(fields, 'pc');
  const result = await db.query(
    `UPDATE perfiles_candidato pc
     SET ${assignments.join(',\n         ')}
     FROM perfiles p
     WHERE pc.perfil_id = p.id
       AND p.usuario_id = $${values.length + 1}
       AND p.tipo = 'CANDIDATO_EXTERNO'
     RETURNING pc.perfil_id`,
    [...values, userId]
  );
  return result.rowCount > 0;
}

export async function findPasswordData(userId) {
  const result = await pool.query('SELECT email, nombre_completo, password_hash FROM usuarios WHERE id = $1', [userId]);
  return result.rows[0] ?? null;
}

// Cambia la contraseña y sube token_version, lo que cierra las demás sesiones.
export async function setPasswordHash(userId, passwordHash) {
  const result = await pool.query(
    `UPDATE usuarios SET password_hash = $1, token_version = token_version + 1, updated_at = NOW()
     WHERE id = $2 RETURNING token_version`,
    [passwordHash, userId]
  );
  return result.rows[0].token_version;
}
