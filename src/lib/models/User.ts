import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IUser {
  googleId: string;
  email: string;
  name: string;
  image?: string;
  classId: Types.ObjectId | null;
  elective: "AE" | "FSWD" | null;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  googleId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  image: { type: String },
  classId: { type: Schema.Types.ObjectId, ref: "Class", default: null },
  elective: { type: String, enum: ["AE", "FSWD"], default: null },
  createdAt: { type: Date, default: Date.now },
});

export const User = (models.User as Model<IUser>) ?? model<IUser>("User", UserSchema);
