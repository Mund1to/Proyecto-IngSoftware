export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export type ApiUser = {
  id: number;
  email: string;
  nombreCompleto: string;
  telefono?: string | null;
  activo?: boolean;
  createdAt?: string;
  roles?: string[];
  profileTypes?: string[];
  perfiles?: Array<{
    id?: number;
    tipo?: string;
    universidad?: string | null;
    programaAcademico?: string | null;
    semestre?: number | string | null;
    codigoEstudiante?: string | null;
    razonSocial?: string | null;
    descripcion?: string | null;
    sitioWeb?: string | null;
    ubicacion?: string | null;
    verificada?: boolean;
    cvUrl?: string | null;
  }>;
};

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers ?? {});

  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.message ?? 'La solicitud falló.');
  }

  return (payload ?? ({} as T)) as T;
}

export const api = {
  register: async (payload: Record<string, unknown>) =>
    request<{ ok: boolean; token: string; user: ApiUser }>(`/auth/register`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: async (payload: Record<string, unknown>) =>
    request<{ ok: boolean; token: string; user: ApiUser }>(`/auth/login`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getCurrentUser: async (token: string) =>
    request<{ ok: boolean; user: ApiUser }>(`/profile/me`, {}, token),

  updateCurrentUser: async (payload: Record<string, unknown>, token: string) =>
    request<{ ok: boolean; user: ApiUser }>(`/profile/me`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, token),

  updateStudentProfile: async (payload: Record<string, unknown>, token: string) =>
    request<{ ok: boolean; user: ApiUser }>(`/profile/student`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, token),

  getOffers: async () => request<{ ok: boolean; offers: any[] }>(`/offers`),

  getMyOffers: async (token: string) =>
    request<{ ok: boolean; offers: any[] }>(`/offers/mine`, {}, token),

  createOffer: async (payload: Record<string, unknown>, token: string) =>
    request<{ ok: boolean; offer: any }>(`/offers`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),

  getApplicationsForOffer: async (offerId: string | number, token: string) =>
    request<{ ok: boolean; applications: any[] }>(`/applications/offers/${offerId}`, {}, token),

  getMyApplications: async (token: string) =>
    request<{ ok: boolean; applications: any[] }>(`/applications/me`, {}, token),

  applyToOffer: async (offerId: string | number, token: string, payload: Record<string, unknown> = {}) =>
    request<{ ok: boolean; application: any }>(`/applications/offers/${offerId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),

  updateApplicationStatus: async (applicationId: string | number, status: string, token: string) =>
    request<{ ok: boolean; application: any }>(`/applications/${applicationId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ estado: status }),
    }, token),
};
