import { json, request } from '../../shared/api/client';

type ConvocatoriaResponse = { ok: boolean; convocatoria: any };

const text = (value: unknown) => (typeof value === "string" ? value : null);

// Las fechas y el título llegan como texto; cualquier otro tipo se descarta para
// que la pantalla pueda recortarlos y mostrarlos sin romperse.
function normalizeConvocatoria(raw: any) {
  if (!raw || typeof raw !== "object" || raw.id == null) return null;
  return {
    ...raw,
    titulo: text(raw.titulo) ?? "Convocatoria sin título",
    descripcion: text(raw.descripcion),
    fecha_inicio: text(raw.fecha_inicio),
    fecha_fin: text(raw.fecha_fin),
    total_ofertas: Number(raw.total_ofertas) || 0,
  };
}

export const convocatoriasApi = {
  getConvocatorias: () => request<{ ok: boolean; convocatorias: any[] }>(`/convocatorias`)
    .then((response) => ({ ...response, convocatorias: (Array.isArray(response.convocatorias) ? response.convocatorias : []).map(normalizeConvocatoria).filter(Boolean) })),

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
