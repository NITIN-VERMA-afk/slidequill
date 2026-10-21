/**
 * src/lib/export/pdf-interception.ts
 *
 * Strict exact-hostname allowlist for Chromium request interception during PDF export.
 * Blocks all SSRF attempts, private IP ranges (169.254.169.254, 127.0.0.1, 10.*, 192.168.*),
 * and untrusted third-party hosts.
 */

export const PDF_ALLOWED_EXTERNAL_HOSTNAMES = [
  "images.unsplash.com",
  "images.pexels.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
] as const;

/**
 * Checks if a requested URL is permitted during PDF rendering.
 * - Allows data: and blob: schemes for inline images/fonts.
 * - Allows requests matching the app origin (http/https for dev/prod parity).
 * - Requires https and exact hostname match against approved hosts for any external resource.
 * - Aborts everything else.
 */
export function isAllowedPdfRequest(urlStr: string, appOrigin: string): boolean {
  if (!urlStr || typeof urlStr !== "string") return false;

  const trimmed = urlStr.trim();

  // Allow data: and blob: protocols for inline images & fonts
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return true;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  // Exact match with application origin (with localhost <-> 127.0.0.1 dev parity)
  try {
    const parsedApp = new URL(appOrigin);
    if (parsed.origin === parsedApp.origin) {
      return true;
    }
    const isLocalHost = (h: string) => h === "localhost" || h === "127.0.0.1";
    if (isLocalHost(parsed.hostname) && isLocalHost(parsedApp.hostname) && parsed.port === parsedApp.port) {
      return true;
    }
  } catch {
    // If appOrigin is malformed, do not allow arbitrary matching
  }

  // All external requests MUST use HTTPS
  if (parsed.protocol !== "https:") {
    return false;
  }

  // Exact-hostname match (case-insensitive) against allowlist
  const hostname = parsed.hostname.toLowerCase();
  return PDF_ALLOWED_EXTERNAL_HOSTNAMES.includes(hostname as any);
}
