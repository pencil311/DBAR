/**
 * The only module in the app allowed to construct `Date` objects.
 * Everywhere else, dates flow through the app as "YYYY-MM-DD" strings
 * (which sort and compare correctly as plain strings). Vercel runs its
 * functions in UTC, so any code that reads `new Date()` directly and takes
 * the local calendar date would silently drift across midnight IST — these
 * helpers pin every "what day is it" question to Asia/Kolkata.
 */

const IST_TIME_ZONE = "Asia/Kolkata";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const istDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Formats a moment in time as its IST calendar date, "YYYY-MM-DD". */
export function toISTDateString(date: Date): string {
  return istDateFormatter.format(date);
}

/** The current date in IST, as "YYYY-MM-DD". */
export function todayIST(): string {
  return toISTDateString(new Date());
}

function parseDateString(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

function formatDateParts(utcMs: number): string {
  const d = new Date(utcMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Adds (or subtracts, for negative delta) whole calendar days to a date string. */
export function addDays(date: string, delta: number): string {
  const { y, m, d } = parseDateString(date);
  return formatDateParts(Date.UTC(y, m - 1, d) + delta * MS_PER_DAY);
}

/** Whole number of calendar days from `fromDate` to `toDate` (negative if `toDate` is earlier). */
export function daysBetween(fromDate: string, toDate: string): number {
  const from = parseDateString(fromDate);
  const to = parseDateString(toDate);
  const fromMs = Date.UTC(from.y, from.m - 1, from.d);
  const toMs = Date.UTC(to.y, to.m - 1, to.d);
  return Math.round((toMs - fromMs) / MS_PER_DAY);
}

/** All date strings from `startDate` to `endDate`, inclusive. Empty if start is after end. */
export function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

const DATE_STRING_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True if `date` is a syntactically valid "YYYY-MM-DD" string naming a real calendar date. */
export function isValidDateString(date: string): boolean {
  if (!DATE_STRING_RE.test(date)) return false;
  const { y, m, d } = parseDateString(date);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d;
}

// These two formatters render an already-resolved "YYYY-MM-DD" calendar date
// for display. They deliberately format in UTC (not IST): the string has no
// time component left to be ambiguous about, and formatting in UTC guarantees
// the same Y-M-D comes back out as a label regardless of the viewer's clock.
const displayDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});

const fullWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
});

function toUTCDate(date: string): Date {
  const { y, m, d } = parseDateString(date);
  return new Date(Date.UTC(y, m - 1, d));
}

/** e.g. "2026-07-06" -> "Mon, Jul 6" */
export function formatDisplayDate(date: string): string {
  return displayDateFormatter.format(toUTCDate(date));
}

/** e.g. "2026-07-06" -> "Jul 6" */
export function formatShortDate(date: string): string {
  return shortDateFormatter.format(toUTCDate(date));
}

/** e.g. "2026-07-04" -> "Saturday" — the full weekday name of any calendar date. */
export function fullWeekdayName(date: string): string {
  return fullWeekdayFormatter.format(toUTCDate(date));
}

/** The Monday on or before `date` — an ISO-style (Monday-start) week bucket key. */
export function startOfWeek(date: string): string {
  const jsDay = toUTCDate(date).getUTCDay(); // 0=Sun..6=Sat
  const isoDay = jsDay === 0 ? 7 : jsDay; // 1=Mon..7=Sun
  return addDays(date, -(isoDay - 1));
}
