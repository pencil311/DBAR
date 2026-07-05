/**
 * The service worker, served at /sw.js via a route handler (rather than a
 * static public/sw.js) so its cache name can be derived from the actual
 * deploy — Vercel sets VERCEL_GIT_COMMIT_SHA per build/runtime, which a
 * static file has no way to see. Scope defaults to "/" since the script is
 * served from the site root.
 *
 * Explicitly out of scope for this pass (documented, not forgotten):
 *   - Push notification reminders — needs VAPID keys, a push service, and a
 *     send-time cron; planned as a future prompt.
 *   - Background Sync API — flaky cross-browser support; the 'online' event
 *     listener in OfflineQueueSync covers the same need well enough.
 *   - Offline read of ledger/docket data — would need a client-side data
 *     cache (e.g. IndexedDB mirror of DayLogs) we don't have yet; the page
 *     cache below is best-effort only (whatever was last visited online).
 */

const CACHE_VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? "dev";

const SCRIPT = `
const CACHE_NAME = "dbar-cache-${CACHE_VERSION}";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// New deploy -> new CACHE_NAME -> old caches from previous deploys purged here.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isCacheFirstAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
}

// Never cache API routes or any non-GET request — that covers Server Action
// POSTs, which must always hit the network so mutations aren't silently lost.
function isUncacheable(request, url) {
  return url.pathname.startsWith("/api/") || request.method !== "GET";
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (isUncacheable(request, url)) return;

  if (isCacheFirstAsset(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const response = await fetch(request);
          cache.put(request, response.clone());
          return response;
        } catch {
          const cachedPage = await cache.match(request);
          return cachedPage ?? (await cache.match(OFFLINE_URL));
        }
      })()
    );
  }
});
`;

export async function GET() {
  return new Response(SCRIPT, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
