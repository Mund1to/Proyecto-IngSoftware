// Capa HTTP de estadísticas.
import { asyncHandler } from '../../core/http/errors.js';
import * as statsService from './stats.service.js';

export const getEmploymentStatsController = asyncHandler(async function getEmploymentStatsController(_request, response) {
  const stats = await statsService.getEmploymentStats();
  return response.json({ ok: true, stats });
}, 'No se pudieron generar las estadísticas.');
