import { Class } from "@/lib/models/Class";
import { User } from "@/lib/models/User";
import { CLASS_NAME, seedClassDoc } from "@/lib/classSeed";

/**
 * Demo mode: run the whole app locally with NO external database and NO Google
 * login. `db.ts` boots an ephemeral in-memory MongoDB, this module seeds it,
 * and `getServerAuthSession` returns the demo user below. Everything works
 * (including writes and the Marshal); data resets on every restart.
 *
 * Activated with the env var DEMO_MODE=1 (see the `dev:demo` npm script).
 */
export const DEMO_MODE = process.env.DEMO_MODE === "1";

export const DEMO_USER = {
  googleId: "demo-local",
  email: "demo@local.test",
  name: "Demo Deputy",
} as const;

/** Idempotently seed the demo class + user (assigned to it) into whatever DB is connected. */
export async function ensureDemoSeed(): Promise<void> {
  const cls = await Class.findOneAndUpdate(
    { name: CLASS_NAME },
    { $set: seedClassDoc },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  await User.findOneAndUpdate(
    { googleId: DEMO_USER.googleId },
    {
      $set: { classId: cls!._id },
      $setOnInsert: {
        googleId: DEMO_USER.googleId,
        email: DEMO_USER.email,
        name: DEMO_USER.name,
        elective: null,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}
