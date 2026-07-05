import { describe, expect, it } from "vitest";
import { groupByWeek } from "@/lib/weekGrouping";

interface Item {
  date: string;
}

describe("groupByWeek", () => {
  it("groups ascending dates within one week into a single bucket", () => {
    const items: Item[] = [{ date: "2026-07-06" }, { date: "2026-07-07" }, { date: "2026-07-08" }];
    const groups = groupByWeek(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].weekStart).toBe("2026-07-06");
    expect(groups[0].items).toEqual(items);
  });

  it("splits dates spanning a week boundary into separate buckets, in order", () => {
    const items: Item[] = [
      { date: "2026-07-03" }, // Fri, week of 2026-06-29
      { date: "2026-07-06" }, // Mon, week of 2026-07-06
      { date: "2026-07-08" }, // Wed, week of 2026-07-06
    ];
    const groups = groupByWeek(items);
    expect(groups.map((g) => g.weekStart)).toEqual(["2026-06-29", "2026-07-06"]);
    expect(groups[0].items).toEqual([{ date: "2026-07-03" }]);
    expect(groups[1].items).toEqual([{ date: "2026-07-06" }, { date: "2026-07-08" }]);
  });

  it("works for reverse-chronological input too", () => {
    const items: Item[] = [
      { date: "2026-07-08" }, // Wed, week of 2026-07-06
      { date: "2026-07-06" }, // Mon, week of 2026-07-06
      { date: "2026-07-03" }, // Fri, week of 2026-06-29
    ];
    const groups = groupByWeek(items);
    expect(groups.map((g) => g.weekStart)).toEqual(["2026-07-06", "2026-06-29"]);
    expect(groups[0].items).toEqual([{ date: "2026-07-08" }, { date: "2026-07-06" }]);
    expect(groups[1].items).toEqual([{ date: "2026-07-03" }]);
  });

  it("returns an empty array for an empty input", () => {
    expect(groupByWeek([])).toEqual([]);
  });
});
