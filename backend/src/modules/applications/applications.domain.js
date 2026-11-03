// Estados de una postulación (tipo application_status de la base de datos).
export const APPLICATION_STATUSES = ['ENVIADA', 'EN_REVISION', 'PRESELECCIONADA', 'RECHAZADA', 'RETIRADA', 'ACEPTADA'];

// Estados que puede asignar la organización. RETIRADA solo la aplica el candidato.
export const COMPANY_STATUSES = ['ENVIADA', 'EN_REVISION', 'PRESELECCIONADA', 'RECHAZADA', 'ACEPTADA'];

// Estados finales: la postulación ya no se puede retirar.
export const RESOLVED_STATUSES = ['ACEPTADA', 'RECHAZADA', 'RETIRADA'];

// Mensaje opcional del candidato para la empresa al postularse.
export const MAX_COVER_LETTER_LENGTH = 1500;
