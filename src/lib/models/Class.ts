import { Schema, model, models, type Model } from "mongoose";
import { WEEKDAYS, type Weekday } from "@/lib/weekday";

export interface IPeriod {
  periodNo: number;
  subjectCode: string;
  subjectName: string;
  isElectiveSlot: boolean;
  countsForAttendance: boolean;
  labGroupId: string | null;
}

export interface IHoliday {
  date: string;
  name: string;
}

export interface IDayOrderOverride {
  date: string;
  followsWeekday: Weekday;
  note: string;
}

export type Timetable = Record<Weekday, IPeriod[]>;

export interface IClass {
  name: string;
  timetable: Timetable;
  holidays: IHoliday[];
  dayOrderOverrides: IDayOrderOverride[];
  semesterStart: string;
  semesterEnd: string;
}

const PeriodSchema = new Schema<IPeriod>(
  {
    periodNo: { type: Number, required: true, min: 1, max: 8 },
    subjectCode: { type: String, required: true },
    subjectName: { type: String, required: true },
    isElectiveSlot: { type: Boolean, default: false },
    countsForAttendance: { type: Boolean, default: true },
    labGroupId: { type: String, default: null },
  },
  { _id: false }
);

const HolidaySchema = new Schema<IHoliday>(
  {
    date: { type: String, required: true },
    name: { type: String, required: true },
  },
  { _id: false }
);

const DayOrderOverrideSchema = new Schema<IDayOrderOverride>(
  {
    date: { type: String, required: true },
    followsWeekday: { type: String, enum: WEEKDAYS, required: true },
    note: { type: String, required: true },
  },
  { _id: false }
);

const TimetableSchema = new Schema<Timetable>(
  {
    MON: { type: [PeriodSchema], default: [] },
    TUE: { type: [PeriodSchema], default: [] },
    WED: { type: [PeriodSchema], default: [] },
    THU: { type: [PeriodSchema], default: [] },
    FRI: { type: [PeriodSchema], default: [] },
  },
  { _id: false }
);

const ClassSchema = new Schema<IClass>({
  name: { type: String, required: true, unique: true },
  timetable: { type: TimetableSchema, required: true },
  holidays: { type: [HolidaySchema], default: [] },
  dayOrderOverrides: { type: [DayOrderOverrideSchema], default: [] },
  semesterStart: { type: String, required: true },
  semesterEnd: { type: String, required: true },
});

export const Class = (models.Class as Model<IClass>) ?? model<IClass>("Class", ClassSchema);
