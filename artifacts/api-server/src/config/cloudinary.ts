import { v2 as cloudinary } from "cloudinary";
import { logger } from "../lib/logger";

const cloudName = process.env["CLOUDINARY_CLOUD_NAME"] || "";
const apiKey = process.env["CLOUDINARY_API_KEY"] || "";
const apiSecret = process.env["CLOUDINARY_API_SECRET"] || "";

if (!cloudName || !apiKey || !apiSecret) {
  logger.warn(
    "Cloudinary chưa cấu hình đầy đủ — kiểm tra CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET",
  );
} else {
  logger.info(
    { cloud_name: cloudName },
    "Cloudinary đã cấu hình thành công",
  );
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

export default cloudinary;
