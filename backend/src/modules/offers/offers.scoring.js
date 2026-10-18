// #20 HU-16: afinidad entre una oferta y el perfil del candidato. Funciones puras,
// sin base de datos ni HTTP, para poder probarlas y cambiarlas de forma aislada.

const normalize = (value) => String(value ?? '').trim().toLowerCase();

// La puntuación combina área, ubicación, requisitos y tipo de oferta. No excluye
// ofertas: las ordena, para que el candidato siempre vea todo el catálogo.
export function scoreOffer(offer, profile) {
  let score = 0;

  const area = normalize(offer.area);
  const city = normalize(offer.ubicacion);
  const offerType = normalize(offer.tipo);
  const requirements = Array.isArray(offer.requisitos) ? offer.requisitos.map(normalize) : [];

  const profileArea = normalize(profile.programa_academico ?? profile.resumen);
  const profileCity = normalize(profile.ubicacion);
  const profileSkills = [
    ...String(profile.resumen ?? '').split(/[,\n]/),
    ...(Array.isArray(profile.habilidades) ? profile.habilidades : []),
  ]
    .map(normalize)
    .filter(Boolean);

  // Coincidencia exacta de área vale más que coincidencia parcial.
  if (area && profileArea) {
    if (area === profileArea) score += 40;
    else if (area.includes(profileArea) || profileArea.includes(area)) score += 25;
  }

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

  if (normalize(offer.area)) max += 40;
  if (!isStudent && normalize(offer.ubicacion)) max += 25;
  max += (Array.isArray(offer.requisitos) ? offer.requisitos.filter((req) => normalize(req)).length : 0) * 15;
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
