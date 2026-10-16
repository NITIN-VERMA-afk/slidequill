/**
 * src/lib/image-search.ts
 *
 * Fetches stock images from Unsplash or Pexels API with graceful fallback.
 * A failure never throws or breaks slide generation.
 * Follows Unsplash API Attribution and Download Tracking Guidelines.
 */

export interface StockImageResult {
  id?: string;
  url: string;
  thumb: string;
  photographer: string;
  photographerUrl?: string;
  source: "unsplash" | "pexels" | "curated";
  downloadLocation?: string;
}

// Curated high-res royalty-free fallbacks with verified photographer attribution
export const CURATED_FALLBACKS: Record<string, StockImageResult> = {
  business: {
    id: "curated-business-sean-pollock",
    url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80",
    thumb: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&q=80",
    photographer: "Sean Pollock",
    photographerUrl: "https://unsplash.com/@seanpollock",
    source: "curated",
  },
  tech: {
    id: "curated-tech-alexandre-debieve",
    url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80",
    thumb: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=80",
    photographer: "Alexandre Debiève",
    photographerUrl: "https://unsplash.com/@alexandre_debieve",
    source: "curated",
  },
  teamwork: {
    id: "curated-teamwork-annie-spratt",
    url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80",
    thumb: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=400&q=80",
    photographer: "Annie Spratt",
    photographerUrl: "https://unsplash.com/@anniespratt",
    source: "curated",
  },
  data: {
    id: "curated-data-luke-chesser",
    url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80",
    thumb: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=400&q=80",
    photographer: "Luke Chesser",
    photographerUrl: "https://unsplash.com/@lukechesser",
    source: "curated",
  },
  creative: {
    id: "curated-creative-alesia-kazantceva",
    url: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1600&q=80",
    thumb: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=400&q=80",
    photographer: "Alesia Kazantceva",
    photographerUrl: "https://unsplash.com/@alekazan",
    source: "curated",
  },
  default: {
    id: "curated-default-austin-distel",
    url: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80",
    thumb: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=400&q=80",
    photographer: "Austin Distel",
    photographerUrl: "https://unsplash.com/@austindistel",
    source: "curated",
  },
};

export function getFallbackForKeyword(keyword: string, usedPhotoIds?: Set<string>): StockImageResult {
  const lower = keyword.toLowerCase();
  let matched: StockImageResult | undefined;

  for (const [key, fallback] of Object.entries(CURATED_FALLBACKS)) {
    if (key !== "default" && lower.includes(key)) {
      matched = fallback;
      break;
    }
  }

  const target = matched || CURATED_FALLBACKS.default;

  // If usedPhotoIds is provided and the target has an ID that is already used, find first unused fallback
  if (usedPhotoIds && target.id && usedPhotoIds.has(target.id)) {
    for (const fallback of Object.values(CURATED_FALLBACKS)) {
      if (!fallback.id || !usedPhotoIds.has(fallback.id)) {
        return fallback;
      }
    }
  }

  return target;
}

/**
 * Triggers Unsplash download-tracking endpoint as required by API guidelines.
 * Validates domain to prevent SSRF and never throws.
 */
export async function trackUnsplashDownload(downloadLocation?: string): Promise<void> {
  if (!downloadLocation) return;
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!unsplashKey) return;

  try {
    const parsed = new URL(downloadLocation);
    if (parsed.protocol !== "https:" || parsed.hostname !== "api.unsplash.com") {
      console.warn("[Unsplash] Invalid download tracking URL rejected:", downloadLocation);
      return;
    }

    await fetch(downloadLocation, {
      headers: { Authorization: `Client-ID ${unsplashKey}` },
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.warn("[Unsplash] Download tracking call failed:", err);
  }
}

// ── 24-Hour In-Memory Query Cache ──────────────────────────────────────────
export const IMAGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  photos: StockImageResult[];
  cachedAt: number;
}

const candidateCache = new Map<string, CacheEntry>();

// ── Rate Limiting & Hourly Budget ──────────────────────────────────────────
export const UNSPLASH_HOURLY_BUDGET = 40; // Max calls per sliding hour (Unsplash demo limit is 50)
export const MAX_DECK_UNSPLASH_REQUESTS = 8; // Max Unsplash calls per single deck run

const unsplashRequestTimestamps: number[] = [];

