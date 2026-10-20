// URL de la API desplegada en Render. Se usa si el build de producción no recibe
// VITE_API_URL, para que el frontend publicado nunca apunte a localhost.
export const PRODUCTION_API_URL = 'https://proyecto-ingsoftware.onrender.com/api';

export function resolveApiBaseUrl(configured: string | undefined, isProduction: boolean): string {
  const value = configured?.trim();
  if (value) return value.replace(/\/+$/, '');
  return isProduction ? PRODUCTION_API_URL : 'http://localhost:3000/api';
}

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_URL, import.meta.env.PROD);

// Render (plan gratuito) puede tardar cerca de un minuto en despertar.
export const REQUEST_TIMEOUT_MS = 70000;

export const SESSION_EXPIRED_EVENT = 'sipu:session-expired';

export type ApiProfile = {
  id?: number;
  tipo?: string;
  visible?: boolean;
  universidad?: string | null;
  programaAcademico?: string | null;
  semestre?: number | string | null;
  codigoEstudiante?: string | null;
  fechaGraduacionEstimada?: string | null;
  razonSocial?: string | null;
  identificacionFiscal?: string | null;
  descripcion?: string | null;
  sitioWeb?: string | null;
  ubicacion?: string | null;
  resumen?: string | null;
  disponibilidad?: string | null;
  verificada?: boolean;
  cvUrl?: string | null;
};

export type ApiUser = {
  id: number;
  email: string;
  nombreCompleto: string;
  telefono?: string | null;
  activo?: boolean;
  createdAt?: string;
  roles?: string[];
  profileTypes?: string[];
  perfiles?: ApiProfile[];
  archivos?: StoredFile[];
};

export type FileKind = 'cv' | 'foto';

export type StoredFile = { tipo: 'CV' | 'FOTO'; nombre: string; mime: string; tamano: number; createdAt?: string; created_at?: string };

export type EducationItem = { id?: number | string; titulo: string; institucion: string; periodo: string };
export type ExperienceItem = { id?: number | string; cargo: string; empresa: string; periodo: string; descripcion?: string | null };
export type SkillItem = { id?: number | string; categoria: string; nombre: string };
export type ProfileDetails = { education: EducationItem[]; experience: ExperienceItem[]; skills: SkillItem[] };

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

export type AdminUser = {
  id: number | string;
  email: string;
  nombre_completo: string;
  activo: boolean;
  created_at: string;
  roles: string[];
  profile_types: string[];
  // Fecha de la última solicitud de cambio de contraseña sin atender (últimos 7 días).
  solicitud_contrasena?: string | null;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers ?? {});

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, signal: controller.signal });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    throw new ApiError(
      aborted
        ? 'El servidor tardó demasiado en responder. Puede estar iniciándose; inténtalo de nuevo en unos segundos.'
        : 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
      0,
    );
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    // Un token vencido o una cuenta eliminada cierran la sesión en toda la app.
    if (response.status === 401 && token && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(payload?.message ?? 'La solicitud falló.', response.status);
  }

  return (payload ?? ({} as T)) as T;
}

// Descarga un archivo protegido (requiere el token) y devuelve un Blob.
export async function requestBlob(path: string, token: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.', 0);
  }

  if (!response.ok) {
    const payload = (response.headers.get('content-type') ?? '').includes('application/json') ? await response.json() : null;
    if (response.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    throw new ApiError(payload?.message ?? 'No se pudo descargar el archivo.', response.status);
  }

  return response.blob();
}

