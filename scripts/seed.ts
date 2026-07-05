import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Class, type IClass, type IPeriod, type Timetable } from "@/lib/models/Class";
import { getExpectedDay, isSemesterDay } from "@/lib/schedule";

const CLASS_NAME = "III Yr AI&DS — Sem 5";

const ELECTIVE_CODE = "PAD2401/PCS2411";
const ELECTIVE_NAME = "AE / FSWD";

function period(
  periodNo: number,
  subjectCode: string,
  subjectName: string,
  opts: Partial<Pick<IPeriod, "isElectiveSlot" | "countsForAttendance" | "labGroupId">> = {}
): IPeriod {
  return {
    periodNo,
    subjectCode,
    subjectName,
    isElectiveSlot: opts.isElectiveSlot ?? false,
    countsForAttendance: opts.countsForAttendance ?? true,
    labGroupId: opts.labGroupId ?? null,
  };
}

const timetable: Timetable = {
  MON: [
    period(1, "GE24501", "PMOM"),
    period(2, "ABSL", "ABSL"),
    period(3, ELECTIVE_CODE, ELECTIVE_NAME, { isElectiveSlot: true, labGroupId: "MON-ELECLAB" }),
    period(4, ELECTIVE_CODE, ELECTIVE_NAME, { isElectiveSlot: true, labGroupId: "MON-ELECLAB" }),
    period(5, "FC24501", "UHVSL"),
    period(6, "AD24412", "DVST"),
    period(7, "CS24512", "CN"),
    period(8, "AD24501", "BDA"),
  ],
  TUE: [
    period(1, "CS24512", "CN"),
    period(2, "AD24501", "BDA"),
    period(3, "AD24502", "NNDL"),
    period(4, "CS24512", "CN Lab", { labGroupId: "TUE-CNLAB" }),
    period(5, "CS24512", "CN Lab", { labGroupId: "TUE-CNLAB" }),
    period(6, "AD24502", "NNDL"),
    period(7, "BS24502", "LRAT"),
    period(8, ELECTIVE_CODE, ELECTIVE_NAME, { isElectiveSlot: true }),
  ],
  WED: [
    period(1, "AD24412", "DVST"),
    period(2, ELECTIVE_CODE, ELECTIVE_NAME, { isElectiveSlot: true }),
    period(3, "ABSL", "ABSL"),
    period(4, "AD24412", "DVST Lab", { labGroupId: "WED-DVSTLAB" }),
    period(5, "AD24412", "DVST Lab", { labGroupId: "WED-DVSTLAB" }),
    period(6, ELECTIVE_CODE, ELECTIVE_NAME, { isElectiveSlot: true }),
    period(7, "AD24502", "NNDL"),
    period(8, "MENTORING", "Mentoring", { countsForAttendance: false }),
  ],
  THU: [
    period(1, "AD24502", "NNDL"),
    period(2, "GE24501", "PMOM"),
    period(3, "AD24501", "BDA"),
    period(4, "AD24412", "DVST"),
    period(5, "CS24512", "CN"),
    period(6, "AD24521", "BDA Lab", { labGroupId: "THU-BDALAB" }),
    period(7, "AD24521", "BDA Lab", { labGroupId: "THU-BDALAB" }),
    period(8, "AD24521", "BDA Lab", { labGroupId: "THU-BDALAB" }),
  ],
  FRI: [
    period(1, "AD24501", "BDA"),
    period(2, "BS24502", "LRAT"),
    period(3, "CS24512", "CN"),
    period(4, "GE24501", "PMOM"),
    period(5, "AD24412", "DVST"),
    period(6, "AD24522", "DL Lab", { labGroupId: "FRI-DLLAB" }),
    period(7, "AD24522", "DL Lab", { labGroupId: "FRI-DLLAB" }),
    period(8, "AD24522", "DL Lab", { labGroupId: "FRI-DLLAB" }),
  ],
};

// Dates below are best-effort from the published 2026 holiday list and need
// confirmation once the college releases its official academic calendar.
// TODO: confirm/correct these once the official calendar is out:
//   - Deepavali is TENTATIVE — the actual date shifts with the lunar calendar.
//   - Double-check Ayutha Pooja / Vijaya Dasami fall on the dates below.
const holidays = [
  { date: "2026-07-31", name: "St Ignatius of Loyola" },
  { date: "2026-08-15", name: "Independence Day" },
  { date: "2026-09-04", name: "Krishna Jayanthi" },
  { date: "2026-09-14", name: "Vinayakar Chathurthi" },
  { date: "2026-10-02", name: "Gandhi Jayanthi" },
  { date: "2026-10-19", name: "Ayutha Pooja" },
  { date: "2026-10-20", name: "Vijaya Dasami" },
  { date: "2026-11-09", name: "Deepavali (TENTATIVE)" },
];

const classDoc: IClass = {
  name: CLASS_NAME,
  timetable,
  holidays,
  dayOrderOverrides: [],
  semesterStart: "2026-07-01",
  semesterEnd: "2026-11-30",
};

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
