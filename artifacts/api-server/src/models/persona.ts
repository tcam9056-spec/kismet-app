import mongoose, { Schema, Document } from "mongoose";

export interface IPersona extends Document {
  userId: string;
  name: string;
  gender: string;
  personality: string;
  description: string;
  appearance: string;
  createdAt: Date;
}

const PersonaSchema = new Schema<IPersona>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    gender: { type: String, default: "", trim: true },
    personality: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    appearance: { type: String, default: "", trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Persona = mongoose.model<IPersona>("Persona", PersonaSchema);
