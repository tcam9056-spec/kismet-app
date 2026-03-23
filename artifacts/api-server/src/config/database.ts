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
      'MONGODB_URI không hợp lệ — phải bắt đầu bằng "mongodb://" hoặc "mongodb+srv://". Bỏ qua kết nối.',
    );
    return;
  }

  // Log sanitized URI (ẩn password)
  const sanitized = uri.replace(/:([^@]+)@/, ":****@");
  logger.info({ uri: sanitized }, "Đang kết nối MongoDB...");

  // Mongoose connection events
  mongoose.connection.on("connecting", () =>
    logger.info("MongoDB: đang kết nối..."),
  );
  mongoose.connection.on("connected", () =>
    logger.info("MongoDB: kết nối thành công!"),
  );
  mongoose.connection.on("error", (err) =>
    logger.error({ err: err.message }, "MongoDB: lỗi kết nối"),
  );
  mongoose.connection.on("disconnected", () =>
    logger.warn("MongoDB: mất kết nối"),
  );

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    isConnected = true;
    logger.info(
      { db: mongoose.connection.name, host: mongoose.connection.host },
      "MongoDB đã sẵn sàng",
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : JSON.stringify(err);
    logger.error(
      { message },
      "Kết nối MongoDB thất bại — kiểm tra MONGODB_URI, IP whitelist (0.0.0.0/0) và username/password",
    );
  }
}
