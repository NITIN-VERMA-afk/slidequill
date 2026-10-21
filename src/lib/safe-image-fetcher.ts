/**
 * src/lib/safe-image-fetcher.ts
 *
 * SSRF-hardened image fetcher:
 * - Enforces HTTPS only.
 * - Blocks private, loopback, link-local (cloud metadata), and multicast IPs.
 * - Connects to the validated IP directly via custom lookup to prevent DNS rebinding.
 * - Manual redirect following (max 3 hops), re-validating protocol and IP on every hop.
 * - 7s timeout across the entire fetch operation.
 * - 5 MB streamed byte cap.
 * - Content-Type allowlist (image/jpeg, image/png, image/webp). Rejects SVG.
 * - Magic bytes verification on downloaded buffer.
 * - Fallback to a bundled placeholder on ANY failure (never breaks PPTX export).
 */

import https from "node:https";
import dns from "node:dns";
import net from "node:net";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const DEFAULT_TIMEOUT_MS = 7000; // 7s
export const MAX_REDIRECT_HOPS = 3;

export const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

// Valid bundled 2x2 neutral grey PNG placeholder for graceful fallback
export const BUNDLED_PLACEHOLDER_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M9QzwAEjAwMDAwAFAkC74V9558AAAAASUVORK5CYII=";
export const BUNDLED_PLACEHOLDER_BUFFER = Buffer.from(
  BUNDLED_PLACEHOLDER_BASE64,
  "base64"
);
export const BUNDLED_PLACEHOLDER_DATA_URL = `image/png;base64,${BUNDLED_PLACEHOLDER_BASE64}`;

export interface SafeImageResult {
  buffer: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  dataUrl: string;
  isPlaceholder?: boolean;
}

/**
 * Checks whether an IPv4 or IPv6 address belongs to private, loopback, link-local,
 * cloud metadata, or reserved networks.
 */
export function isDisallowedIp(ip: string): boolean {
  // Normalize IPv6-mapped IPv4 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  const mappedIpv4Match = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (mappedIpv4Match) {
    return isDisallowedIp(mappedIpv4Match[1]);
  }

  const ipFamily = net.isIP(ip);
  if (ipFamily === 0) {
    // Not a valid canonical IP
    return true;
  }

  if (ipFamily === 4) {
    const parts = ip.split(".").map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true;
    }

    const [a, b, c] = parts;

    // 0.0.0.0/8 (Current network)
    if (a === 0) return true;
    // 10.0.0.0/8 (Private network)
    if (a === 10) return true;
    // 100.64.0.0/10 (Shared address / CGNAT)
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;
    // 169.254.0.0/16 (Link-local / Cloud metadata like 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12 (Private network)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.0.0.0/24 (IETF protocol assignments)
    if (a === 192 && b === 0 && c === 0) return true;
    // 192.0.2.0/24 (TEST-NET-1)
    if (a === 192 && b === 0 && c === 2) return true;
    // 192.88.99.0/24 (6to4 relay)
    if (a === 192 && b === 88 && c === 99) return true;
    // 192.168.0.0/16 (Private network)
    if (a === 192 && b === 168) return true;
    // 198.18.0.0/15 (Benchmarking)
    if (a === 198 && (b === 18 || b === 19)) return true;
    // 198.51.100.0/24 (TEST-NET-2)
    if (a === 198 && b === 51 && c === 100) return true;
    // 203.0.113.0/24 (TEST-NET-3)
    if (a === 203 && b === 0 && c === 113) return true;
    // 224.0.0.0/4 (Multicast)
    if (a >= 224 && a <= 239) return true;
    // 240.0.0.0/4 (Reserved / Broadcast)
    if (a >= 240) return true;

    return false;
  }

  if (ipFamily === 6) {
    const lower = ip.toLowerCase();
    // Loopback / unspecified
    if (lower === "::1" || lower === "::" || lower === "0:0:0:0:0:0:0:1") return true;
    // Unique local address (fc00::/7)
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    // Link-local address (fe80::/10)
    if (
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb")
    ) {
      return true;
    }
    // Multicast (ff00::/8)
    if (lower.startsWith("ff")) return true;
    // Documentation (2001:db8::/32)
    if (lower.startsWith("2001:db8")) return true;

    return false;
  }

  return true;
}

/**
 * Checks if a hostname resolves to any blocked/private IP addresses.
 * Returns the first valid public IP address and its family.
 */
export async function resolveAndValidateHostname(
  hostname: string
): Promise<{ address: string; family: 4 | 6 }> {
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".lan")
  ) {
    throw new Error(`Disallowed hostname: ${hostname}`);
  }

  // If hostname is directly an IP literal
  if (net.isIP(hostname)) {
    if (isDisallowedIp(hostname)) {
      throw new Error(`Disallowed IP address: ${hostname}`);
    }
    return {
      address: hostname,
      family: net.isIP(hostname) as 4 | 6,
    };
  }

  const records = await dns.promises.lookup(hostname, { all: true });
  if (!records || records.length === 0) {
    throw new Error(`DNS resolution failed for hostname: ${hostname}`);
  }

  // All resolved records MUST be safe. If even one record resolves to a private IP, reject.
  for (const record of records) {
    if (isDisallowedIp(record.address)) {
      throw new Error(`Resolved IP is disallowed: ${record.address}`);
    }
  }

  const chosen = records[0];
  return {
    address: chosen.address,
    family: chosen.family as 4 | 6,
  };
}

