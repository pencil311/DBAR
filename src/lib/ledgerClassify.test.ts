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

/**
 * LedgerDayRow wraps every row in a <Link> unconditionally now — there is
 * no branch on `kind` left in that component to regress. The meaningful
 * regression surface here is that `classifyDay` keeps returning a correct,
 * well-formed kind for every case the ledger has to render (including
 * "weekend", which used to be the one kind LedgerDayRow special-cased as
 * non-linking) — a wrong or missing kind is the only way a row could ever
 * fail to render/link correctly again.
 */
describe("classifyDay", () => {
  it("classifies a logged working Saturday as normal — links via P/A stats, even with no matching override", () => {
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

  it("classifies a HOLIDAY-typed log as a filed holiday, regardless of schedule state or date", () => {
    const cls = makeClass({ holidays: [{ date: "2026-07-31", name: "St Ignatius" }] });
    const log = dayLog({ date: "2026-07-31", dayType: "HOLIDAY", followedWeekday: "FRI", periods: [] });
    expect(classifyDay(cls, log, "2026-07-31")).toEqual({ kind: "holiday", name: "St Ignatius", filed: true });
  });

  it("classifies a HOLIDAY-typed log filed on a plain weekend (not a declared holiday) as filed with no name", () => {
    const cls = makeClass({ holidays: [] });
    const log = dayLog({ date: "2026-07-04", dayType: "HOLIDAY", followedWeekday: "MON", periods: [] });
    expect(classifyDay(cls, log, "2026-07-04")).toEqual({ kind: "holiday", name: null, filed: true });
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

  it("classifies an untouched weekend as weekend — still a valid, linkable kind", () => {
    const cls = makeClass();
    expect(classifyDay(cls, undefined, "2026-07-04")).toEqual({ kind: "weekend" }); // Saturday
  });

  it("classifies an unfiled declared holiday as an unfiled holiday", () => {
    const cls = makeClass({ holidays: [{ date: "2026-07-31", name: "St Ignatius" }] });
    expect(classifyDay(cls, undefined, "2026-07-31")).toEqual({
      kind: "holiday",
      name: "St Ignatius",
      filed: false,
    });
  });
});
