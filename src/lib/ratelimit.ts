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

let mockExportLimiter: { limit: (k?: string) => Promise<{ success: boolean }> } | null = null;
let mockPdfDailyLimiter: { limit: (k?: string) => Promise<{ success: boolean }> } | null = null;

export function __setMockExportLimiter(limiter: typeof mockExportLimiter) {
  mockExportLimiter = limiter;
}

export function __setMockPdfDailyLimiter(limiter: typeof mockPdfDailyLimiter) {
  mockPdfDailyLimiter = limiter;
}

/** 5 exports per minute per user */
export function getExportLimiter() {
  if (mockExportLimiter) return mockExportLimiter as unknown as Ratelimit;
  if (!hasRedisConfig()) return fallbackLimiter as unknown as Ratelimit;
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    prefix: "sq:rl:export",
  });
}

/** 30 PDF exports per day per user */
export function getPdfDailyExportLimiter() {
  if (mockPdfDailyLimiter) return mockPdfDailyLimiter as unknown as Ratelimit;
  if (!hasRedisConfig()) return fallbackLimiter as unknown as Ratelimit;
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(30, "24 h"),
    prefix: "sq:rl:export:pdf:daily",
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

/** 10 signups per 24 hours per IP to prevent free credit farming */
export function getSignupIpLimiter() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "24 h"),
    prefix: "sq:rl:signup:ip",
  });
}

/** 20 deck generations per day per user (default) */
export function getGenerationLimiter() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(20, "24 h"),
    prefix: "sq:rl:generate",
  });
}

/** Tiered generation limiter: 20/day for free users, 100/day for paid users */
export function getUserGenerationLimiter(hasPurchased: boolean) {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(hasPurchased ? 100 : 20, "24 h"),
    prefix: hasPurchased ? "sq:rl:generate:paid" : "sq:rl:generate:free",
  });
}

/** 6 outline requests per minute per user */
export function getOutlineMinuteLimiter() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(6, "1 m"),
    prefix: "sq:rl:outline:min",
  });
}

/** 30 outline requests per day per user */
export function getOutlineDailyLimiter() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(30, "24 h"),
    prefix: "sq:rl:outline:day",
  });
}

/** 10 image searches per minute per user */
export function getImageSearchUserLimiter() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    prefix: "sq:rl:img:user",
  });
}

/** Global Unsplash demo rate limiter: 45 requests per 1 hour to prevent 50/hr demo exhaustion */
export function getUnsplashGlobalLimiter() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(45, "1 h"),
    prefix: "sq:rl:unsplash:global",
  });
}

const fallbackLimiter = {
  limit: async (_key?: string) => ({
    success: true,
    limit: 100,
    remaining: 99,
    reset: Date.now() + 60000,
    pending: Promise.resolve(),
  }),
};

function hasRedisConfig(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/** 60 deck mutations (PATCH/DELETE) per minute per user */
export function getDeckMutationLimiter() {
  if (!hasRedisConfig()) return fallbackLimiter as unknown as Ratelimit;
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "sq:rl:deck:mutate",
  });
}

let mockReadLimiter: { limit: (k?: string) => Promise<{ success: boolean }> } | null = null;
let mockMissLimiter: { limit: (k?: string) => Promise<{ success: boolean }> } | null = null;

export function __setMockPublicDeckReadLimiter(limiter: typeof mockReadLimiter) {
  mockReadLimiter = limiter;
}

export function __setMockPublicDeckMissLimiter(limiter: typeof mockMissLimiter) {
  mockMissLimiter = limiter;
}

/** 60 public deck reads per minute per IP */
export function getPublicDeckReadLimiter() {
  if (mockReadLimiter) return mockReadLimiter as unknown as Ratelimit;
  if (!hasRedisConfig()) return fallbackLimiter as unknown as Ratelimit;
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "sq:rl:public:read",
  });
}

/** 20 public deck slug misses (404s) per minute per IP */
export function getPublicDeckMissLimiter() {
  if (mockMissLimiter) return mockMissLimiter as unknown as Ratelimit;
  if (!hasRedisConfig()) return fallbackLimiter as unknown as Ratelimit;
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    prefix: "sq:rl:public:miss",
  });
}

/** 10 share link mutations per minute per user/IP */
export function getShareMutationLimiter() {
  if (!hasRedisConfig()) return fallbackLimiter as unknown as Ratelimit;
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    prefix: "sq:rl:share:mutate",
  });
}


