// Acceso a datos de verificación de organizaciones: decisiones, solicitudes de
// la empresa y documentos de soporte. Las funciones que escriben reciben `db`
// para poder participar en una transacción.
//
// Orden de bloqueo: toda transacción bloquea primero la fila de `organizaciones`
// (lockOrganization) y después la de `verificaciones`. Mantener ese orden evita
// interbloqueos entre la empresa que retira su solicitud y el revisor que la decide.
import { pool } from '../../core/database/database.js';

const DOCUMENT_COLUMNS = 'id, tipo, nombre, mime, tamano, created_at';

// ---------------------------------------------------------------------------
// Organizaciones
// ---------------------------------------------------------------------------

// Organizaciones con su estado de verificación más reciente.
export async function listOrganizationsWithLatestVerification() {
  const result = await pool.query(
    `SELECT o.perfil_id AS organizacion_id,
            o.razon_social,
            o.identificacion_fiscal,
            o.sitio_web,
            o.verificada,
            v.id AS verificacion_id,
            v.estado AS verificacion_estado,
            v.observaciones,
            v.updated_at AS verificacion_fecha,
            (SELECT COUNT(*)::int FROM documentos_verificacion d WHERE d.organizacion_id = o.perfil_id) AS documentos_count
     FROM organizaciones o
     LEFT JOIN LATERAL (
       SELECT id, estado, observaciones, updated_at
       FROM verificaciones
       WHERE organizacion_id = o.perfil_id
       ORDER BY updated_at DESC, id DESC
       LIMIT 1
     ) v ON TRUE
     ORDER BY o.verificada ASC, o.razon_social ASC`
  );
  return result.rows;
}

// Organización del usuario (perfil ORGANIZACION). Con `forUpdate` bloquea la fila
// para serializar las operaciones de la empresa sobre su verificación.
export async function findOrganizationByUser(userId, { db = pool, forUpdate = false } = {}) {
  const result = await db.query(
    `SELECT o.perfil_id AS organizacion_id, o.razon_social, o.identificacion_fiscal, o.verificada
     FROM perfiles p
     INNER JOIN organizaciones o ON o.perfil_id = p.id
     WHERE p.usuario_id = $1 AND p.tipo = 'ORGANIZACION'
     LIMIT 1
     ${forUpdate ? 'FOR UPDATE OF o' : ''}`,
    [userId]
  );
  return result.rows[0] ?? null;
}

// Bloquea la organización; devuelve null si no existe.
export async function lockOrganization(db, organizationId) {
  const result = await db.query(
    'SELECT perfil_id AS organizacion_id, verificada FROM organizaciones WHERE perfil_id = $1 FOR UPDATE',
    [organizationId]
  );
  return result.rows[0] ?? null;
}

export async function setOrganizationVerified(db, organizationId, status) {
  const result = await db.query(
    `UPDATE organizaciones
     SET verificada = ($1 = 'APROBADA'), updated_at = NOW()
     WHERE perfil_id = $2
     RETURNING perfil_id AS organizacion_id, razon_social, verificada`,
    [status, organizationId]
  );
  return result.rows[0];
}

// Cuenta dueña de la organización, para avisarle de la decisión.
export async function findOrganizationContact(organizationId) {
  const result = await pool.query(
    `SELECT u.email, u.nombre_completo, o.razon_social
     FROM organizaciones o
     INNER JOIN perfiles p ON p.id = o.perfil_id
     INNER JOIN usuarios u ON u.id = p.usuario_id
     WHERE o.perfil_id = $1 AND u.activo`,
    [organizationId]
  );
  return result.rows[0] ?? null;
}

// Correos de quienes pueden revisar solicitudes (administradores y funcionarios activos).
export async function listReviewerEmails() {
  const result = await pool.query(
    `SELECT DISTINCT u.email
     FROM usuarios u
     INNER JOIN usuario_roles ur ON ur.usuario_id = u.id
     INNER JOIN roles r ON r.id = ur.rol_id
     WHERE r.nombre IN ('ADMINISTRADOR', 'FUNCIONARIO_PUBLICO') AND u.activo`
  );
  return result.rows.map((row) => row.email);
}

