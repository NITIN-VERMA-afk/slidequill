import crypto from "crypto";
import mongoose from "mongoose";
import { getRedis } from "../ratelimit";
import { connectDB } from "@/app/lib/db";
import PdfExportLock from "@/app/models/PdfExportLock";

const LOCK_TTL_SECONDS = 75; // maxDuration (60s) + 15s buffer

export async function acquirePdfExportLock(
  userId: string
): Promise<{ acquired: boolean; lockOwner?: string }> {
  const lockOwner = crypto.randomUUID();
  const hasRedis = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );

  if (hasRedis) {
    try {
      const redis = getRedis();
      const key = `sq:lock:pdf:${userId}`;
      const res = await redis.set(key, lockOwner, { nx: true, ex: LOCK_TTL_SECONDS });
      if (res === "OK") {
        return { acquired: true, lockOwner };
      }
      return { acquired: false };
    } catch {
      // Fall through to DB lock
    }
  }

  // DB atomic lock fallback
  try {
    await connectDB();
    const userObjectId = new mongoose.Types.ObjectId(userId);
    // Remove expired locks first
    await PdfExportLock.deleteMany({
      userId: userObjectId,
      expiresAt: { $lte: new Date() },
    });

    await PdfExportLock.create({
      userId: userObjectId,
      lockOwner,
      expiresAt: new Date(Date.now() + LOCK_TTL_SECONDS * 1000),
    });

    return { acquired: true, lockOwner };
  } catch (err: any) {
    if (err?.code === 11000 || err?.name === "MongoServerError") {
      return { acquired: false };
    }
    throw err;
  }
}

export async function releasePdfExportLock(
  userId: string,
  lockOwner: string
): Promise<void> {
  const hasRedis = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );

  if (hasRedis) {
    try {
      const redis = getRedis();
      const key = `sq:lock:pdf:${userId}`;
      const current = await redis.get<string>(key);
      if (current === lockOwner) {
        await redis.del(key);
      }
      return;
    } catch {
      // Fall through to DB release
    }
  }

  try {
    await connectDB();
    const userObjectId = new mongoose.Types.ObjectId(userId);
    await PdfExportLock.deleteOne({ userId: userObjectId, lockOwner });
  } catch {
    // Non-fatal if lock already expired
  }
}
