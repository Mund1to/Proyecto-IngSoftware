// #21 HU-17: estadísticas agregadas de empleo (Fase 4).
// Solo datos agregados, sin información personal, según las reglas de diseño del backlog.
import * as statsRepository from './stats.repository.js';

export async function getEmploymentStats() {
  const [totals, offersByType, offersByArea, offersByCity, topOrganizations, applicationsByMonth] = await Promise.all([
    statsRepository.getTotals(),
    statsRepository.countOffersByType(),
    statsRepository.countOffersByArea(),
    statsRepository.countOffersByCity(),
    statsRepository.topOrganizationsByOffers(),
    statsRepository.countApplicationsByMonth(),
  ]);

  return { totals, offersByType, offersByArea, offersByCity, topOrganizations, applicationsByMonth };
}
