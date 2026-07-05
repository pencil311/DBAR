import { describe, expect, it } from "vitest";
import type { IClass, IPeriod, Timetable } from "@/lib/models/Class";
import type { IDayLog } from "@/lib/models/DayLog";
import { classifyDay } from "@/lib/ledgerClassify";

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
  MON: [period(1), period(2)],
  TUE: [period(1)],
  WED: [period(1, "WED1")],
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

function dayLog(overrides: Partial<IDayLog> = {}): IDayLog {
  return {
    userId: "u1",
    date: "2026-07-04",
    dayType: "NORMAL",
    followedWeekday: "WED",
    periods: [],
    lockedAt: new Date(),
    ...overrides,
  } as IDayLog;
}

describe("classifyDay", () => {
  it("classifies a logged working Saturday as normal even with no matching override", () => {
    // No dayOrderOverrides at all — same "override went missing" state the
    // mark screen has to survive; the ledger reads log.followedWeekday
    // directly and was never vulnerable to this in the first place.
    const cls = makeClass({ dayOrderOverrides: [] });
    const log = dayLog({
      date: "2026-07-04",
      followedWeekday: "WED",
      periods: [{ periodNo: 1, subjectCode: "WED1", status: "PRESENT" }],
    });
    expect(classifyDay(cls, log, "2026-07-04")).toEqual({
      kind: "normal",
      present: 1,
      absent: 0,
      od: 0,
      cancelled: 0,
    });
  });

  it("classifies a HOLIDAY-typed log as holiday regardless of schedule state", () => {
    const cls = makeClass({ holidays: [{ date: "2026-07-31", name: "St Ignatius" }] });
    const log = dayLog({ date: "2026-07-31", dayType: "HOLIDAY", followedWeekday: "FRI", periods: [] });
    expect(classifyDay(cls, log, "2026-07-31")).toEqual({ kind: "holiday", name: "St Ignatius" });
  });

  it("classifies a FULL_ABSENT log regardless of schedule state", () => {
    const cls = makeClass({ dayOrderOverrides: [] });
    const log = dayLog({ date: "2026-07-04", dayType: "FULL_ABSENT", followedWeekday: "WED", periods: [] });
    expect(classifyDay(cls, log, "2026-07-04")).toEqual({ kind: "full_absent" });
  });

  it("classifies an unfiled but expected school day as unfiled", () => {
    const cls = makeClass();
    expect(classifyDay(cls, undefined, "2026-07-06")).toEqual({ kind: "unfiled" }); // Monday
  });

  it("classifies an unfiled true weekend as weekend", () => {
    const cls = makeClass();
    expect(classifyDay(cls, undefined, "2026-07-04")).toEqual({ kind: "weekend" }); // Saturday
  });

  it("classifies an unfiled declared holiday as holiday", () => {
    const cls = makeClass({ holidays: [{ date: "2026-07-31", name: "St Ignatius" }] });
    expect(classifyDay(cls, undefined, "2026-07-31")).toEqual({ kind: "holiday", name: "St Ignatius" });
  });
});
