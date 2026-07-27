import { describe, expect, it } from "vitest";
import {
  DRAG_THRESHOLD,
  FLOATER_MARGIN,
  FLOATER_SIZE,
  clampPosition,
  clampX,
  clampY,
  computeBounds,
  defaultPosition,
  edgeX,
  isDrag,
  nearestEdge,
  parseStoredPosition,
  snapPosition,
  type ViewportMetrics,
} from "@/lib/floater";

/** A 380x800 phone with no insets and a 44px tab bar pinned to the bottom. */
function phone(overrides: Partial<ViewportMetrics> = {}): ViewportMetrics {
  return {
    width: 380,
    height: 800,
    insetTop: 0,
    insetRight: 0,
    insetBottom: 0,
    insetLeft: 0,
    tabBarTop: 800 - 44,
    ...overrides,
  };
}

describe("computeBounds", () => {
  it("keeps the button a margin inside every edge", () => {
    const b = computeBounds(phone());
    expect(b.minX).toBe(FLOATER_MARGIN); // 12
    expect(b.maxX).toBe(380 - FLOATER_MARGIN - FLOATER_SIZE); // 316
    expect(b.minY).toBe(FLOATER_MARGIN); // 12
  });

  it("never lets the button overlap the tab bar", () => {
    const b = computeBounds(phone());
    // Bottom of the button at its lowest = maxY + size, which must clear the bar.
    expect(b.maxY + FLOATER_SIZE).toBeLessThanOrEqual(800 - 44);
    expect(b.maxY).toBe(800 - 44 - FLOATER_MARGIN - FLOATER_SIZE); // 692
  });

  it("respects safe-area insets on a notched device", () => {
    const b = computeBounds(phone({ insetTop: 59, insetLeft: 44, insetRight: 44 }));
    expect(b.minY).toBe(59 + FLOATER_MARGIN); // below the status-bar strip
    expect(b.minX).toBe(44 + FLOATER_MARGIN);
    expect(b.maxX).toBe(380 - 44 - FLOATER_MARGIN - FLOATER_SIZE);
  });

  it("falls back to the bottom inset when there is no tab bar to measure", () => {
    const b = computeBounds(phone({ tabBarTop: 800, insetBottom: 34 }));
    expect(b.maxY).toBe(800 - 34 - FLOATER_MARGIN - FLOATER_SIZE);
  });

  it("stays non-inverted on a viewport too small to hold the button", () => {
    const b = computeBounds(phone({ width: 40, height: 60, tabBarTop: 60 }));
    expect(b.maxX).toBeGreaterThanOrEqual(b.minX);
    expect(b.maxY).toBeGreaterThanOrEqual(b.minY);
    // Clamping still resolves to a real point rather than NaN or a negative.
    expect(clampX(999, b)).toBe(b.minX);
    expect(clampY(999, b)).toBe(b.minY);
  });
});

describe("clampX / clampY", () => {
  it("pulls out-of-bounds coordinates back inside", () => {
    const b = computeBounds(phone());
    expect(clampX(-500, b)).toBe(b.minX);
    expect(clampX(9999, b)).toBe(b.maxX);
    expect(clampY(-500, b)).toBe(b.minY);
    expect(clampY(9999, b)).toBe(b.maxY);
  });

  it("leaves in-bounds coordinates alone", () => {
    const b = computeBounds(phone());
    expect(clampX(150, b)).toBe(150);
    expect(clampY(400, b)).toBe(400);
  });
});

describe("nearestEdge", () => {
  it("snaps to whichever edge the button's centre is closer to", () => {
    const b = computeBounds(phone()); // travel 12..316, centres 38..342
    expect(nearestEdge(b.minX, b)).toBe("left");
    expect(nearestEdge(b.maxX, b)).toBe("right");
    expect(nearestEdge(20, b)).toBe("left");
    expect(nearestEdge(300, b)).toBe("right");
  });

  it("sends the exact midpoint to the right edge", () => {
    const b = computeBounds(phone());
    const midpointX = (b.minX + b.maxX) / 2; // button centre lands on travel centre
    expect(nearestEdge(midpointX, b)).toBe("right");
    expect(nearestEdge(midpointX - 1, b)).toBe("left");
  });

  it("measures from the button's centre, not its left corner", () => {
    const b = computeBounds(phone());
    // Left corner is left of centre-screen, but the button's middle is not.
    const cornerLeftOfCentre = 380 / 2 - FLOATER_SIZE / 2 + 5;
    expect(cornerLeftOfCentre).toBeLessThan(380 / 2);
    expect(nearestEdge(cornerLeftOfCentre, b)).toBe("right");
  });
});

