import type { IClass } from "@/lib/models/Class";
import type { IDayLog } from "@/lib/models/DayLog";
import { getExpectedDay } from "@/lib/schedule";
import { addDays, daysBetween, enumerateDates } from "@/lib/dates";

export interface SubjectStat {
  occurred: number;
  attended: number;
  /** Periods marked MISSED — counted as not-attended here (see the table below). */
  missed: number;
  percentage: number;
}

export interface Stats {
  totalOccurred: number;
  totalAttended: number;
  percentage: number;
  perSubject: Record<string, SubjectStat>;
  unmarkedDays: string[];
}

function percentageOf(attended: number, occurred: number): number {
  return occurred === 0 ? 100 : (attended / occurred) * 100;
}

/**
 * The single source of truth for attendance numbers. Pure — takes the class
 * (for its timetable/holidays/calendar) and the user's day logs, returns
 * everything the UI needs to render stats. `percentage` is a raw float;
 * round it only where it's displayed.
 *
 * MISSED means "officially marked present, but I bunked the class", which
 * splits overall attendance from per-subject attendance. Each status maps to
 * an effect on (overall totals, per-subject totals):
 *
 *   PRESENT   → (occurred+1, attended+1) | (occurred+1, attended+1)
 *   OD        → (occurred+1, attended+1) | (occurred+1, attended+1)
 *   MISSED    → (occurred+1, attended+1) | (occurred+1, attended+0, missed+1)
 *   ABSENT    → (occurred+1, attended+0) | (occurred+1, attended+0)
 *   CANCELLED → excluded from both       | excluded from both
 *
 * Overall (the poster, the 80% threshold, bunk budget, honor) is what the
 * college holds on you, so MISSED counts exactly like PRESENT there. Per-
 * subject (the Docket) reflects the classes you actually sat through, so MISSED
 * counts exactly like ABSENT. CANCELLED is the only status excluded from
 * either denominator. The two are computed in SEPARATE passes with SEPARATE
 * accumulators below — they must never share a counter, so that marking a
 * period MISSED can move a subject's number without ever touching the poster.
 */
export function computeStats(cls: IClass, dayLogs: IDayLog[], asOfDate: string): Stats {
  const timetableFor = (log: IDayLog) => cls.timetable[log.followedWeekday] ?? [];
  const inRange = (log: IDayLog) => log.date <= asOfDate && log.dayType !== "HOLIDAY";

  // ---- Pass 1: OVERALL totals (MISSED counts as attended, like PRESENT) ----
  let totalOccurred = 0;
  let totalAttended = 0;
  for (const log of dayLogs) {
    if (!inRange(log)) continue;
    const timetablePeriods = timetableFor(log);

    if (log.dayType === "FULL_ABSENT") {
      for (const p of timetablePeriods) {
        if (!p.countsForAttendance) continue;
        totalOccurred += 1;
      }
      continue;
    }

    const periodMeta = new Map(timetablePeriods.map((p) => [p.periodNo, p]));
    for (const entry of log.periods) {
      if (entry.status === "CANCELLED") continue;
      const meta = periodMeta.get(entry.periodNo);
      if (meta && !meta.countsForAttendance) continue;
      totalOccurred += 1;
      if (entry.status === "PRESENT" || entry.status === "OD" || entry.status === "MISSED") {
        totalAttended += 1;
      }
    }
  }

  // ---- Pass 2: PER-SUBJECT totals (MISSED counts as not-attended, like ABSENT) ----
  const perSubjectAcc: Record<string, { occurred: number; attended: number; missed: number }> = {};
  function addSubject(code: string, attended: boolean, missed: boolean) {
    const entry = perSubjectAcc[code] ?? { occurred: 0, attended: 0, missed: 0 };
    entry.occurred += 1;
    if (attended) entry.attended += 1;
    if (missed) entry.missed += 1;
    perSubjectAcc[code] = entry;
  }
  for (const log of dayLogs) {
    if (!inRange(log)) continue;
    const timetablePeriods = timetableFor(log);

    if (log.dayType === "FULL_ABSENT") {
      for (const p of timetablePeriods) {
        if (!p.countsForAttendance) continue;
        addSubject(p.subjectCode, false, false);
      }
      continue;
    }

    const periodMeta = new Map(timetablePeriods.map((p) => [p.periodNo, p]));
    for (const entry of log.periods) {
      if (entry.status === "CANCELLED") continue;
      const meta = periodMeta.get(entry.periodNo);
      if (meta && !meta.countsForAttendance) continue;
      const attended = entry.status === "PRESENT" || entry.status === "OD";
      const missed = entry.status === "MISSED";
      addSubject(meta?.subjectCode ?? entry.subjectCode, attended, missed);
    }
  }

  const perSubject: Record<string, SubjectStat> = {};
  for (const [code, { occurred, attended, missed }] of Object.entries(perSubjectAcc)) {
    perSubject[code] = { occurred, attended, missed, percentage: percentageOf(attended, occurred) };
  }

  const loggedDates = new Set(dayLogs.map((l) => l.date));
  const unmarkedRangeEnd = asOfDate < cls.semesterEnd ? asOfDate : cls.semesterEnd;
  const unmarkedDays: string[] = [];
  for (const date of enumerateDates(cls.semesterStart, unmarkedRangeEnd)) {
    if (loggedDates.has(date)) continue;
    if (getExpectedDay(cls, date)) unmarkedDays.push(date);
  }

  return {
    totalOccurred,
    totalAttended,
    percentage: percentageOf(totalAttended, totalOccurred),
    perSubject,
    unmarkedDays,
  };
}

