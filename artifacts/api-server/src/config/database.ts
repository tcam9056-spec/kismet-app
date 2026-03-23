import mongoose from "mongoose";
import { logger } from "../lib/logger";

let isConnected = false;

export function isDatabaseConnected(): boolean {
  return isConnected;
}

export async function connectDatabase(): Promise<void> {
  const uri = process.env["MONGODB_URI"] || "";

  if (!uri) {
    logger.warn("MONGODB_URI không được set — bỏ qua kết nối MongoDB");
    return;
  }

  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    logger.warn(
      'MONGODB_URI không hợp lệ (phải bắt đầu bằng "mongodb://" hoặc "mongodb+srv://") — bỏ qua kết nối MongoDB. Các endpoint /upload-image vẫn hoạt động.',
    );
    return;
  }

  try {
    await mongoose.connect(uri);
    isConnected = true;
    logger.info("Đã kết nối MongoDB thành công");
  } catch (err) {
    logger.error({ err }, "Kết nối MongoDB thất bại — tiếp tục không có DB");
  }
}
