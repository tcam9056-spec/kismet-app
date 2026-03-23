import mongoose, { Schema, Document } from "mongoose";

export interface ICharacter extends Document {
  name: string;
  description: string;
  imageUrl: string;
  createdAt: Date;
}

const CharacterSchema = new Schema<ICharacter>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Character = mongoose.model<ICharacter>(
  "Character",
  CharacterSchema,
);
