import { Schema, model, models, type Model, type Types } from "mongoose";
import type { GradeLetter } from "@/lib/grades";

/**
 * A student's grade plan for one subject: the grade they're gunning for and,
 * once marks land, the raw components. Keyed per (user, subjectCode) so each
 * student plans their own bounty. Marks are optional — at semester start only
 * `targetGrade` is set and the planner works off `uniformTargetMarks`.
 */
export interface IInternalMarks {
  conceptTest: number | null;
  cat: number | null;
  assignment: number | null;
}

export interface ISubjectPlan {
  userId: Types.ObjectId;
  subjectCode: string;
  targetGrade: GradeLetter;
  internals: IInternalMarks[];
  endSem: number | null;
}

const TARGET_GRADES: GradeLetter[] = ["O", "A+", "A", "B+", "B"];

const InternalMarksSchema = new Schema<IInternalMarks>(
  {
    conceptTest: { type: Number, default: null },
    cat: { type: Number, default: null },
    assignment: { type: Number, default: null },
  },
  { _id: false }
);

const SubjectPlanSchema = new Schema<ISubjectPlan>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  subjectCode: { type: String, required: true },
  targetGrade: { type: String, enum: TARGET_GRADES, required: true },
  internals: { type: [InternalMarksSchema], default: [] },
  endSem: { type: Number, default: null },
});

SubjectPlanSchema.index({ userId: 1, subjectCode: 1 }, { unique: true });

export const SubjectPlan =
  (models.SubjectPlan as Model<ISubjectPlan>) ?? model<ISubjectPlan>("SubjectPlan", SubjectPlanSchema);