// ---------------------------------------------------------------------------
// Documentos de soporte
// ---------------------------------------------------------------------------

export async function listDocuments(organizationId, db = pool) {
  const result = await db.query(
    `SELECT ${DOCUMENT_COLUMNS} FROM documentos_verificacion WHERE organizacion_id = $1 ORDER BY created_at, id`,
    [organizationId]
  );
  return result.rows;
}

export async function countDocuments(db, organizationId) {
  const result = await db.query('SELECT COUNT(*)::int AS total FROM documentos_verificacion WHERE organizacion_id = $1', [organizationId]);
  return result.rows[0].total;
}

export async function insertDocument(db, organizationId, { tipo, nombre, mime, contenido }) {
  const result = await db.query(
    `INSERT INTO documentos_verificacion (organizacion_id, tipo, nombre, mime, tamano, contenido)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${DOCUMENT_COLUMNS}`,
    [organizationId, tipo, nombre, mime, contenido.length, contenido]
  );
  return result.rows[0];
}

// Documento con su contenido. Con `organizationId` solo lo devuelve si es de esa organización.
export async function findDocument(documentId, organizationId = null) {
  const result = await pool.query(
    `SELECT id, organizacion_id, nombre, mime, tamano, contenido
     FROM documentos_verificacion
     WHERE id = $1 AND ($2::bigint IS NULL OR organizacion_id = $2)`,
    [documentId, organizationId]
  );
  return result.rows[0] ?? null;
}

export async function deleteDocument(db, organizationId, documentId) {
  const result = await db.query(
    'DELETE FROM documentos_verificacion WHERE id = $1 AND organizacion_id = $2 RETURNING id',
    [documentId, organizationId]
  );
  return result.rowCount > 0;
}

// ---------------------------------------------------------------------------
// Solicitudes y decisiones (tabla verificaciones)
// ---------------------------------------------------------------------------

const REQUEST_COLUMNS = `v.id, v.organizacion_id, v.estado, v.mensaje, v.observaciones, v.documentos,
       v.solicitado_por, v.created_at, v.revisado_at, v.updated_at`;

// Solicitud vigente de la organización: la pendiente de la empresa si existe y,
// si no, la verificación más reciente (de la empresa o de un revisor).
export async function findCurrentRequest(organizationId, db = pool) {
  const result = await db.query(
    `SELECT ${REQUEST_COLUMNS}, r.nombre_completo AS revisor_nombre
     FROM verificaciones v
     LEFT JOIN usuarios r ON r.id = v.revisado_por
     WHERE v.organizacion_id = $1
     ORDER BY (v.estado = 'PENDIENTE' AND v.solicitado_por IS NOT NULL) DESC, v.updated_at DESC, v.id DESC
     LIMIT 1`,
    [organizationId]
  );
  return result.rows[0] ?? null;
}

// Solicitud pendiente enviada por la empresa (como mucho una, por el índice único).
export async function findPendingRequest(db, organizationId) {
  const result = await db.query(
    `SELECT id FROM verificaciones
     WHERE organizacion_id = $1 AND estado = 'PENDIENTE' AND solicitado_por IS NOT NULL
     FOR UPDATE`,
    [organizationId]
  );
  return result.rows[0] ?? null;
}

// Crea la solicitud con una copia de los metadatos de los documentos actuales.
export async function insertRequest(db, { organizationId, userId, message }) {
  const result = await db.query(
    `INSERT INTO verificaciones (organizacion_id, solicitado_por, estado, mensaje, documentos)
     VALUES ($1, $2, 'PENDIENTE', $3, (
       SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', d.id, 'tipo', d.tipo, 'nombre', d.nombre, 'mime', d.mime, 'tamano', d.tamano
              ) ORDER BY d.created_at, d.id), '[]'::jsonb)
       FROM documentos_verificacion d
       WHERE d.organizacion_id = $1
     ))
     RETURNING id`,
    [organizationId, userId, message]
  );
  return result.rows[0];
}

