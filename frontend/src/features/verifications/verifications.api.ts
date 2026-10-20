import { binary, json, openProtectedFile, request } from '../../shared/api/client';

// Fase 7: verificación documental de organizaciones.
export type VerificationStatus = 'SIN_SOLICITUD' | 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
export type RequestStatus = Exclude<VerificationStatus, 'SIN_SOLICITUD'>;
export type VerificationDocumentType = 'RUT' | 'CAMARA_COMERCIO' | 'CEDULA_REPRESENTANTE' | 'OTRO';

export type VerificationDocument = {
  id: number;
  tipo: VerificationDocumentType;
  nombre: string;
  mime: string;
  tamano: number;
  createdAt?: string;
};

export type VerificationRequirements = {
  tipos: { tipo: VerificationDocumentType; etiqueta: string; obligatorio: boolean }[];
  formatos: string[];
  maxBytes: number;
  maxDocumentos: number;
  maxMensaje: number;
};

// Estado que ve la empresa en "Mi empresa". `faltantes` usa 'NIT' o el tipo de documento.
export type OrganizationVerification = {
  estado: VerificationStatus;
  verificada: boolean;
  solicitud: {
    id: number;
    estado: RequestStatus;
    mensaje: string | null;
    observaciones: string | null;
    enviadaPorEmpresa: boolean;
    enviadaAt: string;
    revisadaAt: string | null;
    revisor: string | null;
  } | null;
  documentos: VerificationDocument[];
  bloqueada: boolean;
  faltantes: string[];
  puedeEnviar: boolean;
  requisitos: VerificationRequirements;
};

// Solicitud tal como la ve el revisor.
export type VerificationRequest = {
  id: number;
  estado: RequestStatus;
  mensaje: string | null;
  observaciones: string | null;
  documentos: VerificationDocument[];
  enviadaAt: string;
  revisadaAt: string | null;
  revisor: string | null;
  organizacion: {
    id: number;
    razonSocial: string;
    identificacionFiscal: string | null;
    sitioWeb: string | null;
    descripcion: string | null;
    verificada: boolean;
  };
  solicitante: { nombre: string | null; email: string | null; telefono: string | null };
};

export type VerificationRequestPage = { ok: boolean; requests: VerificationRequest[]; total: number; page: number; limit: number };

// Organización en la vista general del revisor (incluye las que no enviaron solicitud).
export type ReviewedOrganization = {
  organizacion_id: number;
  razon_social: string;
  identificacion_fiscal: string | null;
  sitio_web: string | null;
  verificada: boolean;
  verificacion_estado: RequestStatus | null;
  observaciones: string | null;
  verificacion_fecha: string | null;
  documentos_count?: number;
};

type VerificationResponse = { ok: boolean; verification: OrganizationVerification };

export const verificationsApi = {
  // Lado de la empresa.
  getMyVerification: (token: string) => request<VerificationResponse>(`/verifications/me`, {}, token),

  uploadVerificationDocument: (tipo: VerificationDocumentType, file: File, token: string) =>
    request<{ ok: boolean; document: VerificationDocument; verification: OrganizationVerification }>(
      `/verifications/me/documents?tipo=${encodeURIComponent(tipo)}`,
      binary('POST', file),
      token,
    ),

  deleteVerificationDocument: (documentId: number, token: string) =>
    request<VerificationResponse>(`/verifications/me/documents/${documentId}`, json('DELETE'), token),

  openMyVerificationDocument: (documentId: number, token: string) =>
    openProtectedFile(`/verifications/me/documents/${documentId}`, token),

  submitVerificationRequest: (mensaje: string, token: string) =>
    request<VerificationResponse>(
      `/verifications/me/request`,
      json('POST', mensaje.trim() ? { mensaje: mensaje.trim() } : {}),
      token,
    ),

  withdrawVerificationRequest: (token: string) =>
    request<VerificationResponse>(`/verifications/me/request`, json('DELETE'), token),

  // Revisión (administrador y funcionario).
  getOrganizations: (token: string) =>
    request<{ ok: boolean; organizations: ReviewedOrganization[] }>(`/verifications/organizations`, {}, token),

  updateOrganizationVerification: (organizationId: string | number, status: string, token: string, observaciones?: string) =>
    request<{ ok: boolean; organization: any; verificationStatus: string }>(
      `/verifications/organizations/${organizationId}`,
      json('PATCH', { estado: status, ...(observaciones ? { observaciones } : {}) }),
      token,
    ),

  getVerificationRequests: (token: string, { estado = 'PENDIENTE', page = 1, limit = 20 }: { estado?: RequestStatus | 'TODAS'; page?: number; limit?: number } = {}) =>
    request<VerificationRequestPage>(`/verifications/requests?${new URLSearchParams({ estado, page: String(page), limit: String(limit) })}`, {}, token),

  getVerificationSummary: (token: string) =>
    request<{ ok: boolean; pendientes: number }>(`/verifications/requests/summary`, {}, token),

  decideVerificationRequest: (requestId: number, estado: 'APROBADA' | 'RECHAZADA', observaciones: string, token: string) =>
    request<{ ok: boolean; request: { id: number; estado: RequestStatus; observaciones: string | null; revisado_at: string }; organization: any }>(
      `/verifications/requests/${requestId}`,
      json('PATCH', { estado, ...(observaciones.trim() ? { observaciones: observaciones.trim() } : {}) }),
      token,
    ),

  openVerificationDocument: (documentId: number, token: string) =>
    openProtectedFile(`/verifications/documents/${documentId}`, token),
};
