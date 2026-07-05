import { Schema, model, models, type Model, type Types } from "mongoose";
import { WEEKDAYS, type Weekday } from "@/lib/weekday";

export type DayType = "NORMAL" | "HOLIDAY" | "FULL_ABSENT";
export type PeriodStatus = "PRESENT" | "ABSENT" | "OD" | "CANCELLED";

export interface IDayLogPeriod {
  periodNo: number;
  subjectCode: string;
  status: PeriodStatus;
}

export interface IDayLog {
  userId: Types.ObjectId;
  date: string;
  dayType: DayType;
  followedWeekday: Weekday;
  periods: IDayLogPeriod[];
  lockedAt: Date | null;
}

const DayLogPeriodSchema = new Schema<IDayLogPeriod>(
  {
    periodNo: { type: Number, required: true },
    subjectCode: { type: String, required: true },
    status: { type: String, enum: ["PRESENT", "ABSENT", "OD", "CANCELLED"], required: true },
  },
  { _id: false }
);

const DayLogSchema = new Schema<IDayLog>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true },
  dayType: { type: String, enum: ["NORMAL", "HOLIDAY", "FULL_ABSENT"], required: true },
  followedWeekday: { type: String, enum: WEEKDAYS, required: true },
  periods: { type: [DayLogPeriodSchema], default: [] },
  lockedAt: { type: Date, default: null },
});

DayLogSchema.index({ userId: 1, date: 1 }, { unique: true });

export const DayLog = (models.DayLog as Model<IDayLog>) ?? model<IDayLog>("DayLog", DayLogSchema);