// La empresa retira su solicitud antes de que la revisen. No hay decisión que
// conservar, así que la fila se elimina.
export async function deletePendingRequest(db, organizationId) {
  const result = await db.query(
    `DELETE FROM verificaciones
     WHERE organizacion_id = $1 AND estado = 'PENDIENTE' AND solicitado_por IS NOT NULL
     RETURNING id`,
    [organizationId]
  );
  return result.rowCount > 0;
}

// Decisión directa de un revisor sobre una organización sin solicitud pendiente.
export async function insertVerification(db, { organizationId, reviewerId, status, observations }) {
  await db.query(
    `INSERT INTO verificaciones (organizacion_id, revisado_por, estado, observaciones, revisado_at)
     VALUES ($1, $2, $3, $4, CASE WHEN $3::verification_status = 'PENDIENTE' THEN NULL ELSE NOW() END)`,
    [organizationId, reviewerId, status, observations]
  );
}

// Organización a la que pertenece una solicitud de empresa (sin bloquear).
export async function findRequestOrganizationId(db, requestId) {
  const result = await db.query(
    'SELECT organizacion_id FROM verificaciones WHERE id = $1 AND solicitado_por IS NOT NULL',
    [requestId]
  );
  return result.rows[0]?.organizacion_id ?? null;
}

export async function findRequestForUpdate(db, requestId) {
  const result = await db.query(
    `SELECT id, organizacion_id, estado FROM verificaciones
     WHERE id = $1 AND solicitado_por IS NOT NULL
     FOR UPDATE`,
    [requestId]
  );
  return result.rows[0] ?? null;
}

export async function resolveRequest(db, requestId, { reviewerId, status, observations }) {
  const result = await db.query(
    `UPDATE verificaciones
     SET estado = $1, revisado_por = $2, observaciones = $3, revisado_at = NOW(), updated_at = NOW()
     WHERE id = $4
     RETURNING id, estado, observaciones, revisado_at`,
    [status, reviewerId, observations, requestId]
  );
  return result.rows[0];
}

// Bandeja del revisor: solicitudes enviadas por empresas, con paginación.
// Las pendientes salen primero y en orden de llegada; las revisadas, de la más
// reciente a la más antigua. `status` null devuelve todas.
export async function listRequests({ status, limit, offset }) {
  const result = await pool.query(
    `SELECT ${REQUEST_COLUMNS},
            o.razon_social, o.identificacion_fiscal, o.sitio_web, o.descripcion, o.verificada,
            s.nombre_completo AS solicitante_nombre, s.email AS solicitante_email, s.telefono AS solicitante_telefono,
            r.nombre_completo AS revisor_nombre,
            COUNT(*) OVER() AS total
     FROM verificaciones v
     INNER JOIN organizaciones o ON o.perfil_id = v.organizacion_id
     LEFT JOIN usuarios s ON s.id = v.solicitado_por
     LEFT JOIN usuarios r ON r.id = v.revisado_por
     WHERE v.solicitado_por IS NOT NULL
       AND ($1::verification_status IS NULL OR v.estado = $1)
     ORDER BY (v.estado = 'PENDIENTE') DESC,
              CASE WHEN v.estado = 'PENDIENTE' THEN v.created_at END ASC,
              COALESCE(v.revisado_at, v.updated_at) DESC,
              v.id DESC
     LIMIT $2 OFFSET $3`,
    [status, limit, offset]
  );

  return { rows: result.rows, total: Number(result.rows[0]?.total ?? 0) };
}

export async function countPendingRequests() {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total FROM verificaciones WHERE estado = 'PENDIENTE' AND solicitado_por IS NOT NULL`
  );
  return result.rows[0].total;
}