// Abre un archivo protegido en una pestaña nueva.
export async function openProtectedFile(path: string, token: string) {
  // La pestaña se abre antes de la descarga para que el navegador no la bloquee.
  const tab = window.open('', '_blank');
  try {
    const url = URL.createObjectURL(await requestBlob(path, token));
    if (tab) tab.location.href = url;
    else window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

type UserResponse = { ok: boolean; user: ApiUser };

export const api = {
  health: () => request<{ status: string }>(`/health`),

  register: (payload: Record<string, unknown>) =>
    request<{ ok: boolean; token: string; user: ApiUser }>(`/auth/register`, json('POST', payload)),

  forgotPassword: (email: string) =>
    request<{ ok: boolean; message: string }>(`/auth/forgot-password`, json('POST', { email })),

  resetPassword: (token: string, password: string) =>
    request<{ ok: boolean; message: string }>(`/auth/reset-password`, json('POST', { token, password })),

  login: (payload: Record<string, unknown>) =>
    request<{ ok: boolean; token: string; user: ApiUser }>(`/auth/login`, json('POST', payload)),

  getCurrentUser: (token: string) => request<UserResponse>(`/profile/me`, {}, token),

  updateCurrentUser: (payload: Record<string, unknown>, token: string) =>
    request<UserResponse>(`/profile/me`, json('PUT', payload), token),

  changePassword: (currentPassword: string, newPassword: string, token: string) =>
    request<{ ok: boolean; message: string; token: string }>(`/profile/password`, json('PUT', { currentPassword, newPassword }), token),

  getProfileDetails: (token: string) =>
    request<{ ok: boolean; details: ProfileDetails }>(`/profile/details`, {}, token),

  saveEducation: (items: EducationItem[], token: string) =>
    request<{ ok: boolean; details: ProfileDetails }>(`/profile/education`, json('PUT', { items }), token),

  saveExperience: (items: ExperienceItem[], token: string) =>
    request<{ ok: boolean; details: ProfileDetails }>(`/profile/experience`, json('PUT', { items }), token),

  saveSkills: (items: SkillItem[], token: string) =>
    request<{ ok: boolean; details: ProfileDetails }>(`/profile/skills`, json('PUT', { items }), token),

  uploadFile: (kind: FileKind, file: File, token: string) =>
    request<{ ok: boolean; file: StoredFile }>(`/profile/files/${kind}`, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
    }, token),

  deleteFile: (kind: FileKind, token: string) =>
    request<{ ok: boolean }>(`/profile/files/${kind}`, json('DELETE'), token),

  getFile: (kind: FileKind, token: string) => requestBlob(`/profile/files/${kind}`, token),

  openMyFile: (kind: FileKind, token: string) => openProtectedFile(`/profile/files/${kind}`, token),

  openApplicationCv: (applicationId: string | number, token: string) =>
    openProtectedFile(`/applications/${applicationId}/cv`, token),

  updateStudentProfile: (payload: Record<string, unknown>, token: string) =>
    request<UserResponse>(`/profile/student`, json('PUT', payload), token),

  updateExternalProfile: (payload: Record<string, unknown>, token: string) =>
    request<UserResponse>(`/profile/external`, json('PUT', payload), token),

  updateOrganizationProfile: (payload: Record<string, unknown>, token: string) =>
    request<UserResponse>(`/profile/organization`, json('PUT', payload), token),

  getOffers: () => request<{ ok: boolean; offers: any[] }>(`/offers`),

  getOffer: (offerId: string | number) => request<{ ok: boolean; offer: any }>(`/offers/${offerId}`),

  getRecommendedOffers: (token: string) =>
    request<{ ok: boolean; offers: any[] }>(`/offers/recommended`, {}, token),

  getOrganizations: (token: string) =>
    request<{ ok: boolean; organizations: ReviewedOrganization[] }>(`/verifications/organizations`, {}, token),

  updateOrganizationVerification: (organizationId: string | number, status: string, token: string, observaciones?: string) =>
    request<{ ok: boolean; organization: any; verificationStatus: string }>(
      `/verifications/organizations/${organizationId}`,
      json('PATCH', { estado: status, ...(observaciones ? { observaciones } : {}) }),
      token,
    ),

  // Verificación documental: lado de la empresa.
  getMyVerification: (token: string) =>
    request<{ ok: boolean; verification: OrganizationVerification }>(`/verifications/me`, {}, token),

  uploadVerificationDocument: (tipo: VerificationDocumentType, file: File, token: string) =>
    request<{ ok: boolean; document: VerificationDocument; verification: OrganizationVerification }>(
      `/verifications/me/documents?tipo=${encodeURIComponent(tipo)}`,
      {
        method: 'POST',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
      },
      token,
    ),

  deleteVerificationDocument: (documentId: number, token: string) =>
    request<{ ok: boolean; verification: OrganizationVerification }>(`/verifications/me/documents/${documentId}`, json('DELETE'), token),

  openMyVerificationDocument: (documentId: number, token: string) =>
    openProtectedFile(`/verifications/me/documents/${documentId}`, token),

  submitVerificationRequest: (mensaje: string, token: string) =>
    request<{ ok: boolean; verification: OrganizationVerification }>(
      `/verifications/me/request`,
      json('POST', mensaje.trim() ? { mensaje: mensaje.trim() } : {}),
      token,
    ),

  withdrawVerificationRequest: (token: string) =>
    request<{ ok: boolean; verification: OrganizationVerification }>(`/verifications/me/request`, json('DELETE'), token),

  // Verificación documental: revisión (administrador y funcionario).
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

  getMyOffers: (token: string) => request<{ ok: boolean; offers: any[] }>(`/offers/mine`, {}, token),

  createOffer: (payload: Record<string, unknown>, token: string) =>
    request<{ ok: boolean; offer: any }>(`/offers`, json('POST', payload), token),

  updateOffer: (offerId: string | number, payload: Record<string, unknown>, token: string) =>
    request<{ ok: boolean; offer: any }>(`/offers/${offerId}`, json('PATCH', payload), token),

  deleteOffer: (offerId: string | number, token: string) =>
    request<{ ok: boolean; deletedOfferId: number }>(`/offers/${offerId}`, json('DELETE'), token),

  getApplicationsForOffer: (offerId: string | number, token: string) =>
    request<{ ok: boolean; applications: any[] }>(`/applications/offers/${offerId}`, {}, token),

  getMyApplications: (token: string) =>
    request<{ ok: boolean; applications: any[] }>(`/applications/me`, {}, token),

  applyToOffer: (offerId: string | number, token: string, payload: Record<string, unknown> = {}) =>
    request<{ ok: boolean; application: any }>(`/applications/offers/${offerId}`, json('POST', payload), token),

  withdrawApplication: (applicationId: string | number, token: string) =>
    request<{ ok: boolean; application: any }>(`/applications/${applicationId}/withdraw`, json('PATCH'), token),

  updateApplicationStatus: (applicationId: string | number, status: string, token: string) =>
    request<{ ok: boolean; application: any }>(`/applications/${applicationId}/status`, json('PATCH', { estado: status }), token),

  getConvocatorias: () => request<{ ok: boolean; convocatorias: any[] }>(`/convocatorias`),

  getConvocatoriaOffers: (id: string | number) =>
    request<{ ok: boolean; offers: any[] }>(`/convocatorias/${id}/offers`),

  createConvocatoria: (payload: Record<string, unknown>, token: string) =>
    request<{ ok: boolean; convocatoria: any }>(`/convocatorias`, json('POST', payload), token),

  updateConvocatoria: (id: string | number, payload: Record<string, unknown>, token: string) =>
    request<{ ok: boolean; convocatoria: any }>(`/convocatorias/${id}`, json('PATCH', payload), token),

  deleteConvocatoria: (id: string | number, token: string) =>
    request<{ ok: boolean; deletedConvocatoriaId: number }>(`/convocatorias/${id}`, json('DELETE'), token),

  assignOfferToConvocatoria: (id: string | number, offerId: string | number, token: string) =>
    request<{ ok: boolean; offer: any }>(`/convocatorias/${id}/offers/${offerId}`, json('PUT'), token),

  unassignOfferFromConvocatoria: (id: string | number, offerId: string | number, token: string) =>
    request<{ ok: boolean; offer: any }>(`/convocatorias/${id}/offers/${offerId}`, json('DELETE'), token),

  getEmploymentStats: (token: string) =>
    request<{ ok: boolean; stats: any }>(`/stats/employment`, {}, token),

  getUsers: (token: string, search = '') =>
    request<{ ok: boolean; users: AdminUser[] }>(`/admin/users${search ? `?q=${encodeURIComponent(search)}` : ''}`, {}, token),

  updateUserRoles: (userId: string | number, roles: string[], token: string) =>
    request<{ ok: boolean; user: AdminUser }>(`/admin/users/${userId}/roles`, json('PUT', { roles }), token),

  updateUserActive: (userId: string | number, activo: boolean, token: string) =>
    request<{ ok: boolean; user: AdminUser }>(`/admin/users/${userId}/active`, json('PATCH', { activo }), token),

  setUserPassword: (userId: string | number, password: string, token: string) =>
    request<{ ok: boolean; message: string; user: AdminUser }>(`/admin/users/${userId}/password`, json('PUT', { password }), token),
};
