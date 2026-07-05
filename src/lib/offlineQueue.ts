import type { SaveDayLogPayload } from "@/lib/actions/saveDayLog";

/**
 * Bounded, honest offline support: if a DONE save fails from a genuine
 * network error, the payload is parked here (keyed by date — the latest
 * write for a date replaces any earlier queued one, matching the server's
 * own upsert-by-(user,date) conflict rule, so "last write wins" is
 * consistent whether the write lands online or gets queued first).
 */
const QUEUE_KEY = "dbar.offlineQueue.v1";

export const QUEUE_SYNCED_EVENT = "dbar:queue-synced";

type QueueMap = Record<string, SaveDayLogPayload>;

function readQueue(): QueueMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueueMap) : {};
  } catch {
    return {};
  }
}

function writeQueue(queue: QueueMap): void {
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function queueFiling(date: string, payload: SaveDayLogPayload): void {
  const queue = readQueue();
  queue[date] = payload;
  writeQueue(queue);
}

export function hasQueuedFiling(date: string): boolean {
  return date in readQueue();
}

export function getQueuedFiling(date: string): SaveDayLogPayload | null {
  return readQueue()[date] ?? null;
}

export function removeQueuedFiling(date: string): void {
  const queue = readQueue();
  delete queue[date];
  writeQueue(queue);
}

export function listQueuedDates(): string[] {
  return Object.keys(readQueue());
}
