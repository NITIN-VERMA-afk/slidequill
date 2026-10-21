import crypto from "crypto";
import Deck from "@/app/models/Deck";
import User from "@/app/models/User";

/**
 * Generates a high-entropy URL-safe share slug (16 chars from 12 random bytes).
 */
export function generateShareSlug(): string {
  return crypto.randomBytes(12).toString("base64url");
}

/**
 * Generates a unique share slug, retrying on collision against existing decks.
 */
export async function generateUniqueShareSlug(): Promise<string> {
  const MAX_RETRIES = 5;
  for (let i = 0; i < MAX_RETRIES; i++) {
    const candidate = generateShareSlug();
    const existing = await Deck.exists({ "share.slug": candidate });
    if (!existing) {
      return candidate;
    }
  }
  // Safe fallback if repeated collision occurs
  return `${crypto.randomBytes(9).toString("base64url")}${Date.now().toString(36)}`;
}

export interface PublicSlide {
  id: string;
  layout: string;
  title: string;
  content: any;
}

export interface PublicDeckPayload {
  title: string;
  theme: string;
  slides: PublicSlide[];
  showWatermark: boolean;
}

/**
 * Sanitizes nested content fields using an EXPLICIT allow-list per layout.
 * Any unapproved, internal, or canary fields inside content are completely excluded.
 */
export function sanitizePublicContent(layout: string, content: any): Record<string, any> {
  if (!content || typeof content !== "object") return {};

  const cleanImageFields = (src: any) => {
    const res: Record<string, any> = {};
    if (typeof src.imageUrl === "string") res.imageUrl = src.imageUrl;
    if (typeof src.imageQuery === "string") res.imageQuery = src.imageQuery;
    if (typeof src.imagePlacement === "string") res.imagePlacement = src.imagePlacement;
    if (typeof src.photographer === "string") res.photographer = src.photographer;
    if (typeof src.photographerUrl === "string") res.photographerUrl = src.photographerUrl;
    return res;
  };

  switch (layout) {
    case "title": {
      const out: Record<string, any> = { ...cleanImageFields(content) };
      if (typeof content.subtitle === "string") out.subtitle = content.subtitle;
      return out;
    }
    case "bullets": {
      const out: Record<string, any> = { ...cleanImageFields(content) };
      if (Array.isArray(content.bullets)) {
        out.bullets = content.bullets.map((b: any) => String(b ?? ""));
      }
      if (Array.isArray(content.icons)) {
        out.icons = content.icons.filter((ic: any) => typeof ic === "string");
      }
      return out;
    }
    case "two_column": {
      const out: Record<string, any> = { ...cleanImageFields(content) };
      if (content.left && typeof content.left === "object") {
        out.left = {
          heading: typeof content.left.heading === "string" ? content.left.heading : undefined,
          bullets: Array.isArray(content.left.bullets) ? content.left.bullets.map((b: any) => String(b ?? "")) : [],
        };
      }
      if (content.right && typeof content.right === "object") {
        out.right = {
          heading: typeof content.right.heading === "string" ? content.right.heading : undefined,
          bullets: Array.isArray(content.right.bullets) ? content.right.bullets.map((b: any) => String(b ?? "")) : [],
        };
      }
      return out;
    }
    case "stats": {
      const out: Record<string, any> = {};
      if (Array.isArray(content.stats)) {
        out.stats = content.stats.map((s: any) => ({
          value: String(s?.value ?? ""),
          label: String(s?.label ?? ""),
          icon: typeof s?.icon === "string" ? s.icon : undefined,
        }));
      }
      return out;
    }
    case "process": {
      const out: Record<string, any> = {};
      if (Array.isArray(content.steps)) {
        out.steps = content.steps.map((st: any) => ({
          label: String(st?.label ?? ""),
          desc: String(st?.desc ?? ""),
          icon: typeof st?.icon === "string" ? st.icon : undefined,
        }));
      }
      return out;
    }
    case "comparison": {
      const out: Record<string, any> = {};
      if (Array.isArray(content.columns)) {
        out.columns = content.columns.map((c: any) => ({
          heading: String(c?.heading ?? ""),
          bullets: Array.isArray(c?.bullets) ? c.bullets.map((b: any) => String(b ?? "")) : [],
        }));
      }
      return out;
    }
    case "quote": {
      const out: Record<string, any> = { ...cleanImageFields(content) };
      if (typeof content.quote === "string") out.quote = content.quote;
      if (typeof content.attribution === "string") out.attribution = content.attribution;
      return out;
    }
    case "closing": {
      const out: Record<string, any> = { ...cleanImageFields(content) };
      if (typeof content.headline === "string") out.headline = content.headline;
      if (typeof content.cta === "string") out.cta = content.cta;
      return out;
    }
    case "chart": {
      const out: Record<string, any> = {};
      if (typeof content.chartType === "string") out.chartType = content.chartType;
      if (typeof content.chartTitle === "string") out.chartTitle = content.chartTitle;
      if (Array.isArray(content.categories)) {
        out.categories = content.categories.map((c: any) => String(c ?? ""));
      }
      if (Array.isArray(content.series)) {
        out.series = content.series.map((sr: any) => ({
          name: String(sr?.name ?? ""),
          values: Array.isArray(sr?.values) ? sr.values.map(Number) : [],
        }));
      }
      if (typeof content.caption === "string") out.caption = content.caption;
      return out;
    }
    case "image": {
      const out: Record<string, any> = { ...cleanImageFields(content) };
      if (typeof content.variant === "string") out.variant = content.variant;
      if (typeof content.imageKeyword === "string") out.imageKeyword = content.imageKeyword;
      if (typeof content.caption === "string") out.caption = content.caption;
      if (typeof content.heading === "string") out.heading = content.heading;
      if (Array.isArray(content.bullets)) {
        out.bullets = content.bullets.map((b: any) => String(b ?? ""));
      }
      return out;
    }
    default: {
      const out: Record<string, any> = { ...cleanImageFields(content) };
      if (Array.isArray(content.bullets)) {
        out.bullets = content.bullets.map((b: any) => String(b ?? ""));
      }
      return out;
    }
  }
}

/**
 * Builds public slide object using an EXPLICIT allow-list.
 * Excludes notes, _stash, sourcePage, sourcePageApprox, sourceSection, regenerations, userId, sourceText, chat.
 */
export function toPublicSlide(slide: any): PublicSlide {
  const layout = String(slide.layout || "bullets");
  const cleanContent = sanitizePublicContent(layout, slide.content);

  return {
    id: String(slide.id || ""),
    layout,
    title: String(slide.title || ""),
    content: cleanContent,
  };
}

/**
 * Formats public deck response.
 * Uses owner's hasPurchased status purely server-side to set showWatermark.
 * Never leaks hasPurchased or owner credentials to the client.
 */
export async function buildPublicDeckPayload(deck: any): Promise<PublicDeckPayload> {
  let showWatermark = true;
  if (deck.userId) {
    const owner = await User.findById(deck.userId).select("hasPurchased").lean();
    if (owner && owner.hasPurchased === true) {
      showWatermark = false;
    }
  }

  const slides = Array.isArray(deck.slides)
    ? deck.slides.map(toPublicSlide)
    : [];

  return {
    title: String(deck.title || "Untitled Deck"),
    theme: String(deck.theme || "modern"),
    slides,
    showWatermark,
  };
}

/**
 * Headers enforcing immediate revocation (zero caching), bot blocking, and referrer privacy.
 */
export const PUBLIC_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  "Surrogate-Control": "no-store",
  Pragma: "no-cache",
  Expires: "0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
} as const;
