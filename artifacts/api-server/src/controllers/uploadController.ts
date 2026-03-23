import { Request, Response } from "express";
import { Readable } from "stream";
import cloudinary from "../config/cloudinary";

export async function uploadImage(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: "Không có file ảnh" });
    return;
  }

  try {
    const imageUrl = await new Promise<string>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "kismet-characters", resource_type: "image" },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error("Upload failed"));
          resolve(result.secure_url);
        },
      );
      Readable.from(req.file!.buffer).pipe(uploadStream);
    });

    res.json({ imageUrl });
  } catch (err) {
    res.status(500).json({ error: "Lỗi upload ảnh lên Cloudinary" });
  }
}
