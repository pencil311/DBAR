import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import type { IClass, IPeriod, Timetable } from "@/lib/models/Class";
import type { IDayLog, IDayLogPeriod, PeriodStatus } from "@/lib/models/DayLog";
import type { Weekday } from "@/lib/weekday";
import { getExpectedDay } from "@/lib/schedule";
import { addDays, daysBetween, enumerateDates } from "@/lib/dates";
import {
  computeBunkBudget,
  computeStats,
  honorScore,
  posterState,
  verificationCountdown,
  type Stats,
} from "@/lib/engine";

// ---- fixtures --------------------------------------------------------

function period(
  periodNo: number,
  subjectCode: string,
  opts: Partial<Pick<IPeriod, "countsForAttendance" | "isElectiveSlot" | "labGroupId">> = {}
): IPeriod {
  return {
    periodNo,
    subjectCode,
    subjectName: subjectCode,
    isElectiveSlot: opts.isElectiveSlot ?? false,
    countsForAttendance: opts.countsForAttendance ?? true,
    labGroupId: opts.labGroupId ?? null,
  };
}

// A small synthetic timetable: 3 periods/day, Wednesday's 3rd period is a
// non-counting "MENTOR" slot (standing in for the real Wed P8 Mentoring rule).
const TEST_TIMETABLE: Timetable = {
  MON: [period(1, "M1"), period(2, "M2"), period(3, "M3")],
  TUE: [period(1, "T1"), period(2, "T2"), period(3, "T3")],
  WED: [period(1, "W1"), period(2, "W2"), period(3, "MENTOR", { countsForAttendance: false })],
  THU: [period(1, "H1"), period(2, "H2"), period(3, "H3")],
  FRI: [period(1, "F1"), period(2, "F2"), period(3, "F3")],
};

function makeClass(overrides: Partial<IClass> = {}): IClass {
  return {
    name: "Test Class",
    timetable: TEST_TIMETABLE,
    holidays: [],
    dayOrderOverrides: [],
    semesterStart: "2026-07-06",
    semesterEnd: "2026-12-31",
    ...overrides,
  };
}

function dayLog(overrides: Partial<IDayLog> & { date: string; followedWeekday: Weekday }): IDayLog {
  return {
    userId: new Types.ObjectId(),
    dayType: "NORMAL",
    periods: [],
    lockedAt: null,
    ...overrides,
  };
}

function p(periodNo: number, subjectCode: string, status: PeriodStatus): IDayLogPeriod {
  return { periodNo, subjectCode, status };
}

// ---- computeStats ------------------------------------------------------

