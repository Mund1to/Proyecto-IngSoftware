export const OFFER_TYPES = ['PRACTICA', 'EMPLEO', 'EMPLEO_PUBLICO', 'FORMACION'];
export const OFFER_STATUSES = ['BORRADOR', 'PUBLICADA', 'CERRADA', 'CANCELADA'];
export const MODALITIES = ['Presencial', 'Remota', 'Híbrida'];

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
