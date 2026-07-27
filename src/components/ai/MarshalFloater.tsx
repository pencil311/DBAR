"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { StarBadge } from "@/components/poster/StarBadge";
import { markInternalNavigation } from "@/lib/backNav";
import { cn } from "@/lib/cn";
import {
  FLOATER_SIZE,
  STORAGE_KEY,
  clampPosition,
  clampX,
  clampY,
  computeBounds,
  defaultPosition,
  edgeX,
  isDrag,
  parseStoredPosition,
  snapPosition,
  type FloaterBounds,
  type FloaterPosition,
  type ViewportMetrics,
} from "@/lib/floater";

/** What a pointer press remembers about where the drag began. */
interface DragOrigin {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  /** Flips once travel clears the tap threshold — from then on it's a drag. */
  moved: boolean;
}

/**
 * `env(safe-area-inset-*)` is only readable through a rendered element — a
 * custom property hands back the unresolved `env()` token instead of pixels.
 * A throwaway probe gets us the real numbers.
 */
function readInsets() {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
    "padding:env(safe-area-inset-top) env(safe-area-inset-right) " +
    "env(safe-area-inset-bottom) env(safe-area-inset-left);";
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const insets = {
    top: parseFloat(style.paddingTop) || 0,
    right: parseFloat(style.paddingRight) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
  };
  probe.remove();
  return insets;
}

function measureViewport(): ViewportMetrics {
  const insets = readInsets();
  const height = window.innerHeight;
  // Measured off the live bar rather than assumed, so the floater clears it
  // exactly however the bar's height changes.
  const tabBar = document.querySelector<HTMLElement>("[data-tab-bar]");
  return {
    width: window.innerWidth,
    height,
    insetTop: insets.top,
    insetRight: insets.right,
    insetBottom: insets.bottom,
    insetLeft: insets.left,
    tabBarTop: tabBar?.getBoundingClientRect().top ?? height,
  };
}

function readStoredPosition(): FloaterPosition | null {
  try {
    return parseStoredPosition(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null; // private mode / storage disabled — fall back to the default
  }
}

/**
 * The Marshal's badge, riding along on every authenticated screen like iOS's
 * AssistiveTouch: drag it anywhere, let go and it flies to the nearest edge,
 * tap it to go ask him something. Mounted once in the (app) layout so it
 * survives navigation; hidden on /ask itself, where you're already talking.
 */
export function MarshalFloater() {
  const router = useRouter();
  const pathname = usePathname();

  const [bounds, setBounds] = useState<FloaterBounds | null>(null);
  const [position, setPosition] = useState<FloaterPosition | null>(null);
  /** Live top-left while a drag is in flight; null whenever it's at rest. */
  const [live, setLive] = useState<{ x: number; y: number } | null>(null);
  const [snapping, setSnapping] = useState(false);

  const dragRef = useRef<DragOrigin | null>(null);
  /** A real drag must never open the chat — swallows the click that follows. */
  const suppressClickRef = useRef(false);

  // Measure on mount and whenever the viewport changes, re-seating a
  // remembered position so a rotation can never strand the button off-screen.
  useEffect(() => {
    function remeasure() {
      const metrics = measureViewport();
      const next = computeBounds(metrics);
      setBounds(next);
      setPosition((current) =>
        clampPosition(current ?? readStoredPosition() ?? defaultPosition(metrics, next), next)
      );
    }

    remeasure();
    window.addEventListener("resize", remeasure);
    window.addEventListener("orientationchange", remeasure);
    return () => {
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("orientationchange", remeasure);
    };
  }, []);

  useEffect(() => {
    if (!position) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    } catch {
      // Nothing to do if storage is unavailable; the floater still works.
    }
  }, [position]);

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (!position || !bounds || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: edgeX(position.edge, bounds),
      originY: position.y,
      moved: false,
    };
    setSnapping(false);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !bounds) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved) {
      if (!isDrag(dx, dy)) return; // still within tap distance
      drag.moved = true;
    }
    setLive({ x: clampX(drag.originX + dx, bounds), y: clampY(drag.originY + dy, bounds) });
  }

  function handlePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setLive(null);
    if (!drag.moved || !bounds) return; // a tap — let the click through

    suppressClickRef.current = true;
    setPosition(
      snapPosition(
        clampX(drag.originX + (event.clientX - drag.startX), bounds),
        clampY(drag.originY + (event.clientY - drag.startY), bounds),
        bounds
      )
    );
    setSnapping(true);
  }

  function handlePointerCancel(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    // Cancelled mid-drag: abandon the move and settle back where it started.
    dragRef.current = null;
    setLive(null);
    if (drag.moved) suppressClickRef.current = true;
  }

  function handleClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    // Tells /ask's back control there's a page of ours to return to.
    markInternalNavigation();
    router.push("/ask");
  }

  // Nothing to draw until the viewport has been measured, and nothing worth
  // drawing on the page it opens.
  if (!position || !bounds || pathname === "/ask") return null;

  const x = live ? live.x : edgeX(position.edge, bounds);
  const y = live ? live.y : position.y;

  return (
    <button
      type="button"
      aria-label="Ask the Marshal"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
      onTransitionEnd={() => setSnapping(false)}
      // touch-action keeps a drag from scrolling the page under it.
      style={{ left: x, top: y, width: FLOATER_SIZE, height: FLOATER_SIZE, touchAction: "none" }}
      className={cn(
        "no-callout fixed z-40 flex items-center justify-center rounded-full",
        "border-2 border-brass bg-ink",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        "focus-visible:outline-brass",
        live
          ? "opacity-100"
          : "opacity-[0.85] transition-opacity hover:opacity-100 focus-visible:opacity-100",
        snapping && !live && "floater-snap"
      )}
    >
      <StarBadge size={26} className="fill-paper stroke-paper" />
    </button>
  );
}
