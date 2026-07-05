import type { IClass } from "@/lib/models/Class";
import type { IDayLog } from "@/lib/models/DayLog";
import { getExpectedDay } from "@/lib/schedule";
import { tallyDayPeriodsDetailed } from "@/lib/dayTally";

export type LedgerDayKind =
  | { kind: "weekend" }
  | { kind: "holiday"; name: string | null; filed: boolean }
  | { kind: "unfiled" }
  | { kind: "full_absent" }
  | { kind: "normal"; present: number; absent: number; od: number; cancelled: number };

/**
 * A DayLog, once it exists, always wins over schedule/weekend/holiday
 * logic — it reads `log.followedWeekday` directly (the log's own record of
 * what it was filed against), never `getExpectedDay`/the class's shared
 * `dayOrderOverrides`, so a filed day stays correctly classified (and thus
 * linkable/editable) even if that override is later removed by another
 * class member reverting their own working day on the same date.
 *
 * Every kind here is a legitimate link target for the ledger, filed or
 * not — an unfiled weekend/holiday's mark page still offers the "Court in
 * session?" action, so there's always somewhere useful to land.
 */
export function classifyDay(cls: IClass, log: IDayLog | undefined, date: string): LedgerDayKind {
  if (log) {
    if (log.dayType === "HOLIDAY") {
      const holidayName = cls.holidays.find((h) => h.date === date)?.name ?? null;
      return { kind: "holiday", name: holidayName, filed: true };
    }
    if (log.dayType === "FULL_ABSENT") {
      return { kind: "full_absent" };
    }
    const dayPeriods = cls.timetable[log.followedWeekday] ?? [];
    const { present, absent, od, cancelled } = tallyDayPeriodsDetailed(dayPeriods, log.periods);
    return { kind: "normal", present, absent, od, cancelled };
  }

  const expected = getExpectedDay(cls, date);
  if (!expected) {
    const holidayName = cls.holidays.find((h) => h.date === date)?.name ?? null;
    if (holidayName) return { kind: "holiday", name: holidayName, filed: false };
    return { kind: "weekend" };
  }

  return { kind: "unfiled" };
}
