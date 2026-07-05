import { describe, expect, it } from "vitest";
import { shouldRemoveOverride } from "@/lib/revertGuard";

describe("shouldRemoveOverride", () => {
  it("removes the override when no other class member has a filing on the date", () => {
    expect(shouldRemoveOverride(0)).toBe(true);
  });

  it("keeps the override when exactly one other class member has a filing", () => {
    expect(shouldRemoveOverride(1)).toBe(false);
  });

  it("keeps the override when several other class members have filings", () => {
    expect(shouldRemoveOverride(5)).toBe(false);
  });
});
