import { isValidDateString } from "@/lib/dates";
import { WEEKDAYS, type Weekday } from "@/lib/weekday";

export interface CreatePeriodInput {
  periodNo: number;
  subjectCode: string;
  subjectName: string;
  isElectiveSlot: boolean;
  countsForAttendance: boolean;
  labGroupId: string | null;
}

export interface CreateClassPayload {
  name: string;
  semesterStart: string;
  semesterEnd: string;
  timetable: Record<Weekday, CreatePeriodInput[]>;
}

const EXPECTED_PERIOD_NOS = [1, 2, 3, 4, 5, 6, 7, 8];

/** True if every labGroupId in `periods` is shared only by a contiguous run of periodNos. */
export function validateLabGroupsConsecutive(periods: CreatePeriodInput[]): boolean {
  const groups = new Map<string, number[]>();
  for (const p of periods) {
    if (!p.labGroupId) continue;
    const arr = groups.get(p.labGroupId) ?? [];
    arr.push(p.periodNo);
    groups.set(p.labGroupId, arr);
  }
  for (const nos of Array.from(groups.values())) {
    const sorted = [...nos].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) return false;
    }
  }
  return true;
}

/**
 * Pure validation for a new class's timetable payload: 5 weekdays present,
 * 8 periods each numbered 1-8, non-empty codes/names, lab groups only over
 * consecutive periods. Returns an error message, or null if the payload is
 * ready to persist. Kept out of the "use server" actions file so it can be
 * unit-tested without a DB or auth session.
 */
export function validateCreateClassPayload(payload: CreateClassPayload): string | null {
  if (!payload.name.trim()) {
    return "Class name is required";
  }

  if (!isValidDateString(payload.semesterStart) || !isValidDateString(payload.semesterEnd)) {
    return "Invalid semester dates";
  }
  if (payload.semesterStart > payload.semesterEnd) {
    return "Semester start must be on or before semester end";
  }

  for (const weekday of WEEKDAYS) {
    const periods = payload.timetable[weekday];
    if (!periods || periods.length !== 8) {
      return `${weekday} must have exactly 8 periods`;
    }

    const sortedNos = periods.map((p) => p.periodNo).sort((a, b) => a - b);
    if (JSON.stringify(sortedNos) !== JSON.stringify(EXPECTED_PERIOD_NOS)) {
      return `${weekday} periods must be numbered 1 through 8`;
    }

    for (const p of periods) {
      if (!p.subjectCode.trim() || !p.subjectName.trim()) {
        return `${weekday} period ${p.periodNo} needs a subject code and name`;
      }
    }

    if (!validateLabGroupsConsecutive(periods)) {
      return `${weekday} has a lab group spanning non-consecutive periods`;
    }
  }

  return null;
}
