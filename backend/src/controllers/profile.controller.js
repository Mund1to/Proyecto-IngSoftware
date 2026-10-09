import bcrypt from 'bcrypt';
import { buildToken } from './auth.controller.js';
import { pool } from '../config/database.js';
import { getBodyValue, hasBodyValue, toNullableString } from '../utils/payload.js';

function mapProfile(profile) {
  return {
    id: profile.id,
    tipo: profile.tipo,
    visible: profile.visible,
    universidad: profile.universidad,
    programaAcademico: profile.programa_academico,
    semestre: profile.semestre,
    codigoEstudiante: profile.codigo_estudiante,
    fechaGraduacionEstimada: profile.fecha_graduacion_estimada,
    razonSocial: profile.razon_social,
    identificacionFiscal: profile.identificacion_fiscal,
    sitioWeb: profile.sitio_web,
    descripcion: profile.descripcion,
    verificada: profile.verificada,
    resumen: profile.resumen,
    ubicacion: profile.ubicacion,
    disponibilidad: profile.disponibilidad,
    cvUrl: profile.cv_url,
  };
}

async function findUserProfile(userId, client = pool) {
  const result = await client.query(
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

function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    nombreCompleto: user.nombre_completo,
    telefono: user.telefono,
    activo: user.activo,
    createdAt: user.created_at,
    roles: user.roles,
    perfiles: (user.perfiles ?? []).map(mapProfile),
    archivos: user.archivos ?? [],
  };
}

export async function getCurrentUserController(request, response) {
  try {
    const user = await findUserProfile(request.auth.sub);

    if (!user) {
      return response.status(404).json({
        ok: false,
        message: 'Usuario no encontrado.',
      });
    }

    return response.json({ ok: true, user: serializeUser(user) });
  } catch (error) {
    console.error('getCurrentUserController error:', error);
    return response.status(500).json({
      ok: false,
      message: 'No se pudo obtener el perfil del usuario.',
    });
  }
}

export async function updateCurrentUserController(request, response) {
  const payload = request.body ?? {};
  const nombreCompleto = getBodyValue(payload, ['nombreCompleto', 'nombre_completo', 'nombre']);
  const telefono = getBodyValue(payload, ['telefono', 'phone']);

  if (nombreCompleto !== undefined && !String(nombreCompleto).trim()) {
    return response.status(400).json({ ok: false, message: 'El nombre completo no puede estar vacío.' });
  }

  try {
    const result = await pool.query(
      `UPDATE usuarios
       SET nombre_completo = COALESCE($1, nombre_completo),
           telefono = CASE WHEN $2::boolean THEN $3 ELSE telefono END,
           updated_at = NOW()
       WHERE id = $4
       RETURNING id`,
      [
        nombreCompleto === undefined ? null : String(nombreCompleto).trim(),
        telefono !== undefined,
        toNullableString(telefono),
        request.auth.sub,
      ]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }

    const user = await findUserProfile(request.auth.sub);
    return response.json({ ok: true, user: serializeUser(user) });
  } catch (error) {
    console.error('updateCurrentUserController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo actualizar el usuario.' });
  }
}

