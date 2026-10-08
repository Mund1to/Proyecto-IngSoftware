import { pool } from '../config/database.js';

// #21 HU-17: estadísticas agregadas de empleo (Fase 4).
// Solo datos agregados, sin información personal, según las reglas de diseño del backlog.

export async function getEmploymentStatsController(_request, response) {
  try {
    const [totals, byType, byArea, byCity, topOrganizations, monthlyApplications] = await Promise.all([
      pool.query(
        `SELECT
           (SELECT COUNT(*) FROM ofertas) AS total_ofertas,
           (SELECT COUNT(*) FROM ofertas WHERE estado = 'PUBLICADA') AS ofertas_publicadas,
           (SELECT COUNT(*) FROM postulaciones) AS total_postulaciones,
           (SELECT COUNT(*) FROM postulaciones WHERE estado = 'ACEPTADA') AS postulaciones_aceptadas,
           (SELECT COUNT(*) FROM organizaciones) AS total_organizaciones,
           (SELECT COUNT(*) FROM organizaciones WHERE verificada) AS organizaciones_verificadas,
           (SELECT COUNT(*) FROM perfiles WHERE tipo = 'ESTUDIANTE') AS total_estudiantes,
           (SELECT COUNT(*) FROM perfiles WHERE tipo = 'CANDIDATO_EXTERNO') AS total_candidatos_externos`
      ),
      pool.query(
        `SELECT tipo, COUNT(*) AS total
         FROM ofertas
         GROUP BY tipo
         ORDER BY total DESC`
      ),
      pool.query(
        `SELECT area, COUNT(*) AS total
         FROM ofertas
         GROUP BY area
         ORDER BY total DESC
         LIMIT 10`
      ),
      pool.query(
        `SELECT COALESCE(ubicacion, 'Sin especificar') AS ubicacion, COUNT(*) AS total
         FROM ofertas
         GROUP BY ubicacion
         ORDER BY total DESC
         LIMIT 10`
      ),
      pool.query(
        `SELECT org.razon_social, COUNT(o.id) AS total_ofertas
         FROM organizaciones org
         LEFT JOIN ofertas o ON o.organizacion_id = org.perfil_id
         GROUP BY org.razon_social
         ORDER BY total_ofertas DESC, org.razon_social ASC
         LIMIT 5`
      ),
      pool.query(
        `SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS mes, COUNT(*) AS total
         FROM postulaciones
         WHERE created_at >= NOW() - INTERVAL '6 months'
         GROUP BY DATE_TRUNC('month', created_at)
         ORDER BY DATE_TRUNC('month', created_at) ASC`
      ),
    ]);

    return response.json({
      ok: true,
      stats: {
        totals: totals.rows[0],
        offersByType: byType.rows,
        offersByArea: byArea.rows,
        offersByCity: byCity.rows,
        topOrganizations: topOrganizations.rows,
        applicationsByMonth: monthlyApplications.rows,
      },
    });
  } catch (error) {
    console.error('getEmploymentStatsController error:', error);
    return response.status(500).json({ ok: false, message: 'No se pudieron generar las estadísticas.' });
  }
}