/**
 * The OVERALL attendance percentage as it stood after each filed school day,
 * keyed by date — the same number the poster would have shown that evening.
 *
 * Computed in a SINGLE chronological forward pass (O(n)): never call
 * computeStats per row. Follows the same overall rules as computeStats —
 * MISSED counts as attended, CANCELLED is excluded, non-counting periods are
 * excluded, FULL_ABSENT books every countable period as an absence. HOLIDAY
 * logs contribute nothing and get NO entry (their rows show no percentage), so
 * a holiday never moves the number. The value at the last filed day equals
 * computeStats(cls, dayLogs, <that date>).percentage.
 */
export function computeDailyCumulative(cls: IClass, dayLogs: IDayLog[]): Record<string, number> {
  const sorted = [...dayLogs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const byDate: Record<string, number> = {};
  let occurred = 0;
  let attended = 0;

  for (const log of sorted) {
    if (log.dayType === "HOLIDAY") continue; // inert: no counting, no entry

    const timetablePeriods = cls.timetable[log.followedWeekday] ?? [];

    if (log.dayType === "FULL_ABSENT") {
      for (const p of timetablePeriods) {
        if (!p.countsForAttendance) continue;
        occurred += 1;
      }
    } else {
      const periodMeta = new Map(timetablePeriods.map((p) => [p.periodNo, p]));
      for (const entry of log.periods) {
        if (entry.status === "CANCELLED") continue;
        const meta = periodMeta.get(entry.periodNo);
        if (meta && !meta.countsForAttendance) continue;
        occurred += 1;
        if (entry.status === "PRESENT" || entry.status === "OD" || entry.status === "MISSED") {
          attended += 1;
        }
      }
    }

    byDate[log.date] = percentageOf(attended, occurred);
  }

  return byDate;
}

export interface BunkBudget {
  canBunk: number;
  mustAttend: number;
}

/**
 * canBunk: max consecutive future periods markable absent while staying >= target.
 * mustAttend: min consecutive future periods that must be attended to reach >= target.
 */
export function computeBunkBudget(stats: Pick<Stats, "totalOccurred" | "totalAttended">, targetPercentage: number = 80): BunkBudget {
  const { totalOccurred: occurred, totalAttended: attended } = stats;
  const p = targetPercentage / 100;
  
  if (p <= 0) return { canBunk: 9999, mustAttend: 0 };
  if (p >= 1) return { canBunk: 0, mustAttend: occurred > attended ? 9999 : 0 };

  const canBunk = Math.max(0, Math.floor((attended / p) - occurred + 1e-9));
  
  const mustAttendRaw = (p * occurred - attended) / (1 - p);
  const mustAttend = Math.max(0, Math.ceil(mustAttendRaw - 1e-9));

  return { canBunk, mustAttend };
}

export type PosterState = "LAWFUL" | "WANTED" | "DEAD_OR_ALIVE";

export function posterState(percentage: number): PosterState {
  if (percentage >= 85) return "LAWFUL";
  if (percentage >= 80) return "WANTED";
  return "DEAD_OR_ALIVE";
}

/**
 * Honor meter score, 0-100. Starts at 50 and walks the last 30 calendar days
 * of logs chronologically: a fully-present day is +3, a day with any ABSENT
 * period is -5, OD counts as present, and days with no log (holidays,
 * weekends, or simply not logged) are skipped entirely. Clamped to [0, 100].
 * This formula is a first pass and may get tuned later.
 *
 * Honor is an OVERALL (poster-side) signal, so MISSED is treated as present:
 * it is not an ABSENT, so a day containing only PRESENT/OD/MISSED/CANCELLED is
 * a clean day and costs no honor.
 */
export function honorScore(dayLogs: IDayLog[], asOfDate: string): number {
  const windowStart = addDays(asOfDate, -29);
  const window = enumerateDates(windowStart, asOfDate);
  const logsByDate = new Map(dayLogs.map((l) => [l.date, l]));

  let score = 50;
  for (const date of window) {
    const log = logsByDate.get(date);
    if (!log || log.dayType === "HOLIDAY") continue;

    if (log.dayType === "FULL_ABSENT") {
      score -= 5;
      continue;
    }

    const hasAbsence = log.periods.some((p) => p.status === "ABSENT");
    score += hasAbsence ? -5 : 3;
  }

  return Math.max(0, Math.min(100, score));
}

// Attendance Verification dates for Sem 5, hardcoded per the registrar's
// notice. TODO: move these into the Class model once per-semester
// verification dates need to be configurable.
export const VERIFICATION_DATES = ["2026-08-12", "2026-10-14"] as const;

/** Days until the next Attendance Verification date, or null once both have passed. */
export function verificationCountdown(asOfDate: string): number | null {
  const upcoming = VERIFICATION_DATES.filter((d) => d >= asOfDate).sort();
  if (upcoming.length === 0) return null;
  return daysBetween(asOfDate, upcoming[0]);
}
