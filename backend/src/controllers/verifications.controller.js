import { pool } from '../config/database.js';
import { getBodyValue, toNullableString } from '../utils/payload.js';

const VERIFICATION_STATUSES = ['PENDIENTE', 'APROBADA', 'RECHAZADA'];

// Determina si el usuario autenticado puede revisar verificaciones.
// Solo administradores o funcionarios públicos, o cualquier usuario cuya
// organización ya esté verificada (revisor de confianza).
async function canReviewVerifications(userId) {
  const result = await pool.query(
    `SELECT
       COALESCE(array_agg(DISTINCT r.nombre) FILTER (WHERE r.nombre IS NOT NULL), ARRAY[]::VARCHAR[]) AS roles,
       BOOL_OR(o.verificada) AS owns_verified_organization
     FROM usuarios u
     LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
     LEFT JOIN roles r ON r.id = ur.rol_id
     LEFT JOIN perfiles p ON p.usuario_id = u.id AND p.tipo = 'ORGANIZACION'
     LEFT JOIN organizaciones o ON o.perfil_id = p.id
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId]
  );

  const row = result.rows[0];
  if (!row) return false;

  const roles = Array.isArray(row.roles) ? row.roles : [];
  return roles.includes('ADMINISTRADOR')
    || roles.includes('FUNCIONARIO_PUBLICO')
    || row.owns_verified_organization === true;
}

// Lista las organizaciones con su estado de verificación más reciente.
export async function listOrganizationsController(request, response) {
  try {
    if (!(await canReviewVerifications(request.auth.sub))) {
      return response.status(403).json({
        ok: false,
        message: 'No tiene permisos para consultar las verificaciones.',
      });
    }

    const result = await pool.query(
      `SELECT o.perfil_id AS organizacion_id,
              o.razon_social,
              o.identificacion_fiscal,
              o.sitio_web,
              o.verificada,
              v.id AS verificacion_id,
              v.estado AS verificacion_estado,
              v.observaciones,
              v.updated_at AS verificacion_fecha
       FROM organizaciones o
       LEFT JOIN LATERAL (
         SELECT id, estado, observaciones, updated_at
         FROM verificaciones
         WHERE organizacion_id = o.perfil_id
         ORDER BY updated_at DESC
         LIMIT 1
       ) v ON TRUE
       ORDER BY o.verificada ASC, o.razon_social ASC`
    );

    return response.json({ ok: true, organizations: result.rows });
  } catch (error) {
    console.error('listOrganizationsController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudieron listar las organizaciones.' });
  }
}

// Registra la decisión de verificación de una organización.
// Aprobar activa organizaciones.verificada; rechazar la desactiva.
export async function updateOrganizationVerificationController(request, response) {
  const { organizationId } = request.params;
  const payload = request.body ?? {};
  const nextStatus = String(
    getBodyValue(payload, ['estado', 'status']) ?? ''
  ).trim().toUpperCase();

  if (!VERIFICATION_STATUSES.includes(nextStatus)) {
    return response.status(400).json({
      ok: false,
      message: 'El estado de verificación debe ser PENDIENTE, APROBADA o RECHAZADA.',
    });
  }

  if (!(await canReviewVerifications(request.auth.sub))) {
    return response.status(403).json({
      ok: false,
      message: 'No tiene permisos para revisar verificaciones.',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const organization = await client.query(
      `SELECT perfil_id FROM organizaciones WHERE perfil_id = $1`,
      [organizationId]
    );

    if (organization.rowCount === 0) {
      await client.query('ROLLBACK');
      return response.status(404).json({ ok: false, message: 'Organización no encontrada.' });
    }

    const observations = toNullableString(getBodyValue(payload, ['observaciones', 'observations']));

    await client.query(
      `INSERT INTO verificaciones (organizacion_id, revisado_por, estado, observaciones)
       VALUES ($1, $2, $3, $4)`,
      [organizationId, request.auth.sub, nextStatus, observations]
    );

    const updated = await client.query(
      `UPDATE organizaciones
       SET verificada = ($1 = 'APROBADA'), updated_at = NOW()
       WHERE perfil_id = $2
       RETURNING perfil_id AS organizacion_id, razon_social, verificada`,
      [nextStatus, organizationId]
    );

    await client.query('COMMIT');

    return response.json({ ok: true, organization: updated.rows[0], verificationStatus: nextStatus });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('updateOrganizationVerificationController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudo actualizar la verificación.' });
  } finally {
    client.release();
  }
}
