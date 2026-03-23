import mongoose from "mongoose";
import { logger } from "../lib/logger";

export async function connectDatabase(): Promise<void> {
  const uri = process.env["MONGODB_URI"] || "";
  if (!uri) {
    logger.warn("MONGODB_URI not set — skipping MongoDB connection");
    return;
  }
  try {
    await mongoose.connect(uri);
    logger.info("Connected to MongoDB");
  } catch (err) {
    logger.error({ err }, "MongoDB connection failed");
    process.exit(1);
  }
}
