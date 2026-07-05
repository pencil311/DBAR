"use server";

import { revalidatePath } from "next/cache";
import { getServerAuthSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Class } from "@/lib/models/Class";
import { DayLog, type DayType, type PeriodStatus } from "@/lib/models/DayLog";
import { getExpectedDay, isSemesterDay } from "@/lib/schedule";
import { isValidDateString } from "@/lib/dates";
import { WEEKDAYS, type Weekday } from "@/lib/weekday";

const ALLOWED_STATUSES: ReadonlySet<PeriodStatus> = new Set<PeriodStatus>([
  "PRESENT",
  "ABSENT",
  "OD",
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

/**
 * Undoes a user-logged working day: deletes the DayLog and removes the
 * matching dayOrderOverride from the class, restoring the plain NO_SCHOOL
 * state for this date. The override lives on the shared Class document, so
 * this affects how every student in the class sees this date going forward.
 */
export async function revertWorkingDay(date: string): Promise<void> {
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
  await Class.updateOne({ _id: classId }, { $pull: { dayOrderOverrides: { date } } });

  revalidatePath(`/mark/${date}`);
}
