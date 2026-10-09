import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export default function useStoredList<T>(key: string, initialValue: T[]): [T[], Dispatch<SetStateAction<T[]>>] {
  const [value, setValue] = useState<T[]>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) as T[] : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Navegador sin almacenamiento disponible: la lista vive solo en memoria.
    }
  }, [key, value]);

  return [value, setValue];
}

// Ofertas guardadas por el usuario, compartidas entre el catálogo y el detalle.
export function useSavedOffers(userId: number | string | undefined) {
  return useStoredList<number>(`sipu-saved-offers-${userId ?? "anon"}`, []);
}
