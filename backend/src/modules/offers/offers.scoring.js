// #20 HU-16: afinidad entre una oferta y el perfil del candidato. Funciones puras,
// sin base de datos ni HTTP, para poder probarlas y cambiarlas de forma aislada.

const normalize = (value) => String(value ?? '').trim().toLowerCase();

// Términos que el candidato puede cumplir: habilidades estructuradas (Fase 8) y
// requisitos adicionales, sin repetir.
function requirementTerms(offer) {
  const list = (value) => (Array.isArray(value) ? value : []);
  return [...new Set([...list(offer.habilidades), ...list(offer.requisitos)].map(normalize).filter(Boolean))];
}

const programs = (offer) => (Array.isArray(offer.programas) ? offer.programas.map(normalize).filter(Boolean) : []);

// Coincidencia del programa del candidato con el área o los programas de la oferta.
function areaScore(offer, profileArea) {
  if (!profileArea) return 0;
  const candidates = [normalize(offer.area), ...programs(offer)].filter(Boolean);
  if (candidates.some((value) => value === profileArea)) return 40;
  if (candidates.some((value) => value.includes(profileArea) || profileArea.includes(value))) return 25;
  return 0;
}

// La puntuación combina área, ubicación, requisitos y tipo de oferta. No excluye
// ofertas: las ordena, para que el candidato siempre vea todo el catálogo.
export function scoreOffer(offer, profile) {
  let score = 0;

  const city = normalize(offer.ubicacion);
  const offerType = normalize(offer.tipo);
  const requirements = requirementTerms(offer);

  const profileArea = normalize(profile.programa_academico ?? profile.resumen);
  const profileCity = normalize(profile.ubicacion);
  const profileSkills = [
    ...String(profile.resumen ?? '').split(/[,\n]/),
    ...(Array.isArray(profile.habilidades) ? profile.habilidades : []),
  ]
    .map(normalize)
    .filter(Boolean);

  // Coincidencia exacta de área o programa vale más que coincidencia parcial.
  score += areaScore(offer, profileArea);

  // Ubicación: misma ciudad suma.
  if (city && profileCity && city === profileCity) score += 25;

  // Requisitos que el candidato ya menciona en su resumen/habilidades.
  score += requirements.filter((req) => profileSkills.some((skill) => req.includes(skill))).length * 15;

  // Un estudiante puntúa más alto en prácticas; un externo, en empleos.
  const isStudent = profile.tipo === 'ESTUDIANTE';
  if (isStudent && offerType === 'practica') score += 20;
  if (!isStudent && (offerType === 'empleo' || offerType === 'empleo_publico')) score += 20;
  // La formación es útil para cualquier perfil.
  if (offerType === 'formacion') score += 10;

  return score;
}

// Máximo que scoreOffer puede dar a esta oferta para este tipo de perfil.
// Solo cuenta los criterios que la oferta y el tipo de perfil permiten cumplir:
// el estudiante no registra ciudad, y el bono de tipo depende del perfil.
export function maxScoreOffer(offer, profile) {
  const offerType = normalize(offer.tipo);
  const isStudent = profile.tipo === 'ESTUDIANTE';
  let max = 0;

  if (normalize(offer.area) || programs(offer).length > 0) max += 40;
  if (!isStudent && normalize(offer.ubicacion)) max += 25;
  max += requirementTerms(offer).length * 15;
  if (isStudent && offerType === 'practica') max += 20;
  if (!isStudent && (offerType === 'empleo' || offerType === 'empleo_publico')) max += 20;
  if (offerType === 'formacion') max += 10;

  return max;
}

// Afinidad de 0 a 100: el puntaje de scoreOffer frente a su máximo posible.
export function offerAffinity(offer, profile) {
  const max = maxScoreOffer(offer, profile);
  if (max <= 0) return 0;
  return Math.min(100, Math.round((scoreOffer(offer, profile) / max) * 100));
}
