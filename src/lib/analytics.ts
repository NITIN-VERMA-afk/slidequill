import { connectDB } from "@/app/lib/db";
import AnalyticsEvent, { type AnalyticsEventType } from "@/app/models/AnalyticsEvent";

/**
 * Sanitizes an error into a clean, safe category string.
 * Guarantees that no prompt fragments, document snippets, emails,
 * or sensitive backend internal traces ever leak into analytics logs.
 */
export function sanitizeAnalyticsErrorMessage(err: unknown): string {
  if (!err) return "unknown_error";
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes("rate limit") || lower.includes("429")) return "rate_limit_exceeded";
  if (lower.includes("timeout") || lower.includes("aborted") || lower.includes("etimeout")) return "timeout";
  if (lower.includes("parse") || lower.includes("json")) return "parse_error";
  if (lower.includes("validation") || lower.includes("zod")) return "validation_error";
  if (lower.includes("quota") || lower.includes("insufficient_quota")) return "quota_exceeded";
  if (lower.includes("auth") || lower.includes("401") || lower.includes("403") || lower.includes("unauthorized")) return "auth_error";
  if (lower.includes("connect") || lower.includes("econnrefused") || lower.includes("network")) return "network_error";

  return "generation_internal_error";
}

/**
 * Tracks an analytics event in MongoDB.
 * Completely safe and asynchronous — errors are logged and never throw or crash user requests.
 * Document contents and sensitive data are never logged.
 */
export async function trackEvent(
  event: AnalyticsEventType,
  options: {
    userId?: string;
    deckId?: string;
    meta?: Record<string, string | number | boolean | null | undefined>;
  } = {}
) {
  try {
    await connectDB();
    await AnalyticsEvent.create({
      event,
      userId: options.userId,
      deckId: options.deckId,
      meta: options.meta ?? {},
    });
  } catch (err) {
    // Non-blocking telemetry
    console.error(`[Analytics] Failed to record event ${event}:`, err);
  }
}

