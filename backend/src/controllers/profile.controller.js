import { pool } from '../config/database.js';

function getBodyValue(payload, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(payload, key) && payload[key] !== undefined && payload[key] !== null) {
      return payload[key];
    }
  }

  return undefined;
}

function toNullableString(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  return String(value).trim();
}

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
            ) AS perfiles
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

  try {
    const result = await pool.query(
      `UPDATE perfiles_estudiante pe
       SET universidad = COALESCE($1, pe.universidad),
           programa_academico = COALESCE($2, pe.programa_academico),
           semestre = COALESCE($3, pe.semestre),
           codigo_estudiante = COALESCE($4, pe.codigo_estudiante),
           fecha_graduacion_estimada = COALESCE($5, pe.fecha_graduacion_estimada)
       FROM perfiles p
       WHERE pe.perfil_id = p.id
         AND p.usuario_id = $6
         AND p.tipo = 'ESTUDIANTE'
       RETURNING pe.perfil_id`,
      [
        toNullableString(getBodyValue(payload, ['universidad'])),
        toNullableString(getBodyValue(payload, ['programaAcademico', 'programa_academico'])),
        getBodyValue(payload, ['semestre']) ?? null,
        toNullableString(getBodyValue(payload, ['codigoEstudiante', 'codigo_estudiante'])),
        getBodyValue(payload, ['fechaGraduacionEstimada', 'fecha_graduacion_estimada']) ?? null,
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

export async function updateOrganizationProfileController(request, response) {
  const payload = request.body ?? {};

  try {
    const result = await pool.query(
      `UPDATE organizaciones o
       SET razon_social = COALESCE($1, o.razon_social),
           identificacion_fiscal = COALESCE($2, o.identificacion_fiscal),
           sitio_web = COALESCE($3, o.sitio_web),
           descripcion = COALESCE($4, o.descripcion),
           updated_at = NOW()
       FROM perfiles p
       WHERE o.perfil_id = p.id
         AND p.usuario_id = $5
         AND p.tipo = 'ORGANIZACION'
       RETURNING o.perfil_id`,
      [
        toNullableString(getBodyValue(payload, ['razonSocial', 'razon_social'])),
        toNullableString(getBodyValue(payload, ['identificacionFiscal', 'identificacion_fiscal'])),
        toNullableString(getBodyValue(payload, ['sitioWeb', 'sitio_web'])),
        toNullableString(getBodyValue(payload, ['descripcion'])),
        request.auth.sub,
      ]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'No existe un perfil de organización para este usuario.' });
    }

    const user = await findUserProfile(request.auth.sub);
    return response.json({ ok: true, user: serializeUser(user) });
  } catch (error) {
    console.error('updateOrganizationProfileController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo actualizar el perfil de organización.' });
  }
}

export async function updateExternalProfileController(request, response) {
  const payload = request.body ?? {};

  try {
    const result = await pool.query(
      `UPDATE perfiles_candidato pc
       SET resumen = COALESCE($1, pc.resumen),
           ubicacion = COALESCE($2, pc.ubicacion),
           disponibilidad = COALESCE($3, pc.disponibilidad),
           cv_url = COALESCE($4, pc.cv_url)
       FROM perfiles p
       WHERE pc.perfil_id = p.id
         AND p.usuario_id = $5
         AND p.tipo = 'CANDIDATO_EXTERNO'
       RETURNING pc.perfil_id`,
      [
        toNullableString(getBodyValue(payload, ['resumen'])),
        toNullableString(getBodyValue(payload, ['ubicacion'])),
        toNullableString(getBodyValue(payload, ['disponibilidad'])),
        toNullableString(getBodyValue(payload, ['cvUrl', 'cv_url'])),
        request.auth.sub,
      ]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({ ok: false, message: 'No existe un perfil de candidato externo para este usuario.' });
    }

    const user = await findUserProfile(request.auth.sub);
    return response.json({ ok: true, user: serializeUser(user) });
  } catch (error) {
    console.error('updateExternalProfileController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo actualizar el perfil de candidato externo.' });
  }
}
