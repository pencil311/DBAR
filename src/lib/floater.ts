/**
 * Geometry for the draggable Marshal floater — the iOS AssistiveTouch button
 * that rides along on every authenticated screen.
 *
 * Pure and DOM-free like {@link file://./engine.ts}: the component measures the
 * live viewport and hands the numbers here, so the clamping, edge-snapping and
 * tap-vs-drag rules are unit-testable without a browser.
 */

/** Which screen edge the floater rests against. */
export type FloaterEdge = "left" | "right";

/**
 * The floater's resting place. Only the edge is remembered horizontally — the
 * vertical offset is free, which is what makes it feel like AssistiveTouch
 * rather than a fixed corner button.
 */
export interface FloaterPosition {
  edge: FloaterEdge;
  /** Viewport-space distance from the top of the screen to the button's top, px. */
  y: number;
}

/** What the component measures off the live viewport before asking for bounds. */
export interface ViewportMetrics {
  width: number;
  height: number;
  /** Resolved `env(safe-area-inset-*)` values, px. */
  insetTop: number;
  insetRight: number;
  insetBottom: number;
  insetLeft: number;
  /**
   * Viewport-space top edge of the bottom tab bar, measured from the real
   * element so the floater clears it exactly. Pass `height` when there's no
   * bar on screen.
   */
  tabBarTop: number;
}

/** Diameter of the button, px. */
export const FLOATER_SIZE = 52;

/** Breathing room kept from every boundary, px. */
export const FLOATER_MARGIN = 12;

/**
 * Pointer travel below which a press is a tap, not a drag. Fat fingers wobble
 * a few pixels on the way up; anything under this still opens the chat.
 */
export const DRAG_THRESHOLD = 8;

/** localStorage key — the resting place is per device, not per account. */
export const STORAGE_KEY = "dbar.marshal-floater";

/** The rectangle the button's top-left corner may occupy. */
export interface FloaterBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * The travel rectangle for the current viewport: inside the safe area, below
 * the status-bar strip, and never overlapping the bottom tab bar.
 */
export function computeBounds(m: ViewportMetrics): FloaterBounds {
  const minX = m.insetLeft + FLOATER_MARGIN;
  const minY = m.insetTop + FLOATER_MARGIN;
  // The tab bar is the hard floor; `insetBottom` only matters on screens that
  // don't carry one (or before it has laid out).
  const floor = Math.min(m.tabBarTop, m.height - m.insetBottom);
  return {
    minX,
    minY,
    // Math.max keeps the bounds non-inverted on absurdly small viewports, so
    // clamping still resolves to a real on-screen point.
    maxX: Math.max(minX, m.width - m.insetRight - FLOATER_MARGIN - FLOATER_SIZE),
    maxY: Math.max(minY, floor - FLOATER_MARGIN - FLOATER_SIZE),
  };
}

export function clampX(x: number, b: FloaterBounds): number {
  return Math.min(Math.max(x, b.minX), b.maxX);
}

export function clampY(y: number, b: FloaterBounds): number {
  return Math.min(Math.max(y, b.minY), b.maxY);
}

/** Resting x for an edge. */
export function edgeX(edge: FloaterEdge, b: FloaterBounds): number {
  return edge === "left" ? b.minX : b.maxX;
}

/** The edge a button released at `x` should fly to — whichever is nearer. */
export function nearestEdge(x: number, b: FloaterBounds): FloaterEdge {
  const buttonCenter = x + FLOATER_SIZE / 2;
  const travelCenter = (b.minX + b.maxX + FLOATER_SIZE) / 2;
  return buttonCenter < travelCenter ? "left" : "right";
}

/**
 * Where a released drag comes to rest: snapped horizontally to the nearest
 * edge, left exactly where the user dropped it vertically.
 */
export function snapPosition(x: number, y: number, b: FloaterBounds): FloaterPosition {
  return { edge: nearestEdge(x, b), y: clampY(y, b) };
}

/** First-ever position: right edge, roughly two-thirds down the screen. */
export function defaultPosition(m: ViewportMetrics, b: FloaterBounds): FloaterPosition {
  return { edge: "right", y: clampY(m.height * (2 / 3) - FLOATER_SIZE / 2, b) };
}

/**
 * Re-seat a remembered position inside the current bounds. Called on resize
 * and rotation so a position stored in one orientation can never strand the
 * button off-screen in another.
 */
export function clampPosition(p: FloaterPosition, b: FloaterBounds): FloaterPosition {
  return { edge: p.edge, y: clampY(p.y, b) };
}

/** Parse a persisted position, rejecting anything hand-edited or stale. */
export function parseStoredPosition(raw: string | null): FloaterPosition | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const { edge, y } = parsed as { edge?: unknown; y?: unknown };
  if (edge !== "left" && edge !== "right") return null;
  if (typeof y !== "number" || !Number.isFinite(y)) return null;
  return { edge, y };
}

/** Has the pointer travelled far enough to count as a drag rather than a tap? */
export function isDrag(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= DRAG_THRESHOLD;
}
