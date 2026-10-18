// Reglas puras de la verificación documental: tipos de documento, formatos,
// límites y requisitos para enviar una solicitud. Se prueban sin base de datos.

export const VERIFICATION_STATUSES = ['PENDIENTE', 'APROBADA', 'RECHAZADA'];

// Decisiones que puede tomar un revisor sobre una solicitud enviada por la empresa.
export const REVIEW_DECISIONS = ['APROBADA', 'RECHAZADA'];

export const DOCUMENT_TYPES = {
  RUT: { label: 'RUT (Registro Único Tributario)', required: true },
  CAMARA_COMERCIO: { label: 'Certificado de Cámara de Comercio', required: true },
  CEDULA_REPRESENTANTE: { label: 'Documento del representante legal', required: false },
  OTRO: { label: 'Otro documento de soporte', required: false },
};

export const REQUIRED_DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPES).filter((type) => DOCUMENT_TYPES[type].required);

export const DOCUMENT_MIMES = ['application/pdf', 'image/png', 'image/jpeg'];
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENTS = 10;
export const MAX_MESSAGE_LENGTH = 1000;
export const MIN_REJECTION_REASON_LENGTH = 10;

// 'rut', ' Camara_Comercio ' -> 'RUT', 'CAMARA_COMERCIO'; null si no es un tipo válido.
export function normalizeDocumentType(value) {
  const type = String(value ?? '').trim().toUpperCase();
  return Object.hasOwn(DOCUMENT_TYPES, type) ? type : null;
}

// Tipos obligatorios que aún no tienen ningún documento subido.
export function missingRequiredDocuments(documents) {
  const present = new Set(documents.map((document) => document.tipo));
  return REQUIRED_DOCUMENT_TYPES.filter((type) => !present.has(type));
}

// Lo que le falta a la organización para poder enviar la solicitud.
export function submissionBlockers({ identificacionFiscal, documents }) {
  const blockers = [];
  if (!String(identificacionFiscal ?? '').trim()) blockers.push('NIT');
  return [...blockers, ...missingRequiredDocuments(documents)];
}

// Los documentos quedan bloqueados mientras la solicitud está en revisión y
// tras la aprobación, porque son la evidencia de la decisión.
export function documentsLocked({ verified, hasPendingRequest }) {
  return Boolean(verified || hasPendingRequest);
}

// Estado que ve la empresa: la aprobación vigente manda sobre el historial.
export function organizationStatus({ verified, latestRequest }) {
  if (verified) return 'APROBADA';
  return latestRequest?.estado ?? 'SIN_SOLICITUD';
}

// Catálogo que el frontend usa para mostrar los requisitos y validar antes de subir.
export function documentRequirements() {
  return {
    tipos: Object.entries(DOCUMENT_TYPES).map(([tipo, { label, required }]) => ({ tipo, etiqueta: label, obligatorio: required })),
    formatos: DOCUMENT_MIMES,
    maxBytes: MAX_DOCUMENT_BYTES,
    maxDocumentos: MAX_DOCUMENTS,
    maxMensaje: MAX_MESSAGE_LENGTH,
  };
}
