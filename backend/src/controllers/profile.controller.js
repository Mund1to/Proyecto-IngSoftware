import { pool } from '../config/database.js';

export async function getCurrentUserController(request, response) {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.nombre_completo, u.telefono, u.activo, u.created_at,
              COALESCE(array_agg(DISTINCT r.nombre) FILTER (WHERE r.nombre IS NOT NULL), ARRAY[]::VARCHAR[]) AS roles,
              COALESCE(
                json_agg(DISTINCT jsonb_build_object(
                  'id', p.id,
                  'tipo', p.tipo,
                  'visible', p.visible
                )) FILTER (WHERE p.id IS NOT NULL),
                '[]'::json
              ) AS perfiles
       FROM usuarios u
       LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
       LEFT JOIN roles r ON r.id = ur.rol_id
       LEFT JOIN perfiles p ON p.usuario_id = u.id
       WHERE u.id = $1
       GROUP BY u.id, u.email, u.nombre_completo, u.telefono, u.activo, u.created_at`,
      [request.auth.sub]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({
        ok: false,
        message: 'Usuario no encontrado.',
      });
    }

    const user = result.rows[0];
    return response.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        nombreCompleto: user.nombre_completo,
        telefono: user.telefono,
        activo: user.activo,
        createdAt: user.created_at,
        roles: user.roles,
        perfiles: user.perfiles,
      },
    });
  } catch (error) {
    console.error('getCurrentUserController error:', error);
    return response.status(500).json({
      ok: false,
      message: 'No se pudo obtener el perfil del usuario.',
    });
  }
}
