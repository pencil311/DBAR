"use server";

import { revalidatePath } from "next/cache";
import { getServerAuthSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Class } from "@/lib/models/Class";
import { DayLog, type DayType, type PeriodStatus } from "@/lib/models/DayLog";
import { User } from "@/lib/models/User";
import { getExpectedDay, isSemesterDay } from "@/lib/schedule";
import { isValidDateString } from "@/lib/dates";
import { WEEKDAYS, type Weekday } from "@/lib/weekday";
import { shouldRemoveOverride } from "@/lib/revertGuard";

const ALLOWED_STATUSES: ReadonlySet<PeriodStatus> = new Set<PeriodStatus>([
  "PRESENT",
  "ABSENT",
  "OD",
  "MISSED",
  "CANCELLED",
]);
const ALLOWED_DAY_TYPES: ReadonlySet<DayType> = new Set<DayType>(["NORMAL", "HOLIDAY", "FULL_ABSENT"]);
const ALLOWED_WEEKDAYS: ReadonlySet<Weekday> = new Set<Weekday>(WEEKDAYS);

export interface SaveDayLogPeriodInput {
  periodNo: number;
  status: PeriodStatus;
}

export interface SaveDayLogPayload {
  dayType: DayType;
  periods: SaveDayLogPeriodInput[];
  /**
   * Only needed the first time a weekend/holiday is logged as a working day —
   * says which weekday's timetable ran. Once the resulting dayOrderOverride
   * exists on the class, getExpectedDay resolves it on its own and this is
   * no longer required (harmless to keep sending it; the override write is
   * idempotent).
   */
  overrideWeekday?: Weekday;
}

/**
 * Upserts the signed-in user's DayLog for `date`. Re-derives followedWeekday
 * and each period's subjectCode from the class timetable server-side —
 * the client only gets to say which periodNo has which status.
 */
export async function saveDayLog(date: string, payload: SaveDayLogPayload): Promise<void> {
  const session = await getServerAuthSession();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  if (!isValidDateString(date)) {
    throw new Error("Invalid date");
  }

  if (!ALLOWED_DAY_TYPES.has(payload.dayType)) {
    throw new Error("Invalid day type");
  }

  const classId = session.user.classId;
  if (!classId) {
    throw new Error("No class assigned");
  }

  await connectToDatabase();
  const cls = await Class.findById(classId).lean();
  if (!cls) {
    throw new Error("Class not found");
  }

  if (!isSemesterDay(cls, date)) {
    throw new Error("Date is outside the semester");
  }

  let expected = getExpectedDay(cls, date);

  if (!expected) {
    if (!payload.overrideWeekday || !ALLOWED_WEEKDAYS.has(payload.overrideWeekday)) {
      throw new Error("There is no school on this date");
    }

    const periods = cls.timetable[payload.overrideWeekday];
    if (!periods || periods.length === 0) {
      throw new Error("That weekday has no timetable");
    }

    expected = { followedWeekday: payload.overrideWeekday, periods };

    const hasOverride = cls.dayOrderOverrides.some((o) => o.date === date);
    if (!hasOverride) {
      await Class.updateOne(
        { _id: cls._id },
        {
          $push: {
            dayOrderOverrides: {
              date,
              followsWeekday: payload.overrideWeekday,
              note: "user-logged working day",
            },
          },
        }
      );
    }
  }

  let finalPeriods: { periodNo: number; subjectCode: string; status: PeriodStatus }[] = [];

  if (payload.dayType === "NORMAL") {
    const expectedNos = new Set(expected.periods.map((p) => p.periodNo));
    for (const p of payload.periods) {
      if (!expectedNos.has(p.periodNo)) {
        throw new Error(`Period ${p.periodNo} is not on this day's timetable`);
      }
    }

    const submitted = new Map(payload.periods.map((p) => [p.periodNo, p.status]));
    finalPeriods = expected.periods.map((period) => {
      const status = submitted.get(period.periodNo);
      if (!status || !ALLOWED_STATUSES.has(status)) {
        throw new Error(`Missing or invalid status for period ${period.periodNo}`);
      }
      return { periodNo: period.periodNo, subjectCode: period.subjectCode, status };
    });
  }

  await DayLog.findOneAndUpdate(
    { userId: session.user.id, date },
    {
      $set: {
        userId: session.user.id,
        date,
        dayType: payload.dayType,
        followedWeekday: expected.followedWeekday,
        periods: finalPeriods,
        lockedAt: new Date(),
      },
    },
    { upsert: true }
  );

  revalidatePath(`/mark/${date}`);
}

export interface RevertWorkingDayResult {
  /**
   * False when another class member still has a DayLog on this date — the
   * shared dayOrderOverride was deliberately left in place, and this
   * user's own date is now an unfiled (not no-school) working day.
   */
  overrideRemoved: boolean;
}

/**
 * Undoes a user-logged working day: always deletes this user's own DayLog.
 * The matching dayOrderOverride — shared, class-level state — is only
 * removed if no other class member has a filing on this date; if someone
 * else does, the outfit's calendar still says the day happened, so the
 * override survives and this user's date becomes an unfiled working day
 * instead of reverting all the way to NO_SCHOOL.
 */
