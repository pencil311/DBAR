import type { IPeriod } from "@/lib/models/Class";
import type { PeriodStatus } from "@/lib/models/DayLog";

export interface DayTally {
  present: number;
  absent: number;
}

/**
 * Present/absent counts for a single day, given that day's timetable periods
 * and the logged status for each. Mirrors computeStats' per-day rules
 * (countsForAttendance periods only, OD counts as present, CANCELLED excluded)
 * but scoped to one day for display purposes (e.g. a "Present 6 · Absent 2"
 * summary), not the semester-wide math in engine.ts.
 */
export function tallyDayPeriods(
  periods: IPeriod[],
  loggedPeriods: { periodNo: number; status: PeriodStatus }[]
): DayTally {
  const countableNos = new Set(periods.filter((p) => p.countsForAttendance).map((p) => p.periodNo));
  let present = 0;
  let absent = 0;
  for (const entry of loggedPeriods) {
    if (!countableNos.has(entry.periodNo)) continue;
    if (entry.status === "PRESENT" || entry.status === "OD") present += 1;
    else if (entry.status === "ABSENT") absent += 1;
  }
  return { present, absent };
}

export interface DetailedDayTally {
  present: number;
  absent: number;
  od: number;
  missed: number;
  cancelled: number;
}

/**
 * Like tallyDayPeriods, but keeps PRESENT, OD and MISSED as separate counts
 * (rather than merging them into "present") and also reports CANCELLED — for
 * displays like the Ledger's "P 7 · A 1 · M 2 · OD 1" row that want every
 * status broken out. MISSED is a day-display count only; how it affects the
 * attendance math (overall vs per-subject) lives in engine.ts.
 */
export function tallyDayPeriodsDetailed(
  periods: IPeriod[],
  loggedPeriods: { periodNo: number; status: PeriodStatus }[]
): DetailedDayTally {
  const countableNos = new Set(periods.filter((p) => p.countsForAttendance).map((p) => p.periodNo));
  let present = 0;
  let absent = 0;
  let od = 0;
  let missed = 0;
  let cancelled = 0;
  for (const entry of loggedPeriods) {
    if (!countableNos.has(entry.periodNo)) continue;
    if (entry.status === "PRESENT") present += 1;
    else if (entry.status === "ABSENT") absent += 1;
    else if (entry.status === "OD") od += 1;
    else if (entry.status === "MISSED") missed += 1;
    else if (entry.status === "CANCELLED") cancelled += 1;
  }
  return { present, absent, od, missed, cancelled };
}
