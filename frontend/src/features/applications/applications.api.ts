import { json, openProtectedFile, request } from '../../shared/api/client';

type ApplicationsResponse = { ok: boolean; applications: any[] };
type ApplicationResponse = { ok: boolean; application: any };

export const applicationsApi = {
  // Candidato: sus postulaciones.
  getMyApplications: (token: string) => request<ApplicationsResponse>(`/applications/me`, {}, token),

  applyToOffer: (offerId: string | number, token: string, payload: Record<string, unknown> = {}) =>
    request<ApplicationResponse>(`/applications/offers/${offerId}`, json('POST', payload), token),

  withdrawApplication: (applicationId: string | number, token: string) =>
    request<ApplicationResponse>(`/applications/${applicationId}/withdraw`, json('PATCH'), token),

  // Organización: postulantes de una oferta propia.
  getApplicationsForOffer: (offerId: string | number, token: string) =>
    request<ApplicationsResponse>(`/applications/offers/${offerId}`, {}, token),

  updateApplicationStatus: (applicationId: string | number, status: string, token: string) =>
    request<ApplicationResponse>(`/applications/${applicationId}/status`, json('PATCH', { estado: status }), token),

  openApplicationCv: (applicationId: string | number, token: string) =>
    openProtectedFile(`/applications/${applicationId}/cv`, token),
};
