import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

// Lista guardada en localStorage con la clave indicada. Si el navegador bloquea
// el almacenamiento, la lista funciona igual pero solo en memoria.
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
