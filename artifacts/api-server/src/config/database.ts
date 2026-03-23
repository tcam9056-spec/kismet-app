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
    logger.error(
      { hint: "URI phải bắt đầu bằng mongodb:// hoặc mongodb+srv://" },
      `MONGODB_URI không hợp lệ — giá trị hiện tại bắt đầu bằng: "${uri.slice(0, 20)}..."`,
    );
    return;
  }

  const sanitized = uri.replace(/:([^@]{1,}?)@/, ":****@");
  logger.info({ uri: sanitized }, "Đang kết nối MongoDB...");

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
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
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
      "Kết nối MongoDB thất bại",
    );
    logger.error(
      "Hướng dẫn sửa lỗi:\n" +
      "  1. Kiểm tra URI format: mongodb+srv://USERNAME:PASSWORD@cluster.mongodb.net/kismet\n" +
      "  2. Đảm bảo IP 0.0.0.0/0 đã được thêm vào Network Access trong Atlas\n" +
      "  3. Xác nhận username và password đúng (không có ký tự đặc biệt chưa được encode)\n" +
      "  4. Cluster phải đang chạy (không bị paused)",
    );
  }
}