export function getHourlyBudgetUsage(): { count: number; max: number; remaining: number } {
  const cutoff = Date.now() - 60 * 60 * 1000;
  while (unsplashRequestTimestamps.length > 0 && unsplashRequestTimestamps[0] < cutoff) {
    unsplashRequestTimestamps.shift();
  }
  return {
    count: unsplashRequestTimestamps.length,
    max: UNSPLASH_HOURLY_BUDGET,
    remaining: Math.max(0, UNSPLASH_HOURLY_BUDGET - unsplashRequestTimestamps.length),
  };
}

export function resetHourlyBudget(): void {
  unsplashRequestTimestamps.length = 0;
}

export function recordUnsplashCall(): void {
  unsplashRequestTimestamps.push(Date.now());
}

export function clearImageCache(): void {
  candidateCache.clear();
}

export function getImageCacheSize(): number {
  return candidateCache.size;
}

export interface CandidateSearchResult {
  photos: StockImageResult[];
  reason: "ok" | "no_results" | "rate_limit_429" | "hourly_budget_exceeded" | "api_error" | "no_api_key";
}

/**
 * Executes fetch to Unsplash with retry and exponential backoff on 429 rate limit.
 */
async function fetchUnsplashWithRetry(
  query: string,
  unsplashKey: string
): Promise<{ ok: boolean; status: number; data?: any; errorReason?: CandidateSearchResult["reason"] }> {
  const budget = getHourlyBudgetUsage();
  if (budget.remaining <= 0) {
    console.warn(`[ImageSearch] Hourly budget reached (${budget.count}/${budget.max}). Skipping Unsplash request for "${query}".`);
    return { ok: false, status: 429, errorReason: "hourly_budget_exceeded" };
  }

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`;
  let attempt = 0;
  const maxAttempts = 3;
  let delayMs = 1000;

  while (attempt < maxAttempts) {
    attempt++;
    recordUnsplashCall();

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Client-ID ${unsplashKey}` },
        signal: AbortSignal.timeout(6000),
      });

      if (res.status === 429) {
        console.warn(`[ImageSearch] Unsplash HTTP 429 rate limit hit on attempt ${attempt} for "${query}".`);
        if (attempt < maxAttempts) {
          const retryAfter = res.headers.get("retry-after");
          const waitMs = retryAfter ? Math.min(parseInt(retryAfter, 10) * 1000, 3000) : delayMs;
          await new Promise((r) => setTimeout(r, waitMs));
          delayMs *= 2;
          continue;
        }
        return { ok: false, status: 429, errorReason: "rate_limit_429" };
      }

      if (!res.ok) {
        return { ok: false, status: res.status, errorReason: "api_error" };
      }

      const data = await res.json();
      return { ok: true, status: 200, data };
    } catch (err: any) {
      console.warn(`[ImageSearch] Unsplash fetch error on attempt ${attempt} for "${query}":`, err?.message || err);
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, delayMs));
        delayMs *= 2;
        continue;
      }
      return { ok: false, status: 0, errorReason: "api_error" };
    }
  }

  return { ok: false, status: 429, errorReason: "rate_limit_429" };
}

/**
 * Searches and caches up to 10 candidate photos for a normalized query.
 * Caches results in memory for 24 hours. Does NOT fall back to curated images.
 */
