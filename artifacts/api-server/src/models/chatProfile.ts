import mongoose, { Schema, Document } from "mongoose";

export interface IChatProfile extends Document {
  userId: string;
  name: string;
  gender: string;
  personality: string;
  bio: string;
  appearance: string;
  avatar: string;
  isDefault: boolean;
  createdAt: Date;
}

const ChatProfileSchema = new Schema<IChatProfile>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    gender: { type: String, default: "", trim: true },
    personality: { type: String, default: "", trim: true },
    bio: { type: String, default: "", trim: true },
    appearance: { type: String, default: "", trim: true },
    avatar: { type: String, default: "" },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ChatProfile = mongoose.model<IChatProfile>(
  "ChatProfile",
  ChatProfileSchema,
);