describe("computeStats", () => {
  it("returns 100% with zero occurred when there are no logs", () => {
    const cls = makeClass();
    const stats = computeStats(cls, [], "2026-07-01"); // before semesterStart: nothing expected yet
    expect(stats.totalOccurred).toBe(0);
    expect(stats.totalAttended).toBe(0);
    expect(stats.percentage).toBe(100);
    expect(stats.perSubject).toEqual({});
    expect(stats.unmarkedDays).toEqual([]);
  });

  it("tallies a normal fully-present week, excluding the non-counting Wednesday slot", () => {
    const cls = makeClass();
    const logs: IDayLog[] = [
      dayLog({
        date: "2026-07-06",
        followedWeekday: "MON",
        periods: [p(1, "M1", "PRESENT"), p(2, "M2", "PRESENT"), p(3, "M3", "PRESENT")],
      }),
      dayLog({
        date: "2026-07-08",
        followedWeekday: "WED",
        periods: [p(1, "W1", "PRESENT"), p(2, "W2", "PRESENT"), p(3, "MENTOR", "PRESENT")],
      }),
    ];
    const stats = computeStats(cls, logs, "2026-07-08");
    // Monday: 3 counted. Wednesday: 2 counted (MENTOR excluded even though logged PRESENT).
    expect(stats.totalOccurred).toBe(5);
    expect(stats.totalAttended).toBe(5);
    expect(stats.percentage).toBe(100);
  });

  it("never counts the Wednesday mentoring slot, in totals or perSubject", () => {
    const cls = makeClass();
    const logs: IDayLog[] = [
      dayLog({
        date: "2026-07-08",
        followedWeekday: "WED",
        periods: [p(1, "W1", "PRESENT"), p(2, "W2", "ABSENT"), p(3, "MENTOR", "ABSENT")],
      }),
    ];
    const stats = computeStats(cls, logs, "2026-07-08");
    expect(stats.totalOccurred).toBe(2); // W1 + W2 only
    expect(stats.perSubject.MENTOR).toBeUndefined();
  });

  it("contributes nothing for a HOLIDAY day, even if periods are present on the log", () => {
    const cls = makeClass({ holidays: [{ date: "2026-07-08", name: "Test Holiday" }] });
    const logs: IDayLog[] = [
      dayLog({
        date: "2026-07-08",
        followedWeekday: "WED",
        dayType: "HOLIDAY",
        periods: [p(1, "W1", "PRESENT")],
      }),
    ];
    const stats = computeStats(cls, logs, "2026-07-08");
    expect(stats.totalOccurred).toBe(0);
    expect(stats.totalAttended).toBe(0);
    expect(stats.percentage).toBe(100);
  });

  it("excludes CANCELLED periods from both occurred and attended", () => {
    const cls = makeClass();
    const logs: IDayLog[] = [
      dayLog({
        date: "2026-07-06",
        followedWeekday: "MON",
        periods: [p(1, "M1", "PRESENT"), p(2, "M2", "CANCELLED"), p(3, "M3", "ABSENT")],
      }),
    ];
    const stats = computeStats(cls, logs, "2026-07-06");
    expect(stats.totalOccurred).toBe(2); // M2 excluded entirely
    expect(stats.totalAttended).toBe(1);
    expect(stats.perSubject.M2).toBeUndefined();
  });

  it("counts every countable period of a FULL_ABSENT day as an absence", () => {
    const cls = makeClass();
    const logs: IDayLog[] = [
      dayLog({ date: "2026-07-09", followedWeekday: "THU", dayType: "FULL_ABSENT", periods: [] }),
    ];
    const stats = computeStats(cls, logs, "2026-07-09");
    expect(stats.totalOccurred).toBe(3); // H1, H2, H3
    expect(stats.totalAttended).toBe(0);
    expect(stats.perSubject.H1).toEqual({ occurred: 1, attended: 0, percentage: 0 });
  });

  it("a FULL_ABSENT Wednesday still excludes the non-counting mentoring slot", () => {
    const cls = makeClass();
    const logs: IDayLog[] = [
      dayLog({ date: "2026-07-08", followedWeekday: "WED", dayType: "FULL_ABSENT", periods: [] }),
    ];
    const stats = computeStats(cls, logs, "2026-07-08");
    expect(stats.totalOccurred).toBe(2); // W1 + W2, not MENTOR
    expect(stats.perSubject.MENTOR).toBeUndefined();
  });

  it("counts OD as attended", () => {
    const cls = makeClass();
    const logs: IDayLog[] = [
      dayLog({
        date: "2026-07-06",
        followedWeekday: "MON",
        periods: [p(1, "M1", "OD"), p(2, "M2", "ABSENT"), p(3, "M3", "PRESENT")],
      }),
    ];
    const stats = computeStats(cls, logs, "2026-07-06");
    expect(stats.totalOccurred).toBe(3);
    expect(stats.totalAttended).toBe(2); // OD + PRESENT
    expect(stats.perSubject.M1.attended).toBe(1);
  });

  it("lists unmarked semester weekdays, respecting holidays and weekends", () => {
    const cls = makeClass({
      semesterStart: "2026-07-06",
      semesterEnd: "2026-07-17",
      holidays: [{ date: "2026-07-15", name: "Test Holiday" }],
    });
    // Expected semester days in range: 06,07,08,09,10 (wk1), 13,14,16,17 (wk2, 15 is holiday).
    // Log only 06, 07, 09 — everything else should be "unmarked".
    const logs: IDayLog[] = [
      dayLog({ date: "2026-07-06", followedWeekday: "MON", periods: [p(1, "M1", "PRESENT")] }),
      dayLog({ date: "2026-07-07", followedWeekday: "TUE", periods: [p(1, "T1", "PRESENT")] }),
      dayLog({ date: "2026-07-09", followedWeekday: "THU", periods: [p(1, "H1", "PRESENT")] }),
    ];
    const stats = computeStats(cls, logs, "2026-07-17");
    expect(stats.unmarkedDays).toEqual([
      "2026-07-08",
      "2026-07-10",
      "2026-07-13",
      "2026-07-14",
      "2026-07-16",
      "2026-07-17",
    ]);
  });

  it("counts a user-logged working Saturday (day-order override) toward occurred/attended", () => {
    // 2026-07-11 is a Saturday, logged as running Wednesday's timetable.
    const cls = makeClass({
      dayOrderOverrides: [{ date: "2026-07-11", followsWeekday: "WED", note: "user-logged working day" }],
    });
    const logs: IDayLog[] = [
      dayLog({
        date: "2026-07-11",
        followedWeekday: "WED",
        periods: [p(1, "W1", "PRESENT"), p(2, "W2", "ABSENT"), p(3, "MENTOR", "PRESENT")],
      }),
    ];
    const stats = computeStats(cls, logs, "2026-07-11");
    expect(stats.totalOccurred).toBe(2); // W1 + W2 — MENTOR still excluded even on an overridden Saturday
    expect(stats.totalAttended).toBe(1);
  });

  it("removing a working day's log and override together returns stats to baseline", () => {
    const withOverride = makeClass({
      dayOrderOverrides: [{ date: "2026-07-11", followsWeekday: "WED", note: "user-logged working day" }],
    });
    const logs: IDayLog[] = [
      dayLog({
        date: "2026-07-11",
        followedWeekday: "WED",
        periods: [p(1, "W1", "PRESENT"), p(2, "W2", "PRESENT"), p(3, "MENTOR", "PRESENT")],
      }),
    ];
    expect(computeStats(withOverride, logs, "2026-07-11").totalOccurred).toBe(2);

    // Reverting deletes the DayLog and the class's dayOrderOverride together.
    const reverted = makeClass();
    const revertedStats = computeStats(reverted, [], "2026-07-11");
    expect(revertedStats.totalOccurred).toBe(0);
    expect(revertedStats.percentage).toBe(100);
  });

  it("unmarkedDays never lists an untouched weekend or holiday", () => {
    const cls = makeClass({ semesterStart: "2026-07-06", semesterEnd: "2026-07-12" });
    const stats = computeStats(cls, [], "2026-07-12"); // range covers both weekend days
    expect(stats.unmarkedDays).toEqual(["2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10"]);
  });

  it("unmarkedDays flags an overridden working day until it's logged (edge case: override without a log)", () => {
    const cls = makeClass({
      semesterStart: "2026-07-06",
      semesterEnd: "2026-07-12",
      dayOrderOverrides: [{ date: "2026-07-11", followsWeekday: "WED", note: "user-logged working day" }],
    });

    // In normal use the override and the log are created in the same action,
    // so this state shouldn't arise — but if it did, the day should still
    // read as "should have a log."
    const statsNoLog = computeStats(cls, [], "2026-07-11");
    expect(statsNoLog.unmarkedDays).toContain("2026-07-11");

    const logs: IDayLog[] = [
      dayLog({
        date: "2026-07-11",
        followedWeekday: "WED",
        periods: [p(1, "W1", "PRESENT"), p(2, "W2", "PRESENT"), p(3, "MENTOR", "PRESENT")],
      }),
    ];
    const statsLogged = computeStats(cls, logs, "2026-07-11");
    expect(statsLogged.unmarkedDays).not.toContain("2026-07-11");
  });
});

