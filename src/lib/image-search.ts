/**
 * src/lib/image-search.ts
 *
 * Fetches stock images from Unsplash or Pexels API with graceful fallback.
 * A failure never throws or breaks slide generation.
 * Follows Unsplash API Attribution and Download Tracking Guidelines.
 */

export interface StockImageResult {
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
    url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80",
    thumb: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&q=80",
    photographer: "Sean Pollock",
    photographerUrl: "https://unsplash.com/@seanpollock",
    source: "curated",
  },
  tech: {
    url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80",
    thumb: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=80",
    photographer: "Alexandre Debiève",
    photographerUrl: "https://unsplash.com/@alexandre_debieve",
    source: "curated",
  },
  teamwork: {
    url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80",
    thumb: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=400&q=80",
    photographer: "Annie Spratt",
    photographerUrl: "https://unsplash.com/@anniespratt",
    source: "curated",
  },
  data: {
    url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80",
    thumb: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=400&q=80",
    photographer: "Luke Chesser",
    photographerUrl: "https://unsplash.com/@lukechesser",
    source: "curated",
  },
  creative: {
    url: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1600&q=80",
    thumb: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=400&q=80",
    photographer: "Alesia Kazantceva",
    photographerUrl: "https://unsplash.com/@alekazan",
    source: "curated",
  },
  default: {
    url: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80",
    thumb: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=400&q=80",
    photographer: "Austin Distel",
    photographerUrl: "https://unsplash.com/@austindistel",
    source: "curated",
  },
};

export function getFallbackForKeyword(keyword: string): StockImageResult {
  const lower = keyword.toLowerCase();
  for (const [key, fallback] of Object.entries(CURATED_FALLBACKS)) {
    if (lower.includes(key)) {
      return fallback;
    }
  }
  return CURATED_FALLBACKS.default;
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

/**
 * Searches Unsplash or Pexels for a stock image matching the keyword.
 * Returns curated fallback if API keys are missing or request fails.
 * Automatically triggers Unsplash download tracking when an Unsplash image is chosen.
 */
export async function searchStockImage(keyword: string): Promise<StockImageResult> {
  const query = (keyword || "business presentation").trim();

  // 1. Try Unsplash API
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  if (unsplashKey) {
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
        {
          headers: { Authorization: `Client-ID ${unsplashKey}` },
          next: { revalidate: 3600 },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const photo = data.results?.[0];
        if (photo) {
          const downloadLocation = photo.links?.download_location;
          // Trigger Unsplash download tracking asynchronously
          if (downloadLocation) {
            trackUnsplashDownload(downloadLocation).catch(() => {});
          }

          return {
            url: photo.urls.regular,
            thumb: photo.urls.thumb || photo.urls.small,
            photographer: photo.user?.name || "Unsplash Creator",
            photographerUrl: photo.user?.links?.html || `https://unsplash.com/@${photo.user?.username || ""}`,
            source: "unsplash",
            downloadLocation,
          };
        }
      }
    } catch {
      // Fall through to Pexels / Fallback
    }
  }

  // 2. Try Pexels API
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (pexelsKey) {
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
        {
          headers: { Authorization: pexelsKey },
          next: { revalidate: 3600 },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const photo = data.photos?.[0];
        if (photo) {
          return {
            url: photo.src.large2x || photo.src.large,
            thumb: photo.src.medium || photo.src.small,
            photographer: photo.photographer || "Pexels Creator",
            photographerUrl: photo.photographer_url,
            source: "pexels",
          };
        }
      }
    } catch {
      // Fall through to Fallback
    }
  }

  // 3. Graceful Curated Fallback
  return getFallbackForKeyword(query);
}

/**
 * Searches multiple stock images for in-editor selection/swapping.
 */
export async function searchMultipleStockImages(query: string, count: number = 6): Promise<StockImageResult[]> {
  const q = (query || "business").trim();
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;

  if (unsplashKey) {
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${count}&orientation=landscape`,
        { headers: { Authorization: `Client-ID ${unsplashKey}` } }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.results) && data.results.length > 0) {
          return data.results.map((photo: any) => ({
            url: photo.urls.regular,
            thumb: photo.urls.thumb || photo.urls.small,
            photographer: photo.user?.name || "Unsplash Creator",
            photographerUrl: photo.user?.links?.html || `https://unsplash.com/@${photo.user?.username || ""}`,
            source: "unsplash",
            downloadLocation: photo.links?.download_location,
          }));
        }
      }
    } catch {
      // Fall through
    }
  }

  // Fallback results
  return Object.values(CURATED_FALLBACKS).slice(0, count);
}