export async function searchStockCandidatesWithReason(keyword: string): Promise<CandidateSearchResult> {
  const query = (keyword || "business presentation").trim().toLowerCase();

  const cached = candidateCache.get(query);
  if (cached && Date.now() - cached.cachedAt < IMAGE_CACHE_TTL_MS) {
    return { photos: cached.photos, reason: cached.photos.length > 0 ? "ok" : "no_results" };
  }

  // 1. Try Unsplash (fetch 10 photos with 429 retry and budget tracking)
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  let lastReason: CandidateSearchResult["reason"] = unsplashKey ? "api_error" : "no_api_key";

  if (unsplashKey) {
    const fetchRes = await fetchUnsplashWithRetry(query, unsplashKey);
    if (fetchRes.ok && fetchRes.data) {
      const data = fetchRes.data;
      if (Array.isArray(data.results) && data.results.length > 0) {
        const photos: StockImageResult[] = data.results.map((photo: any) => ({
          id: photo.id,
          url: photo.urls.regular,
          thumb: photo.urls.thumb || photo.urls.small,
          photographer: photo.user?.name || "Unsplash Creator",
          photographerUrl: photo.user?.links?.html || `https://unsplash.com/@${photo.user?.username || ""}`,
          source: "unsplash" as const,
          downloadLocation: photo.links?.download_location,
        }));
        candidateCache.set(query, { photos, cachedAt: Date.now() });
        return { photos, reason: "ok" };
      } else {
        candidateCache.set(query, { photos: [], cachedAt: Date.now() });
        return { photos: [], reason: "no_results" };
      }
    } else {
      lastReason = fetchRes.errorReason || "api_error";
    }
  }

  // 2. Try Pexels (fetch 10 photos)
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (pexelsKey) {
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`,
        {
          headers: { Authorization: pexelsKey },
          next: { revalidate: 86400 },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.photos) && data.photos.length > 0) {
          const photos: StockImageResult[] = data.photos.map((photo: any) => ({
            id: String(photo.id),
            url: photo.src.large2x || photo.src.large,
            thumb: photo.src.medium || photo.src.small,
            photographer: photo.photographer || "Pexels Creator",
            photographerUrl: photo.photographer_url,
            source: "pexels" as const,
          }));
          candidateCache.set(query, { photos, cachedAt: Date.now() });
          return { photos, reason: "ok" };
        } else {
          return { photos: [], reason: "no_results" };
        }
      }
    } catch (err) {
      console.warn("[ImageSearch] Pexels query failed:", err);
    }
  }

  // Never invent or return curated fallbacks into candidate search results
  return { photos: [], reason: lastReason };
}

export async function searchStockCandidates(keyword: string): Promise<StockImageResult[]> {
  const res = await searchStockCandidatesWithReason(keyword);
  return res.photos;
}

export interface ImageSearchOptions {
  isTitleOrClosing?: boolean;
  layout?: string;
  slideIdx?: number;
}

/**
 * Searches Unsplash or Pexels for a stock image matching the keyword.
 * New Fallback Policy:
 * - If API returns no results or fails/rate-limited:
 *   - Content slides (bullets, quote, image, two_column) are left WITHOUT an image (returns null).
 *   - Only title and closing slides are allowed to use curated fallback images.
 * - Logs provider and reason per slide.
 */
export async function searchStockImage(
  keyword: string,
  usedPhotoIds?: Set<string>,
  options?: ImageSearchOptions
): Promise<StockImageResult | null> {
  const query = (keyword || "business presentation").trim();
  const searchResult = await searchStockCandidatesWithReason(query);
  const candidates = searchResult.photos;
  const isTitleOrClosing = Boolean(options?.isTitleOrClosing || options?.layout === "title" || options?.layout === "closing");
  const slideLabel = options?.slideIdx !== undefined ? `Slide ${options.slideIdx}` : "Slide";
  const layoutLabel = options?.layout || (isTitleOrClosing ? "title/closing" : "content");

  // Pick first unused ID in deck
  let chosen: StockImageResult | undefined;
  if (candidates.length > 0) {
    if (usedPhotoIds) {
      chosen = candidates.find((p) => !p.id || !usedPhotoIds.has(p.id));
    } else {
      chosen = candidates[0];
    }
  }

  if (chosen) {
    if (usedPhotoIds && chosen.id) {
      usedPhotoIds.add(chosen.id);
    }
    if (chosen.source === "unsplash" && chosen.downloadLocation) {
      trackUnsplashDownload(chosen.downloadLocation).catch(() => {});
    }
    console.log(
      `[SlideImage] ${slideLabel} (${layoutLabel}): image resolved (provider: ${chosen.source}, photoId: ${chosen.id || "url"}, query: "${query}")`
    );
    return chosen;
  }

  // No unused candidates available from API
  const failureReason = candidates.length > 0 ? "all_candidates_used" : searchResult.reason;

  // Curated fallbacks may ONLY be used for title or closing slides
  if (isTitleOrClosing) {
    const fallback = getFallbackForKeyword(query, usedPhotoIds);
    if (fallback) {
      if (usedPhotoIds && fallback.id) {
        usedPhotoIds.add(fallback.id);
      }
      console.log(
        `[SlideImage] ${slideLabel} (${layoutLabel}): assigned curated fallback (provider: curated, reason: ${failureReason}, photoId: ${fallback.id || "url"}, query: "${query}")`
      );
      return fallback;
    }
  }

  // Content slides are left WITHOUT an image rather than using an unrelated curated photo
  console.log(
    `[SlideImage] ${slideLabel} (${layoutLabel}): left without image (reason: ${failureReason}, query: "${query}")`
  );
  return null;
}

/**
 * Searches multiple stock images for in-editor selection/swapping.
 */
export async function searchMultipleStockImages(query: string, count: number = 6): Promise<StockImageResult[]> {
  const candidates = await searchStockCandidates(query);
  return candidates.slice(0, count);
}

export const BANNED_GENERIC_WORDS = new Set([
  "data", "energy", "success", "technology", "tech", "business", "growth",
  "finance", "analytics", "abstract", "network", "cloud", "security",
  "teamwork", "ai", "money", "graph", "computer", "strategy", "innovation",
  "concept", "idea", "meeting", "office", "presentation", "corporate",
  "information", "work", "people", "future", "digital", "management",
  "solution", "leadership", "partnership", "handshake"
]);

export interface ImageQueryValidationResult {
  valid: boolean;
  query?: string;
  reason?: "missing_query" | "too_short_min_2_words" | "generic_abstract_word" | "generic_abstract_phrase" | "duplicate_in_deck";
}

/**
 * Validates and normalizes an image query:
 * - Rejects prefixes like 'a photo of', 'picture of', 'image of'
 * - Enforces 2 to 4 words describing a concrete visual subject
 * - Rejects bare one-word abstracts or generic multi-word combos (e.g., 'energy', 'data', 'business meeting')
 * - Enforces uniqueness across the deck if usedQueriesInDeck is provided
 */
export function validateAndCleanImageQuery(
  rawQuery: string | undefined | null,
  usedQueriesInDeck?: Set<string>
): ImageQueryValidationResult {
  if (!rawQuery || typeof rawQuery !== "string") {
    return { valid: false, reason: "missing_query" };
  }

  // 1. Strip common filler prefixes
  let cleaned = rawQuery
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^(?:(?:a|an)\s+)?(?:photo|picture|image|photograph|shot)\s+of\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  // 2. Tokenize words
  const words = cleaned.split(/\s+/).filter(Boolean);

  if (words.length < 2) {
    return { valid: false, reason: "too_short_min_2_words" };
  }

  // Cap to 4 words
  const normalizedWords = words.slice(0, 4);
  const finalQuery = normalizedWords.join(" ");
  const lowerWords = normalizedWords.map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ""));

  // 3. Reject generic abstract terms or generic combos
  const allGeneric = lowerWords.every((w) => BANNED_GENERIC_WORDS.has(w) || w.length <= 2);
  if (allGeneric) {
    return { valid: false, reason: "generic_abstract_phrase" };
  }

  // 4. Check uniqueness across the deck
  const queryKey = finalQuery.toLowerCase();
  if (usedQueriesInDeck && usedQueriesInDeck.has(queryKey)) {
    return { valid: false, reason: "duplicate_in_deck" };
  }

  return { valid: true, query: finalQuery };
}

/**
 * Checks whether a slide is a data-heavy bullet list:
 * If a bullets slide contains >= 2 points with numbers/metrics/percentages/currencies,
 * or >= 50% of its points are data-driven, text readability must come first and image is skipped.
 */
export function isDataHeavyBulletList(slide: { layout?: string; content?: any }): boolean {
  if (slide.layout !== "bullets") return false;
  const content = slide.content;
  if (!content) return false;

  const points: string[] = Array.isArray(content.points)
    ? content.points
    : Array.isArray(content.bullets)
    ? content.bullets
    : [];

  if (points.length === 0) return false;

  const hasDataMetric = (text: string) => {
    return (
      /\b\d+(?:[.,]\d+)?%?\b/.test(text) ||
      /[$₹€£]\s*\d+/.test(text) ||
      /\b\d+\s*(?:k|m|b|cr|crore|lakh|percent|bps)\b/i.test(text)
    );
  };

  const dataPointCount = points.filter((p) => typeof p === "string" && hasDataMetric(p)).length;
  return dataPointCount >= 2 || (points.length > 0 && dataPointCount / points.length >= 0.5);
}

