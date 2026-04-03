import { useEffect, useRef, useState } from "react";

/**
 * Generic hook that tracks data diffs and produces flash-animation Sets.
 *
 * How it works:
 *  1. Every `intervalMs` (default 30 s) the supplied `refresh()` callback fires.
 *  2. Whenever `data` changes, the hook diffs the previous snapshot against the
 *     new one (by the key returned from `keyExtractor`).
 *  3. Rows that are NEW or whose JSON changed → `flashIds` (yellow).
 *  4. Rows that existed before but are gone → `deleteFlashIds` (red).
 *  5. After `flashDurationMs` the Sets are cleared automatically.
 *
 * Returns `{ flashIds, deleteFlashIds, lastSync }`.
 */
export interface UseAutoRefreshFlashOpts<T> {
  /** Current data array (from Redux / API). */
  data: T[];
  /** Unique key per row (must be stable across refreshes). */
  keyExtractor: (row: T) => string;
  /** Called every `intervalMs` to trigger a data fetch. */
  refresh: () => void;
  /** Polling interval in ms (default 30 000). */
  intervalMs?: number;
  /** How long the flash animation lasts in ms (default 2 000). */
  flashDurationMs?: number;
  /** Set to false to pause the auto-refresh (e.g. when component is hidden). */
  enabled?: boolean;
}

export interface FlashState {
  flashIds: Set<string>;
  deleteFlashIds: Set<string>;
  lastSync: number | null;
}

export function useAutoRefreshFlash<T>({
  data,
  keyExtractor,
  refresh,
  intervalMs = 30_000,
  flashDurationMs = 2_000,
  enabled = true,
}: UseAutoRefreshFlashOpts<T>): FlashState {
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [deleteFlashIds, setDeleteFlashIds] = useState<Set<string>>(new Set());
  const [lastSync, setLastSync] = useState<number | null>(null);

  // Store previous snapshot keyed by id → serialised row
  const prevSnap = useRef<Map<string, string>>(new Map());
  // Skip the very first diff (mount) to avoid flashing everything
  const firstRun = useRef(true);

  // Diff whenever data changes -------------------------------------------------
  useEffect(() => {
    const currentMap = new Map<string, string>();
    for (const row of data) {
      currentMap.set(keyExtractor(row), JSON.stringify(row));
    }

    if (firstRun.current) {
      firstRun.current = false;
      prevSnap.current = currentMap;
      return;
    }

    const changed = new Set<string>();
    const deleted = new Set<string>();

    // Detect new / changed rows
    for (const [id, json] of currentMap) {
      const old = prevSnap.current.get(id);
      if (old === undefined || old !== json) {
        changed.add(id);
      }
    }

    // Detect deleted rows
    for (const id of prevSnap.current.keys()) {
      if (!currentMap.has(id)) {
        deleted.add(id);
      }
    }

    prevSnap.current = currentMap;

    if (changed.size > 0) setFlashIds(changed);
    if (deleted.size > 0) setDeleteFlashIds(deleted);
    if (changed.size > 0 || deleted.size > 0) setLastSync(Date.now());

    // Clear flash after animation duration
    if (changed.size > 0 || deleted.size > 0) {
      const timer = setTimeout(() => {
        setFlashIds(new Set());
        setDeleteFlashIds(new Set());
      }, flashDurationMs);
      return () => clearTimeout(timer);
    }
  }, [data, keyExtractor, flashDurationMs]);

  // Auto-refresh interval -------------------------------------------------------
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, refresh]);

  return { flashIds, deleteFlashIds, lastSync };
}
