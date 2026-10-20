import useStoredList from "../../shared/lib/useStoredList";

// Ofertas guardadas por el usuario, compartidas entre el catálogo y el detalle.
export function useSavedOffers(userId: number | string | undefined) {
  return useStoredList<number>(`sipu-saved-offers-${userId ?? "anon"}`, []);
}
