"use client";

import { useEffect } from "react";

/**
 * Service workers require a secure context (HTTPS, or localhost which the
 * browser exempts). Registration is gated to production builds so `next
 * dev`'s own HMR/fast-refresh traffic never gets caught by the SW's fetch
 * handler — run `npm run build && npm start` to exercise this for real.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