describe("edgeX", () => {
  it("resolves an edge to its resting x", () => {
    const b = computeBounds(phone());
    expect(edgeX("left", b)).toBe(b.minX);
    expect(edgeX("right", b)).toBe(b.maxX);
  });
});

describe("snapPosition", () => {
  it("snaps horizontally but keeps the vertical drop point", () => {
    const b = computeBounds(phone());
    expect(snapPosition(200, 350, b)).toEqual({ edge: "right", y: 350 });
    expect(snapPosition(30, 350, b)).toEqual({ edge: "left", y: 350 });
  });

  it("clamps a drop below the tab bar back above it", () => {
    const b = computeBounds(phone());
    expect(snapPosition(30, 795, b)).toEqual({ edge: "left", y: b.maxY });
  });
});

describe("defaultPosition", () => {
  it("starts on the right edge, about two-thirds down, above the tab bar", () => {
    const m = phone();
    const b = computeBounds(m);
    const p = defaultPosition(m, b);
    expect(p.edge).toBe("right");
    expect(p.y).toBeCloseTo(800 * (2 / 3) - FLOATER_SIZE / 2, 5); // ~507
    expect(p.y + FLOATER_SIZE).toBeLessThan(m.tabBarTop);
  });

  it("is clamped into bounds on a short viewport", () => {
    const m = phone({ height: 260, tabBarTop: 260 - 44 });
    const b = computeBounds(m);
    const p = defaultPosition(m, b);
    expect(p.y).toBeLessThanOrEqual(b.maxY);
    expect(p.y).toBeGreaterThanOrEqual(b.minY);
  });
});

describe("clampPosition", () => {
  it("keeps the edge and re-seats y after a rotation", () => {
    const portrait = phone();
    const landscape = phone({ width: 800, height: 380, tabBarTop: 380 - 44 });
    const stored = snapPosition(30, 690, computeBounds(portrait)); // near the bottom in portrait
    const reseated = clampPosition(stored, computeBounds(landscape));
    expect(reseated.edge).toBe("left");
    expect(reseated.y).toBe(computeBounds(landscape).maxY); // pulled back on screen
    expect(reseated.y + FLOATER_SIZE).toBeLessThanOrEqual(landscape.tabBarTop);
  });

  it("leaves a position that still fits untouched", () => {
    const b = computeBounds(phone());
    expect(clampPosition({ edge: "right", y: 300 }, b)).toEqual({ edge: "right", y: 300 });
  });
});

describe("parseStoredPosition", () => {
  it("round-trips a stored position", () => {
    expect(parseStoredPosition(JSON.stringify({ edge: "left", y: 240 }))).toEqual({
      edge: "left",
      y: 240,
    });
  });

  it("rejects missing, malformed and nonsense values", () => {
    expect(parseStoredPosition(null)).toBeNull();
    expect(parseStoredPosition("")).toBeNull();
    expect(parseStoredPosition("not json")).toBeNull();
    expect(parseStoredPosition('"a string"')).toBeNull();
    expect(parseStoredPosition("null")).toBeNull();
    expect(parseStoredPosition(JSON.stringify({ edge: "top", y: 10 }))).toBeNull();
    expect(parseStoredPosition(JSON.stringify({ edge: "left" }))).toBeNull();
    expect(parseStoredPosition(JSON.stringify({ edge: "left", y: "240" }))).toBeNull();
    expect(parseStoredPosition(JSON.stringify({ edge: "left", y: NaN }))).toBeNull(); // JSON → null
    expect(parseStoredPosition(JSON.stringify({ edge: "left", y: Infinity }))).toBeNull();
  });
});

describe("isDrag", () => {
  it("treats small wobble as a tap", () => {
    expect(isDrag(0, 0)).toBe(false);
    expect(isDrag(3, 3)).toBe(false);
    expect(isDrag(DRAG_THRESHOLD - 1, 0)).toBe(false);
  });

  it("treats real travel as a drag, in any direction", () => {
    expect(isDrag(DRAG_THRESHOLD, 0)).toBe(true);
    expect(isDrag(0, -DRAG_THRESHOLD)).toBe(true);
    expect(isDrag(-40, 60)).toBe(true);
  });
});
