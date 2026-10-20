import { json, request } from '../../shared/api/client';

type ConvocatoriaResponse = { ok: boolean; convocatoria: any };

export const convocatoriasApi = {
  getConvocatorias: () => request<{ ok: boolean; convocatorias: any[] }>(`/convocatorias`),

  getConvocatoriaOffers: (id: string | number) =>
    request<{ ok: boolean; offers: any[] }>(`/convocatorias/${id}/offers`),

  createConvocatoria: (payload: Record<string, unknown>, token: string) =>
    request<ConvocatoriaResponse>(`/convocatorias`, json('POST', payload), token),

  updateConvocatoria: (id: string | number, payload: Record<string, unknown>, token: string) =>
    request<ConvocatoriaResponse>(`/convocatorias/${id}`, json('PATCH', payload), token),

  deleteConvocatoria: (id: string | number, token: string) =>
    request<{ ok: boolean; deletedConvocatoriaId: number }>(`/convocatorias/${id}`, json('DELETE'), token),

  assignOfferToConvocatoria: (id: string | number, offerId: string | number, token: string) =>
    request<{ ok: boolean; offer: any }>(`/convocatorias/${id}/offers/${offerId}`, json('PUT'), token),

  unassignOfferFromConvocatoria: (id: string | number, offerId: string | number, token: string) =>
    request<{ ok: boolean; offer: any }>(`/convocatorias/${id}/offers/${offerId}`, json('DELETE'), token),
};
