"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveDayLog } from "@/lib/actions/saveDayLog";
import {
  getQueuedFiling,
  listQueuedDates,
  removeQueuedFiling,
  QUEUE_SYNCED_EVENT,
} from "@/lib/offlineQueue";

/**
 * Mounted once in the app shell. Retries queued offline filings on load and
 * whenever the browser comes back online. Stops at the first failure for
 * this pass (still offline, or the server rejected it) rather than
 * hammering every queued date — it'll try the whole queue again next time.
 */
export function OfflineQueueSync() {
  const router = useRouter();
  const syncing = useRef(false);

  useEffect(() => {
    async function syncQueue() {
      if (syncing.current) return;
      syncing.current = true;
      let syncedAny = false;

      try {
        for (const date of listQueuedDates()) {
          const payload = getQueuedFiling(date);
          if (!payload) continue;
          try {
            await saveDayLog(date, payload);
            removeQueuedFiling(date);
            syncedAny = true;
            window.dispatchEvent(new CustomEvent(QUEUE_SYNCED_EVENT, { detail: { date } }));
          } catch {
            break;
          }
        }
      } finally {
        syncing.current = false;
      }

      if (syncedAny) router.refresh();
    }

    syncQueue();
    window.addEventListener("online", syncQueue);
    return () => window.removeEventListener("online", syncQueue);
  }, [router]);

  return null;
}