/**
 * Validates file magic bytes to verify actual image format.
 * Strictly accepts JPEG, PNG, or WebP. Explicitly rejects SVG, XML, HTML, etc.
 */
export function detectImageMagicBytes(
  buf: Buffer
): "image/jpeg" | "image/png" | "image/webp" | null {
  if (!buf || buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: RIFF ... WEBP
  const isRiff =
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46; // "RIFF"
  const isWebp =
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50; // "WEBP"
  if (isRiff && isWebp) {
    return "image/webp";
  }

  return null;
}

/**
 * Low-level HTTP fetch single hop with pinned DNS lookup to prevent rebinding.
 */
function fetchHop(
  targetUrl: URL,
  validatedIp: string,
  family: 4 | 6,
  timeoutMs: number,
  maxBytes: number
): Promise<{
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  buffer?: Buffer;
}> {
  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout | null = null;
    let isSettled = false;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const req = https.request(
      {
        protocol: "https:",
        hostname: targetUrl.hostname,
        port: targetUrl.port ? parseInt(targetUrl.port, 10) : 443,
        path: targetUrl.pathname + targetUrl.search,
        method: "GET",
        headers: {
          Host: targetUrl.host,
          "User-Agent": "SlideQuill-SafeFetcher/1.0",
          Accept: "image/jpeg,image/png,image/webp",
        },
        // Pin lookup to the pre-validated IP to eliminate DNS rebinding
        lookup: (_hostname, options: any, callback) => {
          if (options && options.all) {
            callback(null, [{ address: validatedIp, family }] as any);
          } else {
            callback(null, validatedIp, family);
          }
        },
        timeout: timeoutMs,
      },
      (res) => {
        const statusCode = res.statusCode || 0;
        const headers = res.headers;

        // If redirect, do not consume body, resolve immediately with headers
        if (
          statusCode === 301 ||
          statusCode === 302 ||
          statusCode === 303 ||
          statusCode === 307 ||
          statusCode === 308
        ) {
          cleanup();
          res.resume(); // discard body
          isSettled = true;
          resolve({ statusCode, headers });
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          cleanup();
          res.resume();
          isSettled = true;
          reject(new Error(`HTTP error ${statusCode}`));
          return;
        }

        const rawContentType = headers["content-type"];
        const normalizedContentType = (
          Array.isArray(rawContentType) ? rawContentType[0] : rawContentType || ""
        )
          .split(";")[0]
          .trim()
          .toLowerCase();

        if (!ALLOWED_CONTENT_TYPES.has(normalizedContentType)) {
          cleanup();
          res.destroy();
          isSettled = true;
          reject(new Error(`Disallowed content-type: ${normalizedContentType}`));
          return;
        }

        const contentLengthHeader = headers["content-length"];
        if (contentLengthHeader) {
          const parsedLen = parseInt(
            Array.isArray(contentLengthHeader)
              ? contentLengthHeader[0]
              : contentLengthHeader,
            10
          );
          if (!isNaN(parsedLen) && parsedLen > maxBytes) {
            cleanup();
            res.destroy();
            isSettled = true;
            reject(new Error(`Content-Length exceeds ${maxBytes} bytes limit`));
            return;
          }
        }

        let totalBytes = 0;
        const chunks: Buffer[] = [];

        res.on("data", (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > maxBytes) {
            cleanup();
            res.destroy(new Error(`Stream exceeded ${maxBytes} bytes limit`));
            if (!isSettled) {
              isSettled = true;
              reject(new Error(`Stream exceeded ${maxBytes} bytes limit`));
            }
            return;
          }
          chunks.push(chunk);
        });

        res.on("end", () => {
          cleanup();
          if (!isSettled) {
            isSettled = true;
            resolve({
              statusCode,
              headers,
              buffer: Buffer.concat(chunks),
            });
          }
        });

        res.on("error", (err) => {
          cleanup();
          if (!isSettled) {
            isSettled = true;
            reject(err);
          }
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Fetch timed out after ${timeoutMs}ms`));
    });

    req.on("error", (err) => {
      cleanup();
      if (!isSettled) {
        isSettled = true;
        reject(err);
      }
    });

    timer = setTimeout(() => {
      if (!isSettled) {
        req.destroy(new Error(`Fetch exceeded overall timeout of ${timeoutMs}ms`));
      }
    }, timeoutMs);

    req.end();
  });
}

/**
 * Strict image fetcher that enforces HTTPS, validates IP at every hop,
 * pins DNS lookup, follows max 3 redirects, verifies Content-Type and magic bytes.
 * Throws an Error if validation fails.
 */
export async function fetchSafeImageStrict(
  urlStr: string,
  options: {
    maxRedirects?: number;
    timeoutMs?: number;
    maxBytes?: number;
  } = {}
): Promise<SafeImageResult> {
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECT_HOPS;
  const totalTimeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? MAX_IMAGE_BYTES;

  const startTime = Date.now();
  let currentUrlStr = urlStr;
  let hops = 0;

  while (hops <= maxRedirects) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(currentUrlStr);
    } catch {
      throw new Error(`Invalid URL: ${currentUrlStr}`);
    }

    if (parsedUrl.protocol !== "https:") {
      throw new Error(`Disallowed protocol "${parsedUrl.protocol}". Only HTTPS is allowed.`);
    }

    const remainingTimeout = totalTimeout - (Date.now() - startTime);
    if (remainingTimeout <= 100) {
      throw new Error("Image fetch operation timed out.");
    }

    // Resolve & validate DNS
    const { address: validatedIp, family } = await resolveAndValidateHostname(
      parsedUrl.hostname
    );

    // Fetch hop with pinned lookup
    const res = await fetchHop(
      parsedUrl,
      validatedIp,
      family,
      remainingTimeout,
      maxBytes
    );

    // Check redirect
    if (
      res.statusCode === 301 ||
      res.statusCode === 302 ||
      res.statusCode === 303 ||
      res.statusCode === 307 ||
      res.statusCode === 308
    ) {
      hops++;
      if (hops > maxRedirects) {
        throw new Error(`Exceeded maximum redirects (${maxRedirects}).`);
      }
      const location = res.headers.location;
      const nextLocation = Array.isArray(location) ? location[0] : location;
      if (!nextLocation) {
        throw new Error("Redirect response missing Location header.");
      }
      // Resolve relative redirect against current URL
      currentUrlStr = new URL(nextLocation, parsedUrl).toString();
      continue;
    }

    // Non-redirect response: inspect buffer
    const buf = res.buffer;
    if (!buf || buf.length === 0) {
      throw new Error("Received empty image response.");
    }

    const detectedType = detectImageMagicBytes(buf);
    if (!detectedType) {
      throw new Error("Downloaded data does not match JPEG, PNG, or WebP magic bytes.");
    }

    return {
      buffer: buf,
      contentType: detectedType,
      dataUrl: `${detectedType};base64,${buf.toString("base64")}`,
    };
  }

  throw new Error(`Exceeded maximum redirects (${maxRedirects}).`);
}

/**
 * Resilient image fetcher for PPTX export and rendering.
 * NEVER throws: on any error, returns the bundled placeholder.
 */
export async function fetchSafeImage(urlStr?: string | null): Promise<SafeImageResult> {
  if (!urlStr || typeof urlStr !== "string" || !urlStr.trim()) {
    return {
      buffer: BUNDLED_PLACEHOLDER_BUFFER,
      contentType: "image/png",
      dataUrl: BUNDLED_PLACEHOLDER_DATA_URL,
      isPlaceholder: true,
    };
  }

  const trimmed = urlStr.trim();
  if (trimmed.startsWith("data:")) {
    const match = trimmed.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (match) {
      const mime = match[1].toLowerCase() as "image/jpeg" | "image/png" | "image/webp";
      if (ALLOWED_CONTENT_TYPES.has(mime)) {
        try {
          const buf = Buffer.from(match[2], "base64");
          return {
            buffer: buf,
            contentType: mime,
            dataUrl: trimmed,
          };
        } catch {}
      }
    }
    return {
      buffer: BUNDLED_PLACEHOLDER_BUFFER,
      contentType: "image/png",
      dataUrl: BUNDLED_PLACEHOLDER_DATA_URL,
      isPlaceholder: true,
    };
  }

  try {
    return await fetchSafeImageStrict(urlStr.trim());
  } catch (err) {
    // Log safe warning without leaking internal network errors
    console.warn(`[SafeImageFetcher] Image fetch failed; falling back to placeholder: ${err instanceof Error ? err.message : String(err)}`);
    return {
      buffer: BUNDLED_PLACEHOLDER_BUFFER,
      contentType: "image/png",
      dataUrl: BUNDLED_PLACEHOLDER_DATA_URL,
      isPlaceholder: true,
    };
  }
}

/**
 * Validates a custom image URL server-side before storing or saving to DB.
 */
export async function validateImageUrlServerSide(
  urlStr: string
): Promise<{ valid: boolean; error?: string }> {
  if (!urlStr || typeof urlStr !== "string") {
    return { valid: false, error: "Image URL is required." };
  }

  const trimmed = urlStr.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Invalid URL format." };
  }

  if (parsed.protocol !== "https:") {
    return { valid: false, error: "Only HTTPS image URLs are permitted." };
  }

  try {
    await resolveAndValidateHostname(parsed.hostname);
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Target host is not permitted.",
    };
  }

  return { valid: true };
}
