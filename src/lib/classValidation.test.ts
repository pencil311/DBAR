import { describe, expect, it } from "vitest";
import { WEEKDAYS } from "@/lib/weekday";
import {
  validateCreateClassPayload,
  validateLabGroupsConsecutive,
  type CreateClassPayload,
  type CreatePeriodInput,
} from "@/lib/classValidation";

function period(periodNo: number, overrides: Partial<CreatePeriodInput> = {}): CreatePeriodInput {
  return {
    periodNo,
    subjectCode: overrides.subjectCode ?? `S${periodNo}`,
    subjectName: overrides.subjectName ?? `Subject ${periodNo}`,
    isElectiveSlot: overrides.isElectiveSlot ?? false,
    countsForAttendance: overrides.countsForAttendance ?? true,
    labGroupId: overrides.labGroupId ?? null,
  };
}

function eightPeriods(overrides: (i: number) => Partial<CreatePeriodInput> = () => ({})): CreatePeriodInput[] {
  return Array.from({ length: 8 }, (_, i) => period(i + 1, overrides(i + 1)));
}

function validPayload(overrides: Partial<CreateClassPayload> = {}): CreateClassPayload {
  const timetable = {} as CreateClassPayload["timetable"];
  for (const weekday of WEEKDAYS) {
    timetable[weekday] = eightPeriods();
  }
  return {
    name: "Test Class",
    semesterStart: "2026-07-01",
    semesterEnd: "2026-11-30",
    timetable,
    ...overrides,
  };
}

describe("validateLabGroupsConsecutive", () => {
  it("accepts periods with no lab groups", () => {
    expect(validateLabGroupsConsecutive(eightPeriods())).toBe(true);
  });

  it("accepts a lab group spanning consecutive periods", () => {
    const periods = eightPeriods((i) => (i >= 6 ? { labGroupId: "LAB-A" } : {}));
    expect(validateLabGroupsConsecutive(periods)).toBe(true);
  });

  it("rejects a lab group spanning non-consecutive periods", () => {
    const periods = eightPeriods((i) => (i === 2 || i === 5 ? { labGroupId: "LAB-A" } : {}));
    expect(validateLabGroupsConsecutive(periods)).toBe(false);
  });
});

describe("validateCreateClassPayload", () => {
  it("accepts a well-formed payload", () => {
    expect(validateCreateClassPayload(validPayload())).toBeNull();
  });

  it("rejects an empty class name", () => {
    expect(validateCreateClassPayload(validPayload({ name: "  " }))).toMatch(/name/i);
  });

  it("rejects invalid semester dates", () => {
    expect(validateCreateClassPayload(validPayload({ semesterStart: "not-a-date" }))).toMatch(/semester/i);
  });

  it("rejects semesterStart after semesterEnd", () => {
    expect(
      validateCreateClassPayload(validPayload({ semesterStart: "2026-12-01", semesterEnd: "2026-11-30" }))
    ).toMatch(/before/i);
  });

  it("rejects a missing weekday", () => {
    const payload = validPayload();
    delete (payload.timetable as Partial<CreateClassPayload["timetable"]>).WED;
    expect(validateCreateClassPayload(payload)).toMatch(/WED/);
  });

  it("rejects a weekday with fewer than 8 periods", () => {
    const payload = validPayload();
    payload.timetable.MON = eightPeriods().slice(0, 7);
    expect(validateCreateClassPayload(payload)).toMatch(/MON/);
  });

  it("rejects periods not numbered 1 through 8", () => {
    const payload = validPayload();
    payload.timetable.TUE = eightPeriods().map((p, i) => ({ ...p, periodNo: i === 0 ? 9 : p.periodNo }));
    expect(validateCreateClassPayload(payload)).toMatch(/numbered 1 through 8/);
  });

  it("rejects an empty subject code", () => {
    const payload = validPayload();
    payload.timetable.THU = eightPeriods((i) => (i === 3 ? { subjectCode: "  " } : {}));
    expect(validateCreateClassPayload(payload)).toMatch(/THU period 3/);
  });

  it("rejects an empty subject name", () => {
    const payload = validPayload();
    payload.timetable.FRI = eightPeriods((i) => (i === 5 ? { subjectName: "" } : {}));
    expect(validateCreateClassPayload(payload)).toMatch(/FRI period 5/);
  });

  it("rejects a lab group spanning non-consecutive periods", () => {
    const payload = validPayload();
    payload.timetable.MON = eightPeriods((i) => (i === 1 || i === 4 ? { labGroupId: "LAB-X" } : {}));
    expect(validateCreateClassPayload(payload)).toMatch(/non-consecutive/);
  });

  it("accepts a payload with a valid multi-period lab group", () => {
    const payload = validPayload();
    payload.timetable.THU = eightPeriods((i) => (i >= 6 ? { labGroupId: "THU-LAB1" } : {}));
    expect(validateCreateClassPayload(payload)).toBeNull();
  });
});
