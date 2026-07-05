import { describe, expect, it } from "vitest";
import type { IPeriod, Timetable } from "@/lib/models/Class";
import { applyElectiveDisplay, displaySubjectName } from "@/lib/electiveDisplay";

function period(overrides: Partial<IPeriod> = {}): IPeriod {
  return {
    periodNo: 1,
    subjectCode: overrides.subjectCode ?? "S1",
    subjectName: overrides.subjectName ?? "Subject",
    isElectiveSlot: overrides.isElectiveSlot ?? false,
    countsForAttendance: overrides.countsForAttendance ?? true,
    labGroupId: overrides.labGroupId ?? null,
  };
}

describe("displaySubjectName", () => {
  it("shows the combined name when the slot is not elective", () => {
    const p = period({ subjectName: "CN", isElectiveSlot: false });
    expect(displaySubjectName(p, "AE")).toBe("CN");
  });

  it("shows the combined name when the elective is unset", () => {
    const p = period({ subjectName: "AE / FSWD", isElectiveSlot: true });
    expect(displaySubjectName(p, null)).toBe("AE / FSWD");
  });

  it("shows the chosen elective's own name when set", () => {
    const p = period({ subjectName: "AE / FSWD", isElectiveSlot: true });
    expect(displaySubjectName(p, "AE")).toBe("AE");
    expect(displaySubjectName(p, "FSWD")).toBe("FSWD");
  });
});

describe("applyElectiveDisplay", () => {
  it("overrides elective slot names across every weekday, leaving others untouched", () => {
    const timetable: Timetable = {
      MON: [period({ subjectName: "PMOM" }), period({ subjectName: "AE / FSWD", isElectiveSlot: true })],
      TUE: [period({ subjectName: "AE / FSWD", isElectiveSlot: true })],
      WED: [period({ subjectName: "DVST" })],
      THU: [period({ subjectName: "NNDL" })],
      FRI: [period({ subjectName: "BDA" })],
    };

    const result = applyElectiveDisplay(timetable, "FSWD");

    expect(result.MON[0].subjectName).toBe("PMOM");
    expect(result.MON[1].subjectName).toBe("FSWD");
    expect(result.TUE[0].subjectName).toBe("FSWD");
    expect(result.WED[0].subjectName).toBe("DVST");
  });
});
