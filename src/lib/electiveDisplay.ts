import type { IPeriod, Timetable } from "@/lib/models/Class";
import { WEEKDAYS } from "@/lib/weekday";

/**
 * The engine keys both electives under one combined subjectCode
 * ("PAD2401/PCS2411") since that's how attendance is actually tracked. Once a
 * student picks AE or FSWD in Settings, everywhere that slot's name would
 * otherwise show as "AE / FSWD" should show just their choice instead —
 * display-only, the underlying subjectCode never changes.
 */
export function displaySubjectName(
  period: Pick<IPeriod, "subjectName" | "isElectiveSlot">,
  elective: "AE" | "FSWD" | null
): string {
  if (period.isElectiveSlot && elective) {
    return elective;
  }
  return period.subjectName;
}

/** Applies displaySubjectName across every period of every weekday in a timetable. */
export function applyElectiveDisplay(timetable: Timetable, elective: "AE" | "FSWD" | null): Timetable {
  const result = {} as Timetable;
  for (const weekday of WEEKDAYS) {
    result[weekday] = timetable[weekday].map((period) => ({
      ...period,
      subjectName: displaySubjectName(period, elective),
    }));
  }
  return result;
}
