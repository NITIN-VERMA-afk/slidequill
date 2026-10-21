import crypto from "crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { getRedis } from "./ratelimit";
import { connectDB } from "@/app/lib/db";
import ConsumedPrintToken from "@/app/models/ConsumedPrintToken";

function getSecret(): Uint8Array {
  const SECRET_RAW = process.env.JWT_SECRET;
  if (!SECRET_RAW || SECRET_RAW.length < 32) {
    throw new Error("[print-token] JWT_SECRET env var must be set and at least 32 characters.");
  }
  return new TextEncoder().encode(SECRET_RAW);
}

export interface PrintTokenPayload extends JWTPayload {
  sub: string;
  deckId: string;
  jti: string;
  type: "print";
}

/**
 * Generate a short-lived (60s) single-use signed token bound to deckId + userId.
 */
export async function generatePrintToken({
  userId,
  deckId,
}: {
  userId: string;
  deckId: string;
}): Promise<string> {
  const jti = crypto.randomUUID();

  return new SignJWT({
    deckId,
    type: "print",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(getSecret());
}

/**
 * Consumes the print token on first server render.
 * Enforces single-use via Redis SET NX, falling back to atomic MongoDB unique document.
 * Has no in-memory fallback.
 */
export async function consumePrintToken(token: string): Promise<{
  valid: boolean;
  userId?: string;
  deckId?: string;
  error?: string;
}> {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "Missing or invalid token format." };
  }

  let payload: PrintTokenPayload;
  try {
    const verified = await jwtVerify<PrintTokenPayload>(token, getSecret(), {
      algorithms: ["HS256"],
    });
    payload = verified.payload;
  } catch (err: any) {
    return { valid: false, error: "Invalid or expired print token." };
  }

  if (payload.type !== "print" || !payload.sub || !payload.deckId || !payload.jti) {
    return { valid: false, error: "Malformed print token claims." };
  }

  const jti = payload.jti;
  const hasRedis = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

  if (hasRedis) {
    try {
      const redis = getRedis();
      const res = await redis.set(`sq:ptk:${jti}`, "1", { nx: true, ex: 600 });
      if (res !== "OK") {
        return { valid: false, error: "Print token has already been used." };
      }
      return { valid: true, userId: payload.sub, deckId: payload.deckId };
    } catch {
      // Fall through to DB atomic fallback if Redis has transient error
    }
  }

  // DB atomic flag fallback (unique index on jti)
  try {
    await connectDB();
    await ConsumedPrintToken.create({ jti, consumedAt: new Date() });
  } catch (err: any) {
    if (err?.code === 11000 || err?.name === "MongoServerError") {
      return { valid: false, error: "Print token has already been used." };
    }
    throw err;
  }

  return { valid: true, userId: payload.sub, deckId: payload.deckId };
}
