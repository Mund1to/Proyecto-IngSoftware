// Consultas agregadas de empleo. Solo cifras, sin información personal.
import { pool } from '../../core/database/database.js';

async function rows(sql) {
  return (await pool.query(sql)).rows;
}

export async function getTotals() {
  const [totals] = await rows(
    `SELECT
       (SELECT COUNT(*)::int FROM ofertas) AS total_ofertas,
       (SELECT COUNT(*)::int FROM ofertas WHERE estado = 'PUBLICADA') AS ofertas_publicadas,
       (SELECT COUNT(*)::int FROM postulaciones) AS total_postulaciones,
       (SELECT COUNT(*)::int FROM postulaciones WHERE estado = 'ACEPTADA') AS postulaciones_aceptadas,
       (SELECT COUNT(*)::int FROM organizaciones) AS total_organizaciones,
       (SELECT COUNT(*)::int FROM organizaciones WHERE verificada) AS organizaciones_verificadas,
       (SELECT COUNT(*)::int FROM perfiles WHERE tipo = 'ESTUDIANTE') AS total_estudiantes,
       (SELECT COUNT(*)::int FROM perfiles WHERE tipo = 'CANDIDATO_EXTERNO') AS total_candidatos_externos`
  );
  return totals;
}

export function countOffersByType() {
  return rows(
    `SELECT tipo, COUNT(*)::int AS total
     FROM ofertas
     GROUP BY tipo
     ORDER BY total DESC`
  );
}

export function countOffersByArea() {
  return rows(
    `SELECT area, COUNT(*)::int AS total
     FROM ofertas
     GROUP BY area
     ORDER BY total DESC
     LIMIT 10`
  );
}

export function countOffersByCity() {
  return rows(
    `SELECT COALESCE(ubicacion, 'Sin especificar') AS ubicacion, COUNT(*)::int AS total
     FROM ofertas
     GROUP BY ubicacion
     ORDER BY total DESC
     LIMIT 10`
  );
}

export function topOrganizationsByOffers() {
  return rows(
    `SELECT org.razon_social, COUNT(o.id)::int AS total
     FROM organizaciones org
     LEFT JOIN ofertas o ON o.organizacion_id = org.perfil_id
     GROUP BY org.perfil_id, org.razon_social
     ORDER BY total DESC, org.razon_social ASC
     LIMIT 5`
  );
}

export function countApplicationsByMonth() {
  return rows(
    `SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS mes, COUNT(*)::int AS total
     FROM postulaciones
     WHERE created_at >= NOW() - INTERVAL '6 months'
     GROUP BY DATE_TRUNC('month', created_at)
     ORDER BY DATE_TRUNC('month', created_at) ASC`
  );
}
