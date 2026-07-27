/**
 * A one-shot breadcrumb for pages that carry their own back control.
 *
 * `window.history.length` can't answer the question that actually matters —
 * "is the previous entry one of ours?" It counts entries from before the user
 * ever reached the app, so a deep link opened in a tab that had been browsing
 * elsewhere would send `router.back()` straight out of DBar. Instead the
 * departing page leaves a mark and the arriving page consumes it: no mark
 * means the page was reached cold (deep link, fresh PWA launch) and its back
 * control should fall through to a known route rather than walk history.
 */
export const BACK_NAV_KEY = "dbar.internal-nav";

/** Leave the mark. Call immediately before an in-app navigation. */
export function markInternalNavigation(): void {
  try {
    window.sessionStorage.setItem(BACK_NAV_KEY, "1");
  } catch {
    // Storage disabled — the destination falls back, which is the safe side.
  }
}

/**
 * Read and clear the mark: true when this page was reached from inside the
 * app. Clearing is what makes it one-shot — a reload of the destination, or a
 * later cold arrival in the same tab, correctly reads false.
 */
export function consumeInternalNavigation(): boolean {
  try {
    const marked = window.sessionStorage.getItem(BACK_NAV_KEY) === "1";
    window.sessionStorage.removeItem(BACK_NAV_KEY);
    return marked;
  } catch {
    return false;
  }
}
