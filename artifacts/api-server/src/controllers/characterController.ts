import { Request, Response } from "express";
import { Character } from "../models/character";
import { isDatabaseConnected } from "../config/database";
import { logger } from "../lib/logger";

export async function createCharacter(
  req: Request,
  res: Response,
): Promise<void> {
  if (!isDatabaseConnected()) {
    res.status(503).json({ error: "Database chưa kết nối. Kiểm tra lại MONGODB_URI." });
    return;
  }

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
    logger.info({ id: character._id, name }, "Tạo nhân vật thành công");
    res.status(201).json({ character });
  } catch (err) {
    logger.error({ err }, "Lỗi tạo nhân vật");
    res.status(500).json({ error: "Lỗi tạo nhân vật" });
  }
}

export async function getCharacters(
  _req: Request,
  res: Response,
): Promise<void> {
  if (!isDatabaseConnected()) {
    res.status(503).json({ error: "Database chưa kết nối. Kiểm tra lại MONGODB_URI." });
    return;
  }

  try {
    const characters = await Character.find().sort({ createdAt: -1 }).lean();
    res.json({ characters });
  } catch (err) {
    logger.error({ err }, "Lỗi lấy danh sách nhân vật");
    res.status(500).json({ error: "Lỗi lấy danh sách nhân vật" });
  }
}
