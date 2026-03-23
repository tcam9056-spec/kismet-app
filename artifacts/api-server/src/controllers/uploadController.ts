import { Request, Response } from "express";
import { Readable } from "stream";
import cloudinary from "../config/cloudinary";
import { logger } from "../lib/logger";

export async function uploadImage(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    logger.warn("upload-image: không có file trong request");
    res.status(400).json({ error: "Không có file ảnh. Hãy gửi field tên 'image' dạng multipart/form-data." });
    return;
  }

  logger.info(
    { originalname: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype },
    "upload-image: bắt đầu upload lên Cloudinary",
  );

  try {
    const imageUrl = await new Promise<string>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "kismet-characters",
          resource_type: "image",
          use_filename: false,
          unique_filename: true,
        },
        (error, result) => {
          if (error) {
            logger.error({ error }, "Cloudinary upload_stream callback error");
            return reject(error);
          }
          if (!result) {
            return reject(new Error("Cloudinary trả về kết quả rỗng"));
          }
          logger.info({ public_id: result.public_id, url: result.secure_url }, "Cloudinary upload thành công");
          resolve(result.secure_url);
        },
      );

      Readable.from(req.file!.buffer).pipe(uploadStream);
    });

    res.json({ url: imageUrl });
  } catch (err: unknown) {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else if (err && typeof err === "object" && "message" in err) {
      message = String((err as Record<string, unknown>)["message"]);
    } else {
      message = String(err);
    }
    logger.error({ err, message }, "upload-image: upload thất bại");
    res.status(500).json({ error: "Upload ảnh thất bại", detail: message });
  }
}
