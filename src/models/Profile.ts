import mongoose, { Schema, Document } from "mongoose";

export interface IProfile extends Document {
  id: string;
  name: string;
  gender: string;
  gender_probability: number;
  sample_size: number;
  age: number;
  age_group: string;
  country_id: string;
  country_probability: number;
  created_at: Date;
}

const ProfileSchema = new Schema<IProfile>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, unique: true, lowercase: true },
    gender: { type: String, required: true },
    gender_probability: { type: Number, required: true },
    sample_size: { type: Number, required: true },
    age: { type: Number, required: true },
    age_group: { type: String, required: true },
    country_id: { type: String, required: true },
    country_probability: { type: Number, required: true },
    created_at: { type: Date, required: true },
  },
  {
    // Disable default _id and __v in toJSON, use our own id
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Profile = mongoose.model<IProfile>("Profile", ProfileSchema);
