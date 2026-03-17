/**
 * useLiveRefresh.ts
 *
 * Subscribes to the SSE endpoint (/api/jobs/events) and calls onRefresh()
 * immediately when a data_changed event arrives from jobs-services.
 *
 * This fires in addition to the 30s polling in useAutoRefreshFlash, so
 * any upload via matchdb-data-collection-mono appears in dashboards within
 * ~1 second of being written to MongoDB.
 *
 * Auto-reconnects on disconnect with exponential backoff (max 30 s).
 */
import { useEffect, useRef } from "react";
import { SSE_EVENTS } from "../constants/endpoints";

interface UseLiveRefreshOpts {
  /** Called immediately on every data_changed SSE event */
  onRefresh: () => void;
  /** Set false to disable (e.g. for non-primary dashboard instances) */
  enabled?: boolean;
}

const SSE_URL = SSE_EVENTS;
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_MAX_MS = 30_000;

export function useLiveRefresh({
  onRefresh,
  enabled = true,
}: UseLiveRefreshOpts): void {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh; // always latest without re-creating the effect

  useEffect(() => {
    if (!enabled) return;

    let es: EventSource | null = null;
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    function connect() {
      if (destroyed) return;

      es = new EventSource(SSE_URL);

      es.addEventListener("data_changed", () => {
        retries = 0; // reset backoff on successful message
        onRefreshRef.current();
      });

      es.addEventListener("open", () => {
        retries = 0;
      });

      es.addEventListener("error", (event) => {
        console.warn("[useLiveRefresh] SSE error:", event);
        es?.close();
        es = null;
        if (destroyed) return;
        // Exponential backoff: 2s, 4s, 8s … capped at 30s
        const delay = Math.min(BACKOFF_BASE_MS * 2 ** retries, BACKOFF_MAX_MS);
        retries++;
        retryTimer = setTimeout(connect, delay);
      });
    }

    connect();

    return () => {
      destroyed = true;
      if (retryTimer != null) clearTimeout(retryTimer);
      es?.close();
    };
  }, [enabled]);
}
