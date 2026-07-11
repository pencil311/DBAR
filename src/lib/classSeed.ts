import type { IClass, IPeriod, Timetable } from "@/lib/models/Class";

/**
 * The single seeded class definition, shared by the seed script and by demo
 * mode so they never drift. Pure data — no DB access here.
 */
export const CLASS_NAME = "III Yr AI&DS — Sem 5";

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

export const seedTimetable: Timetable = {
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

export const seedHolidays = [
  { date: "2026-07-31", name: "St Ignatius of Loyola" },
  { date: "2026-08-15", name: "Independence Day" },
  { date: "2026-09-04", name: "Krishna Jayanthi" },
  { date: "2026-09-14", name: "Vinayakar Chathurthi" },
  { date: "2026-10-02", name: "Gandhi Jayanthi" },
  { date: "2026-10-19", name: "Ayutha Pooja" },
  { date: "2026-10-20", name: "Vijaya Dasami" },
  { date: "2026-11-09", name: "Deepavali (TENTATIVE)" },
];

export const seedClassDoc: IClass = {
  name: CLASS_NAME,
  timetable: seedTimetable,
  holidays: seedHolidays,
  dayOrderOverrides: [],
  semesterStart: "2026-07-01",
  semesterEnd: "2026-11-30",
};
