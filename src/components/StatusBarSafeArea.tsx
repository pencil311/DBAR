/**
 * iOS renders the standalone status bar translucent over page content
 * (apple-mobile-web-app-status-bar-style: black-translucent), with light
 * status icons. Painting this strip ink-colored behind the safe area keeps
 * the clock/battery legible against the app's light paper theme; `body`'s
 * safe-area padding (globals.css) pushes real content below it.
 */
export function StatusBarSafeArea() {
  return (
    <div
      className="fixed inset-x-0 top-0 z-50 bg-ink"
      style={{ height: "env(safe-area-inset-top)" }}
      aria-hidden="true"
    />
  );
}
