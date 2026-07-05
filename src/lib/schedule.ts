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

function naturalWeekdayFor(date: string): Weekday | null {
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
