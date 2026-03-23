import { Request, Response } from "express";
import { Persona } from "../models/persona";
import { isDatabaseConnected } from "../config/database";
import { logger } from "../lib/logger";

function dbGuard(res: Response): boolean {
  if (!isDatabaseConnected()) {
    res.status(503).json({ error: "Database chưa kết nối." });
    return false;
  }
  return true;
}

export async function createPersona(req: Request, res: Response): Promise<void> {
  if (!dbGuard(res)) return;

  const { userId, name, gender, personality, description, appearance } =
    req.body as {
      userId?: string;
      name?: string;
      gender?: string;
      personality?: string;
      description?: string;
      appearance?: string;
    };

  if (!userId || !name) {
    res.status(400).json({ error: "Thiếu userId hoặc name" });
    return;
  }

  try {
    const persona = await Persona.create({
      userId,
      name,
      gender: gender ?? "",
      personality: personality ?? "",
      description: description ?? "",
      appearance: appearance ?? "",
    });
    logger.info({ id: persona._id, name, userId }, "Tạo persona thành công");
    res.status(201).json({ persona });
  } catch (err) {
    logger.error({ err }, "Lỗi tạo persona");
    res.status(500).json({ error: "Lỗi tạo persona" });
  }
}

export async function getPersonas(req: Request, res: Response): Promise<void> {
  if (!dbGuard(res)) return;

  const { userId } = req.query as { userId?: string };
  if (!userId) {
    res.status(400).json({ error: "Thiếu query param userId" });
    return;
  }

  try {
    const personas = await Persona.find({ userId }).sort({ createdAt: -1 }).lean();
    res.json({ personas });
  } catch (err) {
    logger.error({ err }, "Lỗi lấy danh sách persona");
    res.status(500).json({ error: "Lỗi lấy danh sách persona" });
  }
}

export async function getPersonaById(req: Request, res: Response): Promise<void> {
  if (!dbGuard(res)) return;

  const { id } = req.params;
  try {
    const persona = await Persona.findById(id).lean();
    if (!persona) {
      res.status(404).json({ error: "Persona không tồn tại" });
      return;
    }
    res.json({ persona });
  } catch (err) {
    logger.error({ err, id }, "Lỗi lấy persona theo id");
    res.status(500).json({ error: "Lỗi lấy persona" });
  }
}
