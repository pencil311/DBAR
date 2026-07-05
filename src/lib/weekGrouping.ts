import { startOfWeek } from "@/lib/dates";

export interface WeekGroup<T extends { date: string }> {
  weekStart: string;
  items: T[];
}

/**
 * Buckets a list of dated items into weeks (Monday-start), preserving the
 * input order within and across buckets. Works for either chronological or
 * reverse-chronological input — a calendar week's days are always contiguous
 * in the list either way, so consecutive same-week items stay adjacent.
 */
export function groupByWeek<T extends { date: string }>(items: T[]): WeekGroup<T>[] {
  const groups: WeekGroup<T>[] = [];

  for (const item of items) {
    const weekStart = startOfWeek(item.date);
    const last = groups[groups.length - 1];
    if (last && last.weekStart === weekStart) {
      last.items.push(item);
    } else {
      groups.push({ weekStart, items: [item] });
    }
  }

  return groups;
}
