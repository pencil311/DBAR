import type { IPeriod } from "@/lib/models/Class";

export interface PeriodGroup {
  periodNos: number[];
  subjectCode: string;
  subjectName: string;
  isElectiveSlot: boolean;
  countsForAttendance: boolean;
  labGroupId: string | null;
}

/**
 * Collapses consecutive periods sharing a labGroupId (e.g. a 3-period lab)
 * into one group, so the UI can render them as a single spanning chip while
 * the underlying data stays per-period.
 */
export function groupPeriods(periods: IPeriod[]): PeriodGroup[] {
  const groups: PeriodGroup[] = [];

  for (const period of periods) {
    const last = groups[groups.length - 1];
    if (period.labGroupId && last?.labGroupId === period.labGroupId) {
      last.periodNos.push(period.periodNo);
      continue;
    }
    groups.push({
      periodNos: [period.periodNo],
      subjectCode: period.subjectCode,
      subjectName: period.subjectName,
      isElectiveSlot: period.isElectiveSlot,
      countsForAttendance: period.countsForAttendance,
      labGroupId: period.labGroupId,
    });
  }

  return groups;
}
