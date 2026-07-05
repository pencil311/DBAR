import type { IClass, IPeriod } from "@/lib/models/Class";
import { WEEKDAYS, type Weekday } from "@/lib/weekday";

export interface ExpectedDay {
  followedWeekday: Weekday;
  periods: IPeriod[];
}

const NATURAL_WEEKDAY_BY_JS_DAY: Record<number, Weekday | null> = {
  0: null, // Sunday
  1: WEEKDAYS[0], // Monday
  2: WEEKDAYS[1], // Tuesday
  3: WEEKDAYS[2], // Wednesday
  4: WEEKDAYS[3], // Thursday
  5: WEEKDAYS[4], // Friday
  6: null, // Saturday
};

export function naturalWeekdayFor(date: string): Weekday | null {
  const parsed = new Date(`${date}T00:00:00Z`);
  return NATURAL_WEEKDAY_BY_JS_DAY[parsed.getUTCDay()] ?? null;
}

export function isSemesterDay(cls: IClass, date: string): boolean {
  return date >= cls.semesterStart && date <= cls.semesterEnd;
}

export function getExpectedDay(cls: IClass, date: string): ExpectedDay | null {
  if (!isSemesterDay(cls, date)) {
    return null;
  }

  // A day-order override is an explicit "school ran this day" signal — it
  // takes precedence over both the holiday list and the natural weekend,
  // e.g. a working Saturday, or a holiday the college un-declares mid-semester.
  const override = cls.dayOrderOverrides.find((o) => o.date === date);
  const followedWeekday = override ? override.followsWeekday : naturalWeekdayFor(date);

  if (!override) {
    const isHoliday = cls.holidays.some((h) => h.date === date);
    if (isHoliday) {
      return null;
    }
  }

  if (!followedWeekday) {
    return null;
  }

  const periods = cls.timetable[followedWeekday];
  if (!periods || periods.length === 0) {
    return null;
  }

  return { followedWeekday, periods };
}

export interface ResolvedMarkDay {
  followedWeekday: Weekday | null;
  periods: IPeriod[];
  isNonSchoolDay: boolean;
}

/**
 * Resolves which weekday's timetable governs `date` for the mark screen,
 * giving an existing DayLog's own stored `followedWeekday` absolute
 * priority over `cls.dayOrderOverrides` — the override list is a
 * class-wide, shared, mutable resource (any member logging or reverting a
 * working day edits it), so a specific log's own record of what it was
 * filed against must never be reconstructed from it. Without a log, falls
 * back to `getExpectedDay` (override/holiday-aware) exactly as before,
 * since there's nothing more authoritative to consult yet.
 *
 * `isNonSchoolDay` is true whenever this date wouldn't naturally have
 * school (a weekend, or a declared holiday) — independent of any override
 * — and is what the mark screen uses to decide whether to show the
 * "Working X — running Y timetable" banner.
 */
export function resolveMarkDay(
  cls: IClass,
  date: string,
  loggedFollowedWeekday: Weekday | null
): ResolvedMarkDay {
  const naturalWeekday = naturalWeekdayFor(date);
  const isHoliday = cls.holidays.some((h) => h.date === date);
  const isNonSchoolDay = naturalWeekday === null || isHoliday;

  const followedWeekday = loggedFollowedWeekday ?? getExpectedDay(cls, date)?.followedWeekday ?? null;
  const periods = followedWeekday ? (cls.timetable[followedWeekday] ?? []) : [];

  return { followedWeekday, periods, isNonSchoolDay };
}