export async function updateStudentProfileController(request, response) {
  const payload = request.body ?? {};
  const universityKeys = ['universidad'];
  const programKeys = ['programaAcademico', 'programa_academico'];
  const semesterKeys = ['semestre'];
  const studentCodeKeys = ['codigoEstudiante', 'codigo_estudiante'];
  const graduationKeys = ['fechaGraduacionEstimada', 'fecha_graduacion_estimada'];
  const semesterValue = getBodyValue(payload, semesterKeys);
  const semester = !hasBodyValue(payload, semesterKeys) || semesterValue === '' || semesterValue === undefined
    ? null
    : Number(semesterValue);

  if (semester !== null && (!Number.isInteger(semester) || semester < 1)) {
    return response.status(400).json({ ok: false, message: 'El semestre debe ser un número entero mayor que cero.' });
  }

  try {
    await ensureProfileDetailRow(pool, request.auth.sub, 'ESTUDIANTE');
    const result = await pool.query(
      `UPDATE perfiles_estudiante pe
       SET universidad = CASE WHEN $1 THEN $2 ELSE pe.universidad END,
           programa_academico = CASE WHEN $3 THEN $4 ELSE pe.programa_academico END,
           semestre = CASE WHEN $5 THEN $6 ELSE pe.semestre END,
           codigo_estudiante = CASE WHEN $7 THEN $8 ELSE pe.codigo_estudiante END,
           fecha_graduacion_estimada = CASE WHEN $9 THEN $10 ELSE pe.fecha_graduacion_estimada END
       FROM perfiles p
       WHERE pe.perfil_id = p.id
         AND p.usuario_id = $11
         AND p.tipo = 'ESTUDIANTE'
       RETURNING pe.perfil_id`,
      [
        hasBodyValue(payload, universityKeys),
        toNullableString(getBodyValue(payload, universityKeys)),
        hasBodyValue(payload, programKeys),
        toNullableString(getBodyValue(payload, programKeys)),
        hasBodyValue(payload, semesterKeys),
        semester,
        hasBodyValue(payload, studentCodeKeys),
        toNullableString(getBodyValue(payload, studentCodeKeys)),
        hasBodyValue(payload, graduationKeys),
        getBodyValue(payload, graduationKeys) || null,
        request.auth.sub,
      ]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'No existe un perfil de estudiante para este usuario.' });
    }

    const user = await findUserProfile(request.auth.sub);
    return response.json({ ok: true, user: serializeUser(user) });
  } catch (error) {
    console.error('updateStudentProfileController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo actualizar el perfil de estudiante.' });
  }
}

// Construye "columna = CASE WHEN enviado THEN valor ELSE columna END" para que
// solo cambien los campos presentes en el cuerpo y puedan vaciarse con null o "".
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

function ensureProfileDetailRow(client, userId, profileType) {
  return client.query(DETAIL_ROW_SQL[profileType], [userId]);
}

function buildOptionalUpdate(payload, fields, alias, offset = 0) {
  const assignments = [];
  const values = [];

  for (const [column, keys] of Object.entries(fields)) {
    values.push(hasBodyValue(payload, keys), toNullableString(getBodyValue(payload, keys)));
    assignments.push(`${column} = CASE WHEN $${offset + values.length - 1}::boolean THEN $${offset + values.length}::text ELSE ${alias}.${column} END`);
  }

  return { assignments, values };
}

export async function updateOrganizationProfileController(request, response) {
  const payload = request.body ?? {};
  const razonSocialKeys = ['razonSocial', 'razon_social'];

  if (hasBodyValue(payload, razonSocialKeys) && !toNullableString(getBodyValue(payload, razonSocialKeys))) {
    return response.status(400).json({ ok: false, message: 'La razón social no puede quedar vacía.' });
  }

  const { assignments, values } = buildOptionalUpdate(payload, {
    identificacion_fiscal: ['identificacionFiscal', 'identificacion_fiscal'],
    sitio_web: ['sitioWeb', 'sitio_web'],
    descripcion: ['descripcion'],
  }, 'o', 1);

  try {
    await ensureProfileDetailRow(pool, request.auth.sub, 'ORGANIZACION');
    const result = await pool.query(
      `UPDATE organizaciones o
       SET razon_social = COALESCE($1, o.razon_social),
           ${assignments.join(',\n           ')},
           updated_at = NOW()
       FROM perfiles p
       WHERE o.perfil_id = p.id
         AND p.usuario_id = $${values.length + 2}
         AND p.tipo = 'ORGANIZACION'
       RETURNING o.perfil_id`,
      [toNullableString(getBodyValue(payload, razonSocialKeys)), ...values, request.auth.sub]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'No existe un perfil de organización para este usuario.' });
    }

    const user = await findUserProfile(request.auth.sub);
    return response.json({ ok: true, user: serializeUser(user) });
  } catch (error) {
    if (error?.code === '23505') {
      return response.status(409).json({ ok: false, message: 'La identificación fiscal ya está registrada por otra organización.' });
    }
    console.error('updateOrganizationProfileController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo actualizar el perfil de organización.' });
  }
}

