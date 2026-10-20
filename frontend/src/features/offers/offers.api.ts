import { json, request } from '../../shared/api/client';

// Las ofertas llegan con las columnas del backend (titulo, tipo, fecha_cierre...);
// offers.model.ts las convierte al formato de las pantallas.
type OffersResponse = { ok: boolean; offers: any[] };
type OfferResponse = { ok: boolean; offer: any };

export const offersApi = {
  getOffers: () => request<OffersResponse>(`/offers`),

  getOffer: (offerId: string | number) => request<OfferResponse>(`/offers/${offerId}`),

  getRecommendedOffers: (token: string) => request<OffersResponse>(`/offers/recommended`, {}, token),

  // Organización: sus ofertas en cualquier estado.
  getMyOffers: (token: string) => request<OffersResponse>(`/offers/mine`, {}, token),

  createOffer: (payload: Record<string, unknown>, token: string) =>
    request<OfferResponse>(`/offers`, json('POST', payload), token),

  updateOffer: (offerId: string | number, payload: Record<string, unknown>, token: string) =>
    request<OfferResponse>(`/offers/${offerId}`, json('PATCH', payload), token),

  deleteOffer: (offerId: string | number, token: string) =>
    request<{ ok: boolean; deletedOfferId: number }>(`/offers/${offerId}`, json('DELETE'), token),
};
