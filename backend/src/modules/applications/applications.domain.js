// Reglas puras del proceso de selección: estados, transiciones y datos de la
// entrevista. No conocen la base de datos ni HTTP, así que se prueban aisladas
// (tests/unit.test.js) y el frontend comprueba que coincidan (contracts.test.ts).

// Estados de una postulación (tipo application_status de la base de datos).
// PRESELECCIONADA es la etapa de entrevista.
export const APPLICATION_STATUSES = ['ENVIADA', 'EN_REVISION', 'PRESELECCIONADA', 'RECHAZADA', 'RETIRADA', 'ACEPTADA'];

// Estados que puede asignar la organización. RETIRADA solo la aplica el candidato.
export const COMPANY_STATUSES = ['ENVIADA', 'EN_REVISION', 'PRESELECCIONADA', 'RECHAZADA', 'ACEPTADA'];

// Estados finales: la postulación ya no se puede retirar.
export const RESOLVED_STATUSES = ['ACEPTADA', 'RECHAZADA', 'RETIRADA'];

// Mensaje opcional del candidato para la empresa al postularse.
export const MAX_COVER_LETTER_LENGTH = 1500;
// Mensaje de la empresa al candidato en un cambio de etapa y nota privada.
export const MAX_MESSAGE_LENGTH = 1000;
export const MIN_NOTE_LENGTH = 2;
export const MAX_NOTE_LENGTH = 1000;

export const INTERVIEW_MODES = ['PRESENCIAL', 'VIRTUAL', 'TELEFONICA'];
export const INTERVIEW_MIN_MINUTES = 15;
export const INTERVIEW_MAX_MINUTES = 240;
// Una entrevista se agenda como máximo con seis meses de anticipación.
export const INTERVIEW_MAX_DAYS_AHEAD = 180;

// Etapas a las que la organización puede mover una postulación desde cada estado.
// Las ofertas de práctica y empleo pasan por entrevista antes de aceptar;
// PRESELECCIONADA -> PRESELECCIONADA es reprogramar la entrevista. Una decisión
// (aceptada o rechazada) puede reabrirse volviendo a revisión.
const SELECTION_PIPELINE = {
  ENVIADA: ['EN_REVISION', 'PRESELECCIONADA', 'RECHAZADA'],
  EN_REVISION: ['PRESELECCIONADA', 'RECHAZADA'],
  PRESELECCIONADA: ['PRESELECCIONADA', 'ACEPTADA', 'RECHAZADA', 'EN_REVISION'],
  ACEPTADA: ['EN_REVISION'],
  RECHAZADA: ['EN_REVISION'],
  RETIRADA: [],
};

// La formación (cursos y programas) no tiene entrevista: la inscripción se acepta
// o se rechaza directamente. PRESELECCIONADA solo aparece en datos anteriores.
const TRAINING_PIPELINE = {
  ENVIADA: ['EN_REVISION', 'ACEPTADA', 'RECHAZADA'],
  EN_REVISION: ['ACEPTADA', 'RECHAZADA'],
  PRESELECCIONADA: ['ACEPTADA', 'RECHAZADA', 'EN_REVISION'],
  ACEPTADA: ['EN_REVISION'],
  RECHAZADA: ['EN_REVISION'],
  RETIRADA: [],
};

export function pipelineFor(offerType) {
  return String(offerType).toUpperCase() === 'FORMACION' ? TRAINING_PIPELINE : SELECTION_PIPELINE;
}

export function allowedTransitions(currentStatus, offerType) {
  return pipelineFor(offerType)[currentStatus] ?? [];
}

// Mensaje que explica por qué no se permite el cambio, o null si se permite.
export function transitionError(currentStatus, nextStatus, offerType) {
  if (allowedTransitions(currentStatus, offerType).includes(nextStatus)) return null;

  if (currentStatus === 'RETIRADA') return 'El candidato retiró esta postulación.';
  if (currentStatus === nextStatus) return 'La postulación ya está en esa etapa.';
  if (nextStatus === 'ACEPTADA' && (currentStatus === 'ENVIADA' || currentStatus === 'EN_REVISION')) {
    return 'Antes de aceptar a un candidato debes citarlo a entrevista.';
  }
  if (currentStatus === 'ACEPTADA' || currentStatus === 'RECHAZADA') {
    return 'Esta postulación ya tiene una decisión. Vuelve a abrir el proceso (pasarla a revisión) antes de cambiarla.';
  }
  if (nextStatus === 'PRESELECCIONADA') return 'Las ofertas de formación no tienen etapa de entrevista.';
  if (nextStatus === 'ENVIADA') return 'Una postulación no puede volver a la etapa de recibida.';
  return 'Ese cambio de etapa no está permitido.';
}

// "Telefónica", "virtual" o "PRESENCIAL" -> la modalidad canónica, o undefined.
function normalizeInterviewMode(value) {
  const simple = String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase();
  return INTERVIEW_MODES.includes(simple) ? simple : undefined;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

// Valida los datos de la entrevista. Devuelve { value } con
// { fecha, modalidad, lugar, duracionMinutos } o { error } con el mensaje.
export function parseInterview(raw, now = new Date()) {
  if (!raw || typeof raw !== 'object') return { error: 'Indica la fecha, la hora y la modalidad de la entrevista.' };

  const date = new Date(String(raw.fecha ?? raw.date ?? ''));
  if (!Number.isFinite(date.getTime())) return { error: 'La fecha de la entrevista no es válida.' };
  if (date.getTime() <= now.getTime()) return { error: 'La entrevista debe programarse en una fecha y hora futuras.' };
  if (date.getTime() > now.getTime() + INTERVIEW_MAX_DAYS_AHEAD * 86400000) {
    return { error: 'La entrevista no puede programarse con más de seis meses de anticipación.' };
  }

  const modalidad = normalizeInterviewMode(raw.modalidad ?? raw.mode);
  if (!modalidad) return { error: 'La modalidad de la entrevista debe ser presencial, virtual o telefónica.' };

  const lugar = String(raw.lugar ?? raw.place ?? '').trim();
  if (modalidad === 'PRESENCIAL' && lugar.length < 5) {
    return { error: 'Indica la dirección o el lugar de la entrevista presencial.' };
  }
  if (modalidad === 'VIRTUAL' && !isHttpUrl(lugar)) {
    return { error: 'Indica el enlace de la reunión virtual (debe empezar por https://).' };
  }
  if (lugar.length > 300) return { error: 'El lugar o enlace de la entrevista es demasiado largo.' };

  const minutesRaw = raw.duracionMinutos ?? raw.duration;
  let duracionMinutos = null;
  if (minutesRaw !== undefined && minutesRaw !== null && minutesRaw !== '') {
    duracionMinutos = Number(minutesRaw);
    if (!Number.isInteger(duracionMinutos) || duracionMinutos < INTERVIEW_MIN_MINUTES || duracionMinutos > INTERVIEW_MAX_MINUTES) {
      return { error: `La duración de la entrevista debe estar entre ${INTERVIEW_MIN_MINUTES} y ${INTERVIEW_MAX_MINUTES} minutos.` };
    }
  }

  return { value: { fecha: date.toISOString(), modalidad, lugar: lugar || null, duracionMinutos } };
}
