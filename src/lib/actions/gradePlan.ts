"use server";

import { revalidatePath } from "next/cache";
import { getServerAuthSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { SubjectPlan, type IInternalMarks } from "@/lib/models/SubjectPlan";
import { GRADE_TABLE, type GradeLetter } from "@/lib/grades";

const SELECTABLE_GRADES: ReadonlySet<GradeLetter> = new Set(
  GRADE_TABLE.filter((b) => b.letter !== "RA").map((b) => b.letter)
);

/**
 * Sets the signed-in user's target grade for one subject, upserting their
 * SubjectPlan. Only real, passable grades (O…B) are accepted — you can't aim
 * for RA.
 */
export async function setTargetGrade(subjectCode: string, targetGrade: GradeLetter): Promise<void> {
  const session = await getServerAuthSession();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  if (!subjectCode) {
    throw new Error("Missing subject");
  }
  if (!SELECTABLE_GRADES.has(targetGrade)) {
    throw new Error("Invalid target grade");
  }

  await connectToDatabase();
  await SubjectPlan.findOneAndUpdate(
    { userId: session.user.id, subjectCode },
    { $set: { targetGrade }, $setOnInsert: { userId: session.user.id, subjectCode } },
    { upsert: true }
  );

  revalidatePath("/grades");
}

/**
 * Updates the signed-in user's actual internal marks.
 */
export async function setInternalMarks(subjectCode: string, internals: IInternalMarks[]): Promise<void> {
  const session = await getServerAuthSession();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  if (!subjectCode) {
    throw new Error("Missing subject");
  }

  await connectToDatabase();
  await SubjectPlan.findOneAndUpdate(
    { userId: session.user.id, subjectCode },
    { $set: { internals } }
  );

  revalidatePath("/grades");
}

