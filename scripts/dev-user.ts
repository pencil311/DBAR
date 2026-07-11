import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Class } from "@/lib/models/Class";
import { User } from "@/lib/models/User";
import { DEV_USER } from "@/lib/auth";

// Local-dev convenience: create (or update) the fixed Dev Login user and assign
// them to the seeded class, so the app is usable the moment you click through.
const CLASS_NAME = "III Yr AI&DS — Sem 5";

async function main() {
  await connectToDatabase();

  const cls = await Class.findOne({ name: CLASS_NAME });
  if (!cls) {
    console.error(`Class "${CLASS_NAME}" not found. Run \`npm run seed\` first.`);
    process.exit(1);
  }

  const user = await User.findOneAndUpdate(
    { googleId: DEV_USER.id },
    {
      $set: { classId: cls._id },
      $setOnInsert: {
        googleId: DEV_USER.id,
        email: DEV_USER.email,
        name: DEV_USER.name,
        elective: null,
        createdAt: new Date(),
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  console.log(`Dev user ${user!.email} ready, assigned to "${cls.name}".`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
