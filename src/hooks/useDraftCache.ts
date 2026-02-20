import { useCallback, useEffect, useRef } from 'react';

/**
 * Provides auto-save draft caching to localStorage.
 * saveDraft() is debounced (800ms) so it doesn't hammer storage on every keypress.
 * The draft is cleared when clearDraft() is called (e.g. after successful save/submit).
 */
function useDraftCache<T>(key: string) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveDraft = useCallback(
    (data: T) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          localStorage.setItem(key, JSON.stringify(data));
        } catch {
          // quota exceeded or private browsing — ignore
        }
      }, 800);
    },
    [key],
  );

  const getDraft = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }, [key]);

  const clearDraft = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    localStorage.removeItem(key);
  }, [key]);

  const hasDraft = useCallback((): boolean => {
    return localStorage.getItem(key) !== null;
  }, [key]);

  // Cancel any pending save on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { saveDraft, getDraft, clearDraft, hasDraft };
}

export default useDraftCache;
