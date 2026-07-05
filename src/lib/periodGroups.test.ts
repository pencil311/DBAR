import { describe, expect, it } from "vitest";
import type { IPeriod } from "@/lib/models/Class";
import { groupPeriods } from "@/lib/periodGroups";

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

describe("groupPeriods", () => {
  it("keeps ungrouped periods as single-period groups", () => {
    const groups = groupPeriods([period(1), period(2), period(3)]);
    expect(groups.map((g) => g.periodNos)).toEqual([[1], [2], [3]]);
  });

  it("merges consecutive periods sharing a labGroupId into one group", () => {
    const groups = groupPeriods([
      period(1),
      period(2, { labGroupId: "LAB-A", subjectCode: "LAB", subjectName: "Lab" }),
      period(3, { labGroupId: "LAB-A", subjectCode: "LAB", subjectName: "Lab" }),
      period(4),
    ]);
    expect(groups.map((g) => g.periodNos)).toEqual([[1], [2, 3], [4]]);
    expect(groups[1]).toMatchObject({ labGroupId: "LAB-A", subjectName: "Lab" });
  });

  it("does not merge periods with different labGroupIds even if adjacent", () => {
    const groups = groupPeriods([period(1, { labGroupId: "A" }), period(2, { labGroupId: "B" })]);
    expect(groups.map((g) => g.periodNos)).toEqual([[1], [2]]);
  });

  it("merges a full 3-period lab block", () => {
    const groups = groupPeriods([
      period(6, { labGroupId: "THU-BDALAB", subjectCode: "AD24521", subjectName: "BDA Lab" }),
      period(7, { labGroupId: "THU-BDALAB", subjectCode: "AD24521", subjectName: "BDA Lab" }),
      period(8, { labGroupId: "THU-BDALAB", subjectCode: "AD24521", subjectName: "BDA Lab" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].periodNos).toEqual([6, 7, 8]);
  });

  it("preserves the non-counting flag for a group (e.g. mentoring)", () => {
    const groups = groupPeriods([period(8, { countsForAttendance: false, subjectCode: "MENTORING" })]);
    expect(groups[0].countsForAttendance).toBe(false);
  });
});
