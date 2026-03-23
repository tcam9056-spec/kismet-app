import mongoose from "mongoose";
import { logger } from "../lib/logger";

export async function connectDatabase(): Promise<void> {
  const uri = process.env["MONGODB_URI"] || "";
  if (!uri) {
    logger.warn("MONGODB_URI not set — skipping MongoDB connection");
    return;
  }

  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    logger.error(
      'MONGODB_URI không hợp lệ — phải bắt đầu bằng "mongodb://" hoặc "mongodb+srv://". Kiểm tra lại giá trị trong Secrets.',
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    logger.info("Connected to MongoDB");
  } catch (err) {
    logger.error({ err }, "MongoDB connection failed");
    process.exit(1);
  }
}
