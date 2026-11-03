import { binary, json, openProtectedFile, request } from '../../shared/api/client';
import type { Interview } from './applications.model';

type ApplicationsResponse = { ok: boolean; applications: any[] };
type ApplicationResponse = { ok: boolean; application: any };

export type ApplyPayload = { cartaPresentacion?: string; cvPerfil?: boolean };
export type StageChange = { mensaje?: string; entrevista?: Omit<Interview, 'lugar' | 'duracionMinutos'> & { lugar?: string | null; duracionMinutos?: number | null } };

export const applicationsApi = {
  // Candidato: sus postulaciones con historial público, entrevista y hoja de vida enviada.
  getMyApplications: (token: string) => request<ApplicationsResponse>(`/applications/me`, {}, token),

  applyToOffer: (offerId: string | number, token: string, payload: ApplyPayload = {}) =>
    request<ApplicationResponse>(`/applications/offers/${offerId}`, json('POST', payload), token),

  // Hoja de vida solo para esta postulación (no cambia la del perfil).
  uploadApplicationCv: (applicationId: string | number, file: File, token: string) =>
    request<{ ok: boolean; cv: any }>(`/applications/${applicationId}/cv`, binary('PUT', file), token),

  withdrawApplication: (applicationId: string | number, token: string, motivo?: string) =>
    request<ApplicationResponse>(`/applications/${applicationId}/withdraw`, json('PATCH', motivo ? { motivo } : undefined), token),

  // Organización: postulantes de una oferta propia y proceso de selección.
  getApplicationsForOffer: (offerId: string | number, token: string) =>
    request<ApplicationsResponse>(`/applications/offers/${offerId}`, {}, token),

  updateApplicationStatus: (applicationId: string | number, status: string, token: string, change: StageChange = {}) =>
    request<ApplicationResponse>(`/applications/${applicationId}/status`, json('PATCH', { estado: status, ...change }), token),

  addApplicationNote: (applicationId: string | number, texto: string, token: string) =>
    request<{ ok: boolean; event: any }>(`/applications/${applicationId}/notes`, json('POST', { texto }), token),

  rateApplication: (applicationId: string | number, calificacion: number | null, token: string) =>
    request<ApplicationResponse>(`/applications/${applicationId}/rating`, json('PATCH', { calificacion }), token),

  // La ven la empresa y el propio candidato: es la copia enviada con la postulación.
  openApplicationCv: (applicationId: string | number, token: string) =>
    openProtectedFile(`/applications/${applicationId}/cv`, token),
};
