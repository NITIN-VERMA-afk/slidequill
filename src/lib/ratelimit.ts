import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Lazily initialised so the module is safe to import in environments
// without the env vars (e.g. build-time static analysis).
let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error(
        "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set."
      );
    }
    redis = new Redis({ url, token });
  }
  return redis;
}

/** 5 requests per 60 s — used for login, signup, refresh (by IP) */
export function getLoginLimiter() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(5, "60 s"),
    prefix: "sq:rl:login",
  });
}

/** Stricter per-email limiter for login: 3 requests per 15 min */
export function getEmailLimiter() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(3, "15 m"),
    prefix: "sq:rl:email",
  });
}

/** 10 deck creations per hour per user */
export function getDeckLimiter() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "sq:rl:deck",
  });
}

/** 5 exports per minute per user */
export function getExportLimiter() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    prefix: "sq:rl:export",
  });
}

/** 5 order creations per 10 minutes */
export function getBillingLimiter() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(5, "10 m"),
    prefix: "sq:rl:billing",
  });
}

