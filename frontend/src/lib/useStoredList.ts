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
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}