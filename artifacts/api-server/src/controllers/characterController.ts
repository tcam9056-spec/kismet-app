import { Request, Response } from "express";
import { Character } from "../models/character";

export async function createCharacter(
  req: Request,
  res: Response,
): Promise<void> {
  const { name, description, imageUrl } = req.body as {
    name?: string;
    description?: string;
    imageUrl?: string;
  };

  if (!name || !description || !imageUrl) {
    res.status(400).json({ error: "Thiếu name, description hoặc imageUrl" });
    return;
  }

  try {
    const character = await Character.create({ name, description, imageUrl });
    res.status(201).json({ character });
  } catch (err) {
    res.status(500).json({ error: "Lỗi tạo nhân vật" });
  }
}

export async function getCharacters(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const characters = await Character.find().sort({ createdAt: -1 }).lean();
    res.json({ characters });
  } catch (err) {
    res.status(500).json({ error: "Lỗi lấy danh sách nhân vật" });
  }
}
