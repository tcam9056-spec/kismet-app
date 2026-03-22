import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router: IRouter = Router();

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads", "avatars");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Chỉ chấp nhận file ảnh"));
    }
    cb(null, true);
  },
});

router.post("/upload-avatar", upload.single("avatar"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Không có file" });
    return;
  }
  const filename = req.file.filename;
  const replitDomain = process.env["REPLIT_DEV_DOMAIN"] || "";
  let avatarUrl: string;
  if (replitDomain) {
    avatarUrl = `https://${replitDomain}/api/avatars/${filename}`;
  } else {
    avatarUrl = `/api/avatars/${filename}`;
  }
  res.json({ url: avatarUrl, filename });
});

export default router;