export async function revertWorkingDay(date: string): Promise<RevertWorkingDayResult> {
  const session = await getServerAuthSession();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  if (!isValidDateString(date)) {
    throw new Error("Invalid date");
  }

  const classId = session.user.classId;
  if (!classId) {
    throw new Error("No class assigned");
  }

  await connectToDatabase();

  await DayLog.deleteOne({ userId: session.user.id, date });

  const classmateIds = await User.find({ classId }).distinct("_id");
  const otherClassmateIds = classmateIds
    .map((id) => id.toString())
    .filter((id) => id !== session.user.id);
  const otherMemberFilingsCount = await DayLog.countDocuments({
    date,
    userId: { $in: otherClassmateIds },
  });

  const overrideRemoved = shouldRemoveOverride(otherMemberFilingsCount);
  if (overrideRemoved) {
    await Class.updateOne({ _id: classId }, { $pull: { dayOrderOverrides: { date } } });
  }

  revalidatePath(`/mark/${date}`);
  return { overrideRemoved };
}

/**
 * Withdraws the signed-in user's own filing for `date` — deletes the
 * DayLog and nothing else. Deliberately leaves the class's shared
 * dayOrderOverrides untouched: "I want to take back what I filed" is a
 * different action from "this was never a working day" (revertWorkingDay,
 * above) — withdrawing your own filing on a working Saturday shouldn't
 * retroactively un-declare that Saturday as a working day for the rest of
 * the class. The delete is already scoped to this user's own DayLog, so
 * there's no separate ownership check to make.
 */
export async function deleteDayLog(date: string): Promise<void> {
  const session = await getServerAuthSession();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  if (!isValidDateString(date)) {
    throw new Error("Invalid date");
  }

  await connectToDatabase();
  await DayLog.deleteOne({ userId: session.user.id, date });

  revalidatePath(`/mark/${date}`);
}

// ---- Bulk filing from the Ledger -----------------------------------------

/** Statuses the bulk Ledger action accepts — a whole day of one status. */
const BULK_STATUSES: ReadonlySet<BulkDayStatus> = new Set<BulkDayStatus>(["PRESENT", "ABSENT", "OD"]);
const MAX_BULK_DAYS = 10;

export type BulkDayStatus = "PRESENT" | "ABSENT" | "OD";

export interface BulkDayInput {
  date: string;
  status: BulkDayStatus;
}

export interface BulkSaveResult {
  /** Dates that were newly filed. */
  succeeded: string[];
  /** Dates that could not be filed, with a human-readable reason each. */
  failed: { date: string; error: string }[];
}

/**
 * Files a whole day per entry from the Ledger's bulk-select mode: for each
 * eligible date, upserts a NORMAL DayLog whose every countable period is set
 * to the chosen status (MISSED is deliberately not offered here).
 *
 * Everything the client claims is re-checked server-side — this never trusts
 * the client's view of eligibility. A date must still be a school day (or a
 * day already carrying a dayOrderOverride) AND must not already have a filing.
 * The not-already-filed check is enforced atomically with $setOnInsert, so a
 * day another device filed in the meantime fails cleanly instead of being
 * overwritten. Failures are collected per-date and returned, never silent.
 */
export async function bulkSaveDayLogs(days: BulkDayInput[]): Promise<BulkSaveResult> {
  const session = await getServerAuthSession();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  const classId = session.user.classId;
  if (!classId) {
    throw new Error("No class assigned");
  }

  if (days.length > MAX_BULK_DAYS) {
    throw new Error(`Too many days in one batch (max ${MAX_BULK_DAYS}).`);
  }

  await connectToDatabase();
  const cls = await Class.findById(classId).lean();
  if (!cls) {
    throw new Error("Class not found");
  }

  const succeeded: string[] = [];
  const failed: { date: string; error: string }[] = [];
  const seen = new Set<string>();

  for (const day of days) {
    const { date, status } = day;

    if (seen.has(date)) continue; // ignore accidental duplicates in one batch
    seen.add(date);

    if (!isValidDateString(date)) {
      failed.push({ date, error: "Not a valid date." });
      continue;
    }
    if (!BULK_STATUSES.has(status)) {
      failed.push({ date, error: "Not a status you can bulk-file." });
      continue;
    }
    if (!isSemesterDay(cls, date)) {
      failed.push({ date, error: "Outside the semester." });
      continue;
    }

    // Eligible only if a timetable genuinely governs the date (a school day,
    // or a weekend/holiday already overridden to a working day). We never
    // create a new override here — bulk filing only fills days court was
    // already in session for.
    const expected = getExpectedDay(cls, date);
    if (!expected) {
      failed.push({ date, error: "No court in session — open it from the mark screen first." });
      continue;
    }

    const finalPeriods = expected.periods.map((period) => ({
      periodNo: period.periodNo,
      subjectCode: period.subjectCode,
      // Only countable periods carry the chosen status; a not-counted slot is
      // stored PRESENT (it never affects the math either way).
      status: (period.countsForAttendance ? status : "PRESENT") as PeriodStatus,
    }));

    // Atomic "insert only if not already filed": $setOnInsert never touches an
    // existing doc, so a day filed elsewhere since the client loaded fails here.
    const res = await DayLog.updateOne(
      { userId: session.user.id, date },
      {
        $setOnInsert: {
          userId: session.user.id,
          date,
          dayType: "NORMAL",
          followedWeekday: expected.followedWeekday,
          periods: finalPeriods,
          lockedAt: new Date(),
        },
      },
      { upsert: true }
    );

    if (res.upsertedCount && res.upsertedCount > 0) {
      succeeded.push(date);
    } else {
      failed.push({ date, error: "Already filed — edit it from its mark screen." });
    }
  }

  if (succeeded.length > 0) {
    revalidatePath("/ledger");
    revalidatePath("/"); // the poster reads the same stats
    for (const date of succeeded) revalidatePath(`/mark/${date}`);
  }

  return { succeeded, failed };
}
