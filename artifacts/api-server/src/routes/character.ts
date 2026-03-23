import { Router, type IRouter } from "express";
import multer from "multer";
import { uploadImage } from "../controllers/uploadController";
import {
  createCharacter,
  getCharacters,
} from "../controllers/characterController";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Chỉ chấp nhận file ảnh"));
    }
    cb(null, true);
  },
});

router.post("/upload-image", upload.single("image"), uploadImage);
router.post("/create-character", createCharacter);
router.get("/characters", getCharacters);

export default router;
