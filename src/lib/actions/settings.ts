"use server";

import { revalidatePath } from "next/cache";
import { getServerAuthSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Class } from "@/lib/models/Class";
import { User } from "@/lib/models/User";
import { isValidDateString } from "@/lib/dates";
import { validateCreateClassPayload, type CreateClassPayload } from "@/lib/classValidation";

const ALLOWED_ELECTIVES = new Set(["AE", "FSWD"]);

export async function setElective(elective: "AE" | "FSWD"): Promise<void> {
  const session = await getServerAuthSession();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  if (!ALLOWED_ELECTIVES.has(elective)) {
    throw new Error("Invalid elective");
  }

  await connectToDatabase();
  await User.findByIdAndUpdate(session.user.id, { $set: { elective } });
  revalidatePath("/settings");
}

export async function addHoliday(classId: string, date: string, name: string): Promise<void> {
  const session = await getServerAuthSession();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  if (session.user.classId !== classId) {
    throw new Error("Not a member of this class");
  }
  if (!isValidDateString(date)) {
    throw new Error("Invalid date");
  }
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Holiday name is required");
  }

  await connectToDatabase();
  const cls = await Class.findById(classId).lean();
  if (!cls) {
    throw new Error("Class not found");
  }
  if (cls.holidays.some((h) => h.date === date)) {
    throw new Error("A holiday is already recorded for that date");
  }

  await Class.updateOne({ _id: classId }, { $push: { holidays: { date, name: trimmedName } } });
  revalidatePath("/settings");
  revalidatePath(`/mark/${date}`);
}

export async function removeHoliday(classId: string, date: string): Promise<void> {
  const session = await getServerAuthSession();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  if (session.user.classId !== classId) {
    throw new Error("Not a member of this class");
  }

  await connectToDatabase();
  await Class.updateOne({ _id: classId }, { $pull: { holidays: { date } } });
  revalidatePath("/settings");
  revalidatePath(`/mark/${date}`);
}

/**
 * Creates a new Class and immediately assigns the creator to it — forging an
 * outfit is how a user joins one, there's no scenario for an orphaned class.
 */
export async function createClass(payload: CreateClassPayload): Promise<{ classId: string }> {
  const session = await getServerAuthSession();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  const validationError = validateCreateClassPayload(payload);
  if (validationError) {
    throw new Error(validationError);
  }

  await connectToDatabase();
  const created = await Class.create({
    name: payload.name.trim(),
    timetable: payload.timetable,
    holidays: [],
    dayOrderOverrides: [],
    semesterStart: payload.semesterStart,
    semesterEnd: payload.semesterEnd,
  });

  await User.findByIdAndUpdate(session.user.id, { $set: { classId: created._id } });

  revalidatePath("/settings");
  return { classId: created._id.toString() };
}
