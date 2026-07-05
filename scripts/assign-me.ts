import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Class } from "@/lib/models/Class";
import { User } from "@/lib/models/User";

const CLASS_NAME = "III Yr AI&DS — Sem 5";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npm run assign-me -- <email>");
    process.exit(1);
  }

  await connectToDatabase();

  const cls = await Class.findOne({ name: CLASS_NAME });
  if (!cls) {
    console.error(`Class "${CLASS_NAME}" not found. Run \`npm run seed\` first.`);
    process.exit(1);
  }

  const user = await User.findOneAndUpdate(
    { email },
    { $set: { classId: cls._id } },
    { returnDocument: "after" }
  );

  if (!user) {
    console.error(`No user found with email "${email}". Sign in once via Google first.`);
    process.exit(1);
  }

  console.log(`Assigned classId ${cls._id} to user ${user.email} (${user.name}).`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
