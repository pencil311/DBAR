import { describe, expect, it } from "vitest";
import type { IClass, IPeriod, Timetable } from "@/lib/models/Class";
import { getExpectedDay, isSemesterDay, resolveMarkDay } from "@/lib/schedule";

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

describe("resolveMarkDay", () => {
  it("a logged followedWeekday wins even with no matching override (the precedence bug)", () => {
    // dayOrderOverrides is deliberately empty here — this is the exact state
    // left behind when another class member reverts their own working day
    // on a shared no-school date: the class-level override disappears, but
    // this user's own DayLog (and its stored followedWeekday) is untouched.
    const cls = makeClass({ dayOrderOverrides: [] });
    const resolved = resolveMarkDay(cls, "2026-07-04", "WED"); // Saturday, logged as WED
    expect(resolved).toEqual({ followedWeekday: "WED", periods: TIMETABLE.WED, isNonSchoolDay: true });
  });

  it("a logged followedWeekday wins over a conflicting override for the same date", () => {
    const cls = makeClass({
      dayOrderOverrides: [{ date: "2026-07-04", followsWeekday: "TUE", note: "someone else's log" }],
    });
    const resolved = resolveMarkDay(cls, "2026-07-04", "WED");
    expect(resolved.followedWeekday).toBe("WED");
    expect(resolved.periods).toBe(TIMETABLE.WED);
  });

  it("falls back to getExpectedDay when there is no log yet", () => {
    const cls = makeClass({
      dayOrderOverrides: [{ date: "2026-07-04", followsWeekday: "TUE", note: "test" }],
    });
    const resolved = resolveMarkDay(cls, "2026-07-04", null);
    expect(resolved).toEqual({ followedWeekday: "TUE", periods: TIMETABLE.TUE, isNonSchoolDay: true });
  });

  it("is a true no-school day when there is no log and no override", () => {
    const cls = makeClass();
    const resolved = resolveMarkDay(cls, "2026-07-04", null); // Saturday
    expect(resolved).toEqual({ followedWeekday: null, periods: [], isNonSchoolDay: true });
  });

  it("does not flag isNonSchoolDay for an ordinary logged weekday", () => {
    const cls = makeClass();
    const resolved = resolveMarkDay(cls, "2026-07-06", "MON"); // Monday, logged normally
    expect(resolved).toEqual({ followedWeekday: "MON", periods: TIMETABLE.MON, isNonSchoolDay: false });
  });

  it("flags isNonSchoolDay for a declared holiday even if logged against its natural weekday", () => {
    const cls = makeClass({ holidays: [{ date: "2026-07-31", name: "St Ignatius" }] }); // a Friday
    const resolved = resolveMarkDay(cls, "2026-07-31", "FRI");
    expect(resolved).toEqual({ followedWeekday: "FRI", periods: TIMETABLE.FRI, isNonSchoolDay: true });
  });
});
