import { describe, expect, it } from "vitest";
import type { IClass, IPeriod, Timetable } from "@/lib/models/Class";
import { getExpectedDay, isSemesterDay } from "@/lib/schedule";

function period(periodNo: number, subjectCode = `S${periodNo}`): IPeriod {
  return {
    periodNo,
    subjectCode,
    subjectName: subjectCode,
    isElectiveSlot: false,
    countsForAttendance: true,
    labGroupId: null,
  };
}

const TIMETABLE: Timetable = {
  MON: [period(1)],
  TUE: [period(1)],
  WED: [period(1)],
  THU: [period(1)],
  FRI: [period(1)],
};

function makeClass(overrides: Partial<IClass> = {}): IClass {
  return {
    name: "Test Class",
    timetable: TIMETABLE,
    holidays: [],
    dayOrderOverrides: [],
    semesterStart: "2026-07-01",
    semesterEnd: "2026-12-31",
    ...overrides,
  };
}

describe("isSemesterDay", () => {
  it("is true within bounds and false outside", () => {
    const cls = makeClass();
    expect(isSemesterDay(cls, "2026-07-01")).toBe(true);
    expect(isSemesterDay(cls, "2026-12-31")).toBe(true);
    expect(isSemesterDay(cls, "2026-06-30")).toBe(false);
    expect(isSemesterDay(cls, "2027-01-01")).toBe(false);
  });
});

describe("getExpectedDay", () => {
  it("returns the timetable row for a normal weekday", () => {
    const cls = makeClass();
    expect(getExpectedDay(cls, "2026-07-06")).toEqual({ followedWeekday: "MON", periods: TIMETABLE.MON }); // Monday
  });

  it("returns null for a weekend with no override", () => {
    const cls = makeClass();
    expect(getExpectedDay(cls, "2026-07-04")).toBeNull(); // Saturday
  });

  it("returns null for a holiday with no override", () => {
    const cls = makeClass({ holidays: [{ date: "2026-07-31", name: "St Ignatius" }] });
    expect(getExpectedDay(cls, "2026-07-31")).toBeNull(); // Friday
  });

  it("returns null outside the semester regardless of override", () => {
    const cls = makeClass({
      dayOrderOverrides: [{ date: "2027-01-01", followsWeekday: "WED", note: "test" }],
    });
    expect(getExpectedDay(cls, "2027-01-01")).toBeNull();
  });

  it("a day-order override wins on a weekend", () => {
    const cls = makeClass({
      dayOrderOverrides: [{ date: "2026-07-04", followsWeekday: "WED", note: "working Saturday" }],
    });
    expect(getExpectedDay(cls, "2026-07-04")).toEqual({ followedWeekday: "WED", periods: TIMETABLE.WED });
  });

  it("a day-order override wins on an already-declared holiday", () => {
    const cls = makeClass({
      holidays: [{ date: "2026-07-31", name: "St Ignatius" }],
      dayOrderOverrides: [{ date: "2026-07-31", followsWeekday: "MON", note: "un-declared holiday" }],
    });
    expect(getExpectedDay(cls, "2026-07-31")).toEqual({ followedWeekday: "MON", periods: TIMETABLE.MON });
  });
});