export async function updateExternalProfileController(request, response) {
  const payload = request.body ?? {};
  const cvUrl = toNullableString(getBodyValue(payload, ['cvUrl', 'cv_url']));

  if (cvUrl && !/^https?:\/\/\S+$/i.test(cvUrl)) {
    return response.status(400).json({ ok: false, message: 'El enlace de la hoja de vida debe empezar por http:// o https://.' });
  }

  const nombreCompleto = getBodyValue(payload, ['nombreCompleto', 'nombre_completo', 'nombre']);
  if (nombreCompleto !== undefined && !String(nombreCompleto).trim()) {
    return response.status(400).json({ ok: false, message: 'El nombre completo no puede estar vacío.' });
  }

  const { assignments, values } = buildOptionalUpdate(payload, {
    resumen: ['resumen'],
    ubicacion: ['ubicacion'],
    disponibilidad: ['disponibilidad'],
    cv_url: ['cvUrl', 'cv_url'],
  }, 'pc');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await ensureProfileDetailRow(client, request.auth.sub, 'CANDIDATO_EXTERNO');

    const result = await client.query(
      `UPDATE perfiles_candidato pc
       SET ${assignments.join(',\n           ')}
       FROM perfiles p
       WHERE pc.perfil_id = p.id
         AND p.usuario_id = $${values.length + 1}
         AND p.tipo = 'CANDIDATO_EXTERNO'
       RETURNING pc.perfil_id`,
      [...values, request.auth.sub]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return response.status(404).json({ ok: false, message: 'No existe un perfil de candidato externo para este usuario.' });
    }

    // El formulario del candidato también envía nombre y teléfono de la cuenta.
    const phoneKeys = ['telefono', 'phone'];
    if (nombreCompleto !== undefined || hasBodyValue(payload, phoneKeys)) {
      await client.query(
        `UPDATE usuarios
         SET nombre_completo = COALESCE($1, nombre_completo),
             telefono = CASE WHEN $2::boolean THEN $3 ELSE telefono END,
             updated_at = NOW()
         WHERE id = $4`,
        [
          nombreCompleto === undefined ? null : String(nombreCompleto).trim(),
          hasBodyValue(payload, phoneKeys),
          toNullableString(getBodyValue(payload, phoneKeys)),
          request.auth.sub,
        ]
      );
    }

    await client.query('COMMIT');

    const user = await findUserProfile(request.auth.sub);
    return response.json({ ok: true, user: serializeUser(user) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('updateExternalProfileController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo actualizar el perfil de candidato externo.' });
  } finally {
    client.release();
  }
}

export async function changePasswordController(request, response) {
  const payload = request.body ?? {};
  const currentPassword = getBodyValue(payload, ['currentPassword', 'contrasenaActual', 'passwordActual']);
  const newPassword = getBodyValue(payload, ['newPassword', 'contrasenaNueva', 'passwordNueva']);

  if (!currentPassword || !newPassword) {
    return response.status(400).json({ ok: false, message: 'Debe indicar la contraseña actual y la nueva.' });
  }

  if (String(newPassword).length < 8) {
    return response.status(400).json({ ok: false, message: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  try {
    const result = await pool.query('SELECT email, nombre_completo, password_hash FROM usuarios WHERE id = $1', [request.auth.sub]);

    if (result.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }

    const matches = await bcrypt.compare(String(currentPassword), result.rows[0].password_hash);
    if (!matches) {
      return response.status(400).json({ ok: false, message: 'La contraseña actual no es correcta.' });
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    // Incrementar token_version cierra las demás sesiones abiertas; se entrega
    // un token nuevo para que esta sesión continúe.
    const updated = await pool.query(
      `UPDATE usuarios SET password_hash = $1, token_version = token_version + 1, updated_at = NOW()
       WHERE id = $2 RETURNING token_version`,
      [passwordHash, request.auth.sub]
    );
    const user = result.rows[0];
    const token = buildToken({
      id: request.auth.sub,
      email: user.email,
      nombre_completo: user.nombre_completo,
      roles: request.auth.roles,
      token_version: updated.rows[0].token_version,
    });

    return response.json({ ok: true, message: 'Contraseña actualizada.', token });
  } catch (error) {
    console.error('changePasswordController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo cambiar la contraseña.' });
  }
}