// ---- computeBunkBudget ---------------------------------------------------

describe("computeBunkBudget", () => {
  function pctOf(attended: number, occurred: number): number {
    return occurred === 0 ? 100 : (attended / occurred) * 100;
  }

  function bruteCanBunk(occurred: number, attended: number): number {
    let k = 0;
    while (pctOf(attended, occurred + k + 1) >= 80) k++;
    return k;
  }

  function bruteMustAttend(occurred: number, attended: number): number {
    let occ = occurred;
    let att = attended;
    let steps = 0;
    while (pctOf(att, occ) < 80) {
      occ++;
      att++;
      steps++;
      if (steps > 1_000_000) throw new Error("runaway brute-force loop");
    }
    return steps;
  }

  it("matches a brute-force simulation across randomized scenarios", () => {
    for (let i = 0; i < 20; i++) {
      const occurred = 1 + Math.floor(Math.random() * 300);
      const attended = Math.floor(Math.random() * (occurred + 1));
      const stats: Pick<Stats, "totalOccurred" | "totalAttended"> = {
        totalOccurred: occurred,
        totalAttended: attended,
      };

      const { canBunk, mustAttend } = computeBunkBudget(stats);

      expect(canBunk, `canBunk mismatch for occurred=${occurred} attended=${attended}`).toBe(
        bruteCanBunk(occurred, attended)
      );
      expect(mustAttend, `mustAttend mismatch for occurred=${occurred} attended=${attended}`).toBe(
        bruteMustAttend(occurred, attended)
      );
    }
  });

  it("is exactly zero on both sides at precisely 80.0%", () => {
    const { canBunk, mustAttend } = computeBunkBudget({ totalOccurred: 100, totalAttended: 80 });
    expect(canBunk).toBe(0);
    expect(mustAttend).toBe(0);
  });

  it("is exactly zero on both sides at 80.0% with small numbers", () => {
    const { canBunk, mustAttend } = computeBunkBudget({ totalOccurred: 5, totalAttended: 4 });
    expect(canBunk).toBe(0);
    expect(mustAttend).toBe(0);
  });

  it("has no bunk budget or catch-up needed with zero occurred periods", () => {
    const { canBunk, mustAttend } = computeBunkBudget({ totalOccurred: 0, totalAttended: 0 });
    expect(canBunk).toBe(0);
    expect(mustAttend).toBe(0);
  });
});

