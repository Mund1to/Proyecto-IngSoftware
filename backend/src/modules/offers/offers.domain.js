export const OFFER_TYPES = ['PRACTICA', 'EMPLEO', 'EMPLEO_PUBLICO', 'FORMACION'];
// Tipos que ve el candidato externo: las prácticas son solo para estudiantes de la universidad.
export const EXTERNAL_OFFER_TYPES = ['EMPLEO', 'EMPLEO_PUBLICO', 'FORMACION'];
export const OFFER_STATUSES = ['BORRADOR', 'PUBLICADA', 'CERRADA', 'CANCELADA'];
export const MODALITIES = ['Presencial', 'Remota', 'Híbrida'];

// Fase 8: requisitos y condiciones como opciones en lugar de texto libre.
// El frontend repite estas listas y test/contracts.test.ts comprueba que coincidan.
export const EXPERIENCE_LEVELS = ['NINGUNA', 'MENOS_1', 'DE_1_A_2', 'DE_3_A_5', 'MAS_5'];
// Una práctica es para estudiantes: no puede pedir años de experiencia.
export const PRACTICE_EXPERIENCE_LEVELS = ['NINGUNA', 'MENOS_1'];
export const WORK_SCHEDULES = ['TIEMPO_COMPLETO', 'MEDIO_TIEMPO', 'POR_HORAS', 'FLEXIBLE'];
// Marco común europeo y lengua materna.
export const LANGUAGE_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'NATIVO'];

// Límites de los campos de una oferta. Los mínimos de contenido (título,
// descripción, habilidades...) se exigen al publicar; un borrador puede estar incompleto.
export const OFFER_LIMITS = {
  titleMin: 4,
  titleMax: 120,
  descriptionMinChars: 60,
  descriptionMinWords: 10,
  descriptionMax: 5000,
  skillsMin: 1,
  skillsMax: 15,
  skillMinChars: 2,
  skillMaxChars: 40,
  programsMax: 10,
  languagesMax: 5,
  benefitsMax: 10,
  requirementsMax: 10,
  requirementMinChars: 3,
  requirementMaxChars: 200,
  vacanciesMax: 50,
  semesterMax: 10,
  salaryMax: 100000000,
  closeMaxDays: 365,
};

// Quita tildes y caracteres dañados por una codificación incorrecta (U+FFFD),
// para reconocer "Híbrida", "hibrida", "Hibrido" o "H�brida" como la misma modalidad.
function simplify(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z�]/g, '')
    .toLowerCase();
}

// Devuelve la modalidad canónica, null si viene vacía o undefined si no es válida.
export function normalizeModality(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  const simple = simplify(value);
  if (simple.startsWith('presencial')) return 'Presencial';
  if (simple.startsWith('remot') || simple === 'virtual' || simple === 'teletrabajo') return 'Remota';
  if (/^h.?brid/.test(simple)) return 'Híbrida';
  return undefined;
}
