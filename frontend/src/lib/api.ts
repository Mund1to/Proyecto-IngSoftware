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
};

export type AdminUser = {
  id: number | string;
  email: string;
  nombre_completo: string;
  activo: boolean;
  created_at: string;
  roles: string[];
  profile_types: string[];
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

  if (options.body && !(options.body instanceof FormData)) {
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

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

type UserResponse = { ok: boolean; user: ApiUser };

export const api = {
  health: () => request<{ status: string }>(`/health`),

  register: (payload: Record<string, unknown>) =>
    request<{ ok: boolean; token: string; user: ApiUser }>(`/auth/register`, json('POST', payload)),

  login: (payload: Record<string, unknown>) =>
    request<{ ok: boolean; token: string; user: ApiUser }>(`/auth/login`, json('POST', payload)),

  getCurrentUser: (token: string) => request<UserResponse>(`/profile/me`, {}, token),

  updateCurrentUser: (payload: Record<string, unknown>, token: string) =>
    request<UserResponse>(`/profile/me`, json('PUT', payload), token),

  changePassword: (currentPassword: string, newPassword: string, token: string) =>
    request<{ ok: boolean; message: string }>(`/profile/password`, json('PUT', { currentPassword, newPassword }), token),

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
    request<{ ok: boolean; organizations: any[] }>(`/verifications/organizations`, {}, token),

  updateOrganizationVerification: (organizationId: string | number, status: string, token: string, observaciones?: string) =>
    request<{ ok: boolean; organization: any; verificationStatus: string }>(
      `/verifications/organizations/${organizationId}`,
      json('PATCH', { estado: status, ...(observaciones ? { observaciones } : {}) }),
      token,
    ),

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
};