// ---- posterState ---------------------------------------------------------

describe("posterState", () => {
  it("is LAWFUL at exactly 85", () => {
    expect(posterState(85)).toBe("LAWFUL");
  });

  it("is WANTED just under 85", () => {
    expect(posterState(84.99)).toBe("WANTED");
  });

  it("is WANTED at exactly 80", () => {
    expect(posterState(80)).toBe("WANTED");
  });

  it("is DEAD_OR_ALIVE just under 80", () => {
    expect(posterState(79.99)).toBe("DEAD_OR_ALIVE");
  });
});

// ---- honorScore ------------------------------------------------------

describe("honorScore", () => {
  // A wide-open class (semester spans all of 2026) purely so getExpectedDay
  // can tell us which of the last 30 calendar days are weekdays, without
  // this test file constructing any Date objects itself.
  const wideOpenClass = makeClass({ semesterStart: "2026-01-01", semesterEnd: "2026-12-31" });

  function weekdaysInWindow(endDate: string, days: number): { date: string; weekday: Weekday }[] {
    const start = addDays(endDate, -(days - 1));
    return enumerateDates(start, endDate).flatMap((date) => {
      const expected = getExpectedDay(wideOpenClass, date);
      return expected ? [{ date, weekday: expected.followedWeekday }] : [];
    });
  }

  it("climbs above the 50 baseline, and clamps at 100, for an all-present month", () => {
    const asOf = "2026-07-31";
    const logs = weekdaysInWindow(asOf, 30).map(({ date, weekday }) =>
      dayLog({ date, followedWeekday: weekday, periods: [p(1, "M1", "PRESENT")] })
    );
    const score = honorScore(logs, asOf);
    expect(score).toBe(100); // ~21 weekdays * +3 from a base of 50 saturates the clamp
  });

  it("falls below the 50 baseline, and clamps at 0, for an absence-heavy month", () => {
    const asOf = "2026-07-31";
    const logs = weekdaysInWindow(asOf, 30).map(({ date, weekday }) =>
      dayLog({ date, followedWeekday: weekday, dayType: "FULL_ABSENT", periods: [] })
    );
    const score = honorScore(logs, asOf);
    expect(score).toBe(0); // ~21 weekdays * -5 from a base of 50 saturates the clamp
  });

  it("treats OD as present and ignores holidays and unlogged days", () => {
    const asOf = "2026-07-10";
    const logs: IDayLog[] = [
      dayLog({ date: "2026-07-06", followedWeekday: "MON", periods: [p(1, "M1", "OD")] }), // +3
      dayLog({ date: "2026-07-07", followedWeekday: "TUE", dayType: "HOLIDAY", periods: [] }), // skipped
      dayLog({
        date: "2026-07-08",
        followedWeekday: "WED",
        periods: [p(1, "W1", "PRESENT"), p(2, "W2", "ABSENT")],
      }), // -5
      // 2026-07-09 has no log at all: skipped
    ];
    expect(honorScore(logs, asOf)).toBe(50 + 3 - 5);
  });
});

