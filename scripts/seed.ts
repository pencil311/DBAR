import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Class, type IClass } from "@/lib/models/Class";
import { getExpectedDay, isSemesterDay } from "@/lib/schedule";
import { CLASS_NAME, seedClassDoc } from "@/lib/classSeed";

const classDoc: IClass = seedClassDoc;

let assertionsFailed = false;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
  } else {
    assertionsFailed = true;
    console.error(`  ✗ ${message}`);
  }
}

function runAssertions(seeded: IClass) {
  console.log("\nRunning schedule helper assertions:");

  // Normal Monday: 2026-07-06 is a Monday, no holiday, no override.
  const monday = getExpectedDay(seeded, "2026-07-06");
  assert(monday !== null && monday.periods.length === 8, "normal Monday returns 8 periods");

  // Wednesday: 2026-07-08 is a Wednesday. 8 rows, only 7 count for attendance.
  const wednesday = getExpectedDay(seeded, "2026-07-08");
  assert(wednesday !== null && wednesday.periods.length === 8, "Wednesday returns 8 period rows");
  assert(
    wednesday !== null &&
      wednesday.periods.filter((p) => p.countsForAttendance).length === 7,
    "Wednesday has exactly 7 periods that count for attendance"
  );

  // Seeded holiday: 2026-07-31 (St Ignatius of Loyola), a Friday.
  const holiday = getExpectedDay(seeded, "2026-07-31");
  assert(holiday === null, "a seeded holiday returns null");

  // Saturday with no override: 2026-07-04.
  const saturday = getExpectedDay(seeded, "2026-07-04");
  assert(saturday === null, "a Saturday with no override returns null");

  // Saturday WITH an override (in-memory only, not persisted) follows the
  // overridden weekday's timetable row.
  const withOverride: IClass = {
    ...seeded,
    dayOrderOverrides: [
      { date: "2026-07-04", followsWeekday: "WED", note: "Day Order: Wednesday" },
    ],
  };
  const saturdayOverridden = getExpectedDay(withOverride, "2026-07-04");
  assert(
    saturdayOverridden !== null &&
      saturdayOverridden.followedWeekday === "WED" &&
      saturdayOverridden.periods.length === seeded.timetable.WED.length,
    "a Saturday with an override returns that weekday's periods"
  );

  assert(isSemesterDay(seeded, "2026-07-06"), "a date inside the semester range is a semester day");
  assert(!isSemesterDay(seeded, "2026-12-01"), "a date after semesterEnd is not a semester day");
}

async function main() {
  await connectToDatabase();

  const result = await Class.findOneAndUpdate(
    { name: CLASS_NAME },
    { $set: classDoc },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  console.log(`Seeded class "${result.name}"`);
  console.log(`Class _id: ${result._id}`);

  runAssertions(result.toObject());

  await mongoose.disconnect();

  if (assertionsFailed) {
    console.error("\nOne or more assertions failed.");
    process.exit(1);
  }

  console.log("\nAll assertions passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
