import { Request, Response } from "express";
import { ChatProfile } from "../models/chatProfile";
import { isDatabaseConnected } from "../config/database";
import { logger } from "../lib/logger";

function dbGuard(res: Response): boolean {
  if (!isDatabaseConnected()) {
    res.status(503).json({ error: "Database chưa kết nối." });
    return false;
  }
  return true;
}

export async function createChatProfile(req: Request, res: Response): Promise<void> {
  if (!dbGuard(res)) return;

  const { userId, name, gender, personality, bio, appearance, avatarUrl, isDefault } =
    req.body as {
      userId?: string;
      name?: string;
      gender?: string;
      personality?: string;
      bio?: string;
      appearance?: string;
      avatarUrl?: string;
      isDefault?: boolean;
    };

  if (!userId || !name) {
    res.status(400).json({ error: "Thiếu userId hoặc name" });
    return;
  }

  try {
    if (isDefault) {
      await ChatProfile.updateMany({ userId }, { isDefault: false });
    }

    const profile = await ChatProfile.create({
      userId,
      name,
      gender: gender ?? "",
      personality: personality ?? "",
      bio: bio ?? "",
      appearance: appearance ?? "",
      avatarUrl: avatarUrl ?? "",
      isDefault: isDefault ?? false,
    });

    logger.info({ id: profile._id, name, userId }, "Tạo chat profile thành công");
    res.status(201).json({ profile });
  } catch (err) {
    logger.error({ err }, "Lỗi tạo chat profile");
    res.status(500).json({ error: "Lỗi tạo chat profile" });
  }
}

export async function getChatProfiles(req: Request, res: Response): Promise<void> {
  if (!dbGuard(res)) return;

  const { userId } = req.query as { userId?: string };
  if (!userId) {
    res.status(400).json({ error: "Thiếu query param userId" });
    return;
  }

  try {
    const profiles = await ChatProfile.find({ userId })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();
    res.json({ profiles });
  } catch (err) {
    logger.error({ err }, "Lỗi lấy danh sách chat profile");
    res.status(500).json({ error: "Lỗi lấy danh sách chat profile" });
  }
}

export async function deleteChatProfile(req: Request, res: Response): Promise<void> {
  if (!dbGuard(res)) return;

  const { id } = req.params;
  try {
    const deleted = await ChatProfile.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404).json({ error: "Chat profile không tồn tại" });
      return;
    }
    logger.info({ id }, "Xoá chat profile thành công");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, id }, "Lỗi xoá chat profile");
    res.status(500).json({ error: "Lỗi xoá chat profile" });
  }
}