// ---- verificationCountdown -----------------------------------------------

describe("verificationCountdown", () => {
  it("counts down to the first upcoming verification date", () => {
    expect(verificationCountdown("2026-07-24")).toBe(19); // -> 2026-08-12
  });

  it("is zero on the verification date itself", () => {
    expect(verificationCountdown("2026-08-12")).toBe(0);
  });

  it("counts down to the second date once the first has passed", () => {
    expect(verificationCountdown("2026-08-13")).toBe(daysBetween("2026-08-13", "2026-10-14"));
  });

  it("is null once both verification dates have passed", () => {
    expect(verificationCountdown("2026-11-01")).toBeNull();
  });
});

// ---- worked example ------------------------------------------------------

describe("worked example: 3 weeks of realistic logs", () => {
  it("produces the hand-computed stats, budget, and poster state", () => {
    const cls = makeClass({
      semesterStart: "2026-07-06",
      semesterEnd: "2026-12-31",
      holidays: [{ date: "2026-07-15", name: "Test Holiday" }],
    });

    const logs: IDayLog[] = [
      // Week 1 (2026-07-06 .. 2026-07-10): clean, fully present, one cancelled period.
      dayLog({
        date: "2026-07-06",
        followedWeekday: "MON",
        periods: [p(1, "M1", "PRESENT"), p(2, "M2", "PRESENT"), p(3, "M3", "PRESENT")],
      }),
      dayLog({
        date: "2026-07-07",
        followedWeekday: "TUE",
        periods: [p(1, "T1", "PRESENT"), p(2, "T2", "PRESENT"), p(3, "T3", "PRESENT")],
      }),
      dayLog({
        date: "2026-07-08",
        followedWeekday: "WED",
        periods: [p(1, "W1", "PRESENT"), p(2, "W2", "PRESENT"), p(3, "MENTOR", "PRESENT")],
      }),
      dayLog({
        date: "2026-07-09",
        followedWeekday: "THU",
        periods: [p(1, "H1", "PRESENT"), p(2, "H2", "PRESENT"), p(3, "H3", "PRESENT")],
      }),
      dayLog({
        date: "2026-07-10",
        followedWeekday: "FRI",
        periods: [p(1, "F1", "PRESENT"), p(2, "F2", "CANCELLED"), p(3, "F3", "PRESENT")],
      }),

      // Week 2 (2026-07-13 .. 2026-07-17): an absence, an OD, a holiday, a full-absent day.
      dayLog({
        date: "2026-07-13",
        followedWeekday: "MON",
        periods: [p(1, "M1", "PRESENT"), p(2, "M2", "ABSENT"), p(3, "M3", "OD")],
      }),
      dayLog({
        date: "2026-07-14",
        followedWeekday: "TUE",
        periods: [p(1, "T1", "PRESENT"), p(2, "T2", "PRESENT"), p(3, "T3", "PRESENT")],
      }),
      dayLog({
        date: "2026-07-15",
        followedWeekday: "WED",
        dayType: "HOLIDAY",
        periods: [],
      }),
      dayLog({ date: "2026-07-16", followedWeekday: "THU", dayType: "FULL_ABSENT", periods: [] }),
      dayLog({
        date: "2026-07-17",
        followedWeekday: "FRI",
        periods: [p(1, "F1", "PRESENT"), p(2, "F2", "PRESENT"), p(3, "F3", "PRESENT")],
      }),

      // Week 3 (2026-07-20 .. 2026-07-24): two more absences.
      dayLog({
        date: "2026-07-20",
        followedWeekday: "MON",
        periods: [p(1, "M1", "PRESENT"), p(2, "M2", "PRESENT"), p(3, "M3", "PRESENT")],
      }),
      dayLog({
        date: "2026-07-21",
        followedWeekday: "TUE",
        periods: [p(1, "T1", "PRESENT"), p(2, "T2", "ABSENT"), p(3, "T3", "PRESENT")],
      }),
      dayLog({
        date: "2026-07-22",
        followedWeekday: "WED",
        periods: [p(1, "W1", "PRESENT"), p(2, "W2", "ABSENT"), p(3, "MENTOR", "PRESENT")],
      }),
      dayLog({
        date: "2026-07-23",
        followedWeekday: "THU",
        periods: [p(1, "H1", "PRESENT"), p(2, "H2", "PRESENT"), p(3, "H3", "PRESENT")],
      }),
      dayLog({
        date: "2026-07-24",
        followedWeekday: "FRI",
        periods: [p(1, "F1", "PRESENT"), p(2, "F2", "PRESENT"), p(3, "F3", "PRESENT")],
      }),
    ];

    const asOfDate = "2026-07-24";
    const stats = computeStats(cls, logs, asOfDate);
    const budget = computeBunkBudget(stats);
    const poster = posterState(stats.percentage);
    const honor = honorScore(logs, asOfDate);
    const countdown = verificationCountdown(asOfDate);

    // eslint-disable-next-line no-console
    console.log(`
Worked example — 3 weeks ending ${asOfDate}
  occurred:    ${stats.totalOccurred}
  attended:    ${stats.totalAttended}
  percentage:  ${stats.percentage.toFixed(2)}%
  poster:      ${poster}
  canBunk:     ${budget.canBunk}
  mustAttend:  ${budget.mustAttend}
  honorScore:  ${honor}
  verification countdown: ${countdown} day(s)
  unmarkedDays: ${stats.unmarkedDays.length === 0 ? "(none)" : stats.unmarkedDays.join(", ")}
`);

    expect(stats.totalOccurred).toBe(39);
    expect(stats.totalAttended).toBe(33);
    expect(stats.percentage).toBeCloseTo((33 / 39) * 100, 10);
    expect(stats.unmarkedDays).toEqual([]);
    expect(poster).toBe("WANTED");
    expect(budget).toEqual({ canBunk: 2, mustAttend: 0 });
    expect(honor).toBe(60);
    expect(countdown).toBe(19);
  });
});
