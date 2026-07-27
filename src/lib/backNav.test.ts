import { afterEach, describe, expect, it } from "vitest";
import { BACK_NAV_KEY, consumeInternalNavigation, markInternalNavigation } from "@/lib/backNav";

/** Minimal sessionStorage stand-in — these helpers only get/set/remove. */
function fakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    size: () => store.size,
  };
}

function withWindow(sessionStorage: unknown) {
  (globalThis as { window?: unknown }).window = { sessionStorage };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("markInternalNavigation", () => {
  it("leaves a mark the destination can find", () => {
    const storage = fakeStorage();
    withWindow(storage);
    markInternalNavigation();
    expect(storage.getItem(BACK_NAV_KEY)).toBe("1");
  });

  it("stays quiet when storage is unavailable", () => {
    withWindow({
      getItem: () => null,
      setItem: () => {
        throw new Error("denied"); // Safari private mode
      },
      removeItem: () => {},
    });
    expect(() => markInternalNavigation()).not.toThrow();
  });
});

describe("consumeInternalNavigation", () => {
  it("reports an in-app arrival and clears the mark behind it", () => {
    const storage = fakeStorage();
    withWindow(storage);
    markInternalNavigation();

    expect(consumeInternalNavigation()).toBe(true);
    expect(storage.getItem(BACK_NAV_KEY)).toBeNull();
    // One-shot: a reload of the same page no longer claims history to walk.
    expect(consumeInternalNavigation()).toBe(false);
  });

  it("reports a cold arrival — the deep-link / fresh-launch case", () => {
    withWindow(fakeStorage());
    expect(consumeInternalNavigation()).toBe(false);
  });

  it("ignores a mark left at some other value", () => {
    withWindow(fakeStorage({ [BACK_NAV_KEY]: "yes" }));
    expect(consumeInternalNavigation()).toBe(false);
  });

  it("falls back to a cold arrival when storage throws", () => {
    withWindow({
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {},
      removeItem: () => {},
    });
    expect(consumeInternalNavigation()).toBe(false);
  });
});
