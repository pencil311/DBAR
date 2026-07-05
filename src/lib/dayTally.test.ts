import { describe, expect, it } from "vitest";
import type { IPeriod } from "@/lib/models/Class";
import { tallyDayPeriods, tallyDayPeriodsDetailed } from "@/lib/dayTally";

function period(periodNo: number, overrides: Partial<IPeriod> = {}): IPeriod {
  return {
    periodNo,
    subjectCode: overrides.subjectCode ?? `S${periodNo}`,
    subjectName: overrides.subjectName ?? `Subject ${periodNo}`,
    isElectiveSlot: overrides.isElectiveSlot ?? false,
    countsForAttendance: overrides.countsForAttendance ?? true,
    labGroupId: overrides.labGroupId ?? null,
  };
}

const PERIODS: IPeriod[] = [
  period(1),
  period(2),
  period(3),
  period(4, { countsForAttendance: false }), // e.g. Mentoring
];

describe("tallyDayPeriods", () => {
  it("merges OD into present and excludes non-counting periods", () => {
    const logged = [
      { periodNo: 1, status: "PRESENT" as const },
      { periodNo: 2, status: "OD" as const },
      { periodNo: 3, status: "ABSENT" as const },
      { periodNo: 4, status: "PRESENT" as const }, // non-counting, excluded
    ];
    expect(tallyDayPeriods(PERIODS, logged)).toEqual({ present: 2, absent: 1 });
  });

  it("ignores CANCELLED periods entirely", () => {
    const logged = [
      { periodNo: 1, status: "PRESENT" as const },
      { periodNo: 2, status: "CANCELLED" as const },
    ];
    expect(tallyDayPeriods(PERIODS, logged)).toEqual({ present: 1, absent: 0 });
  });
});

describe("tallyDayPeriodsDetailed", () => {
  it("keeps PRESENT, ABSENT, OD, and CANCELLED as separate counts", () => {
    const logged = [
      { periodNo: 1, status: "PRESENT" as const },
      { periodNo: 2, status: "OD" as const },
      { periodNo: 3, status: "CANCELLED" as const },
    ];
    expect(tallyDayPeriodsDetailed(PERIODS, logged)).toEqual({
      present: 1,
      absent: 0,
      od: 1,
      cancelled: 1,
    });
  });

  it("excludes non-counting periods regardless of status", () => {
    const logged = [{ periodNo: 4, status: "ABSENT" as const }];
    expect(tallyDayPeriodsDetailed(PERIODS, logged)).toEqual({
      present: 0,
      absent: 0,
      od: 0,
      cancelled: 0,
    });
  });

  it("returns all zeros for an empty log", () => {
    expect(tallyDayPeriodsDetailed(PERIODS, [])).toEqual({
      present: 0,
      absent: 0,
      od: 0,
      cancelled: 0,
    });
  });
});
