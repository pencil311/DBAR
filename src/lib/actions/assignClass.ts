"use server";

import { getServerAuthSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Class } from "@/lib/models/Class";
import { User } from "@/lib/models/User";

export async function assignClassToUser(classId: string) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  await connectToDatabase();

  const exists = await Class.exists({ _id: classId });
  if (!exists) {
    throw new Error("Class not found");
  }

  await User.findByIdAndUpdate(session.user.id, { $set: { classId } });
}
