import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/**
 * State that belongs to a measurement/design workspace should survive tab changes
 * and application restarts. Storage failures are deliberately non-fatal.
 */
export function usePersistentState<T>(
  key: string,
  initialValue: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem(key);
        if (stored !== null) return JSON.parse(stored) as T;
      }
    } catch {
      // Private mode, full storage or malformed old data: fall back to defaults.
    }
    return typeof initialValue === "function"
      ? (initialValue as () => T)()
      : initialValue;
  });

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch {
      // Persisting a project is best-effort; measurements remain usable without storage.
    }
  }, [key, value]);

  return [value, setValue];
}
