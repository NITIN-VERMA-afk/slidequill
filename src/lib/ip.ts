/**
 * src/lib/ip.ts
 *
 * Safe client IP extraction for SlideQuill hosting environment.
 * Prioritizes trusted edge headers (Vercel, Cloudflare) before fallback headers,
 * and validates the resulting IP to prevent header injection attacks.
 */
import type { NextRequest } from "next/server";
import net from "node:net";

export function getClientIp(req: NextRequest): string {
  // 1. Vercel trusted header (appended by Vercel edge proxy, cannot be spoofed by client)
  const vercelIp = req.headers.get("x-vercel-forwarded-for");
  if (vercelIp) {
    const candidate = vercelIp.split(",")[0].trim();
    if (net.isIP(candidate)) return candidate;
  }

  // 2. Cloudflare connecting IP (appended by Cloudflare edge network)
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) {
    const candidate = cfIp.trim();
    if (net.isIP(candidate)) return candidate;
  }

  // 3. Real IP header (set by Nginx/Traefik reverse proxies)
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    const candidate = realIp.trim();
    if (net.isIP(candidate)) return candidate;
  }

  // 4. Standard X-Forwarded-For header (leftmost IP is client)
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const candidate = xff.split(",")[0].trim();
    if (net.isIP(candidate)) return candidate;
  }

  return "127.0.0.1";
}
