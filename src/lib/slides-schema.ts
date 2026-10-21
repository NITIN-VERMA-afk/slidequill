import { z } from "zod";

export function countWords(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function truncateWordsAndChars(
  text: any,
  maxWords: number,
  maxChars: number,
  onTruncate?: () => void
): string {
  if (text === null || text === undefined) return "";
  let clean = (typeof text === "string" ? text : String(text)).trim().replace(/\s+/g, " ");
  if (!clean) return "";

  let wasTruncated = false;
  if (clean.length > maxChars) {
    const cut = clean.slice(0, maxChars);
    const lastSpace = cut.lastIndexOf(" ");
    clean = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim().replace(/[.,;:\s]+$/, "") + "…";
    wasTruncated = true;
  }
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length > maxWords) {
    clean = words.slice(0, maxWords).join(" ").trim().replace(/[.,;:\s]+$/, "") + "…";
    wasTruncated = true;
  }

  if (wasTruncated && onTruncate) {
    onTruncate();
  }
  return clean;
}

// Text constraints to prevent overflowing slides
export const textRule = (maxWords: number, maxChars: number) =>
  z
    .string()
    .max(maxChars, { message: `Max ${maxChars} characters` })
    .refine((s) => countWords(s) <= maxWords, {
      message: `Max ${maxWords} words`,
    });

export const ALLOWED_ICONS = [
  "TrendingUp",
  "TrendingDown",
  "BarChart2",
  "PieChart",
  "Users",
  "Target",
  "Shield",
  "CheckCircle2",
  "Award",
  "Zap",
  "Globe",
  "DollarSign",
  "Briefcase",
  "Clock",
  "Activity",
  "Cpu",
  "Layers",
  "Compass",
  "Rocket",
  "Search",
  "Star",
  "Heart",
  "FileText",
  "Settings",
  "Lock",
  "Cloud",
  "Database",
  "Calendar",
  "Flag",
  "Lightbulb",
] as const;

export type AllowedIcon = (typeof ALLOWED_ICONS)[number];

export const IconSchema = z.enum(ALLOWED_ICONS).optional();

export const ImagePlacementSchema = z.enum(["right", "background", "none"]).optional();

export const SlideLayouts = z.discriminatedUnion("layout", [
  z.object({
    layout: z.literal("title"),
    content: z.object({
      subtitle: textRule(15, 120).optional(),
      imageQuery: textRule(4, 35).optional(),
      imagePlacement: ImagePlacementSchema,
      imageUrl: z.string().optional(),
      photographer: z.string().max(80).optional(),
      photographerUrl: z.string().optional(),
    }),
  }),
  z.object({
    layout: z.literal("bullets"),
    content: z.object({
      bullets: z.array(textRule(12, 90)).min(3).max(6),
      icons: z.array(IconSchema).optional(),
      imageQuery: textRule(4, 35).optional(),
      imagePlacement: ImagePlacementSchema,
      imageUrl: z.string().optional(),
      photographer: z.string().max(80).optional(),
      photographerUrl: z.string().optional(),
    }),
  }),
  z.object({
    layout: z.literal("two_column"),
    content: z.object({
      left: z.object({
        heading: textRule(6, 45).optional(),
        bullets: z.array(textRule(12, 85)).min(2).max(4),
      }),
      right: z.object({
        heading: textRule(6, 45).optional(),
        bullets: z.array(textRule(12, 85)).min(2).max(4),
      }),
      imageQuery: textRule(4, 35).optional(),
      imagePlacement: ImagePlacementSchema,
      imageUrl: z.string().optional(),
      photographer: z.string().max(80).optional(),
      photographerUrl: z.string().optional(),
    }),
  }),
  z.object({
    layout: z.literal("stats"),
    content: z.object({
      stats: z
        .array(
          z.object({
            value: textRule(4, 25),
            label: textRule(8, 55),
            icon: IconSchema,
          })
        )
        .min(2)
        .max(4),
    }),
  }),
  z.object({
    layout: z.literal("process"),
    content: z.object({
      steps: z
        .array(
          z.object({
            label: textRule(5, 40),
            desc: textRule(10, 80),
            icon: IconSchema,
          })
        )
        .min(3)
        .max(5),
    }),
  }),
  z.object({
    layout: z.literal("comparison"),
    content: z.object({
      columns: z
        .array(
          z.object({
            heading: textRule(5, 40),
            bullets: z.array(textRule(10, 75)).min(2).max(4),
          })
        )
        .min(2)
        .max(3),
    }),
  }),
  z.object({
    layout: z.literal("quote"),
    content: z.object({
      quote: textRule(30, 220),
      attribution: textRule(8, 60).optional(),
      imageQuery: textRule(4, 35).optional(),
      imagePlacement: ImagePlacementSchema,
      imageUrl: z.string().optional(),
      photographer: z.string().max(80).optional(),
      photographerUrl: z.string().optional(),
    }),
  }),
  z.object({
    layout: z.literal("closing"),
    content: z.object({
      headline: textRule(8, 65),
      cta: textRule(10, 65).optional(),
      imageQuery: textRule(4, 35).optional(),
      imagePlacement: ImagePlacementSchema,
      imageUrl: z.string().optional(),
      photographer: z.string().max(80).optional(),
      photographerUrl: z.string().optional(),
    }),
  }),
  z.object({
    layout: z.literal("chart"),
    content: z.object({
      chartType: z.enum(["bar", "line", "pie"]).default("bar"),
      chartTitle: textRule(8, 60).optional(),
      categories: z.array(textRule(4, 25)).min(2).max(8),
      series: z
        .array(
          z.object({
            name: textRule(4, 30),
            values: z.array(z.number()),
          })
        )
        .min(1)
        .max(3),
      caption: textRule(15, 100).optional(),
    }),
  }),
  z.object({
    layout: z.literal("image"),
    content: z.object({
      variant: z.enum(["split", "full_bleed"]).default("split"),
      imageUrl: z.string().optional(),
      imageKeyword: textRule(4, 35).describe("Search keyword for image e.g. 'office teamwork'"),
      imageQuery: textRule(4, 35).optional(),
      imagePlacement: ImagePlacementSchema,
      caption: textRule(15, 120).optional(),
      photographer: z.string().max(80).optional(),
      photographerUrl: z.string().optional(),
      heading: textRule(6, 45).optional(),
      bullets: z.array(textRule(12, 85)).max(4).optional(),
    }),
  }),
]);

export const SlideSchema = z
  .object({
    title: textRule(8, 65).describe(
      "State the conclusion, not just a topic. E.g. 'Sales Grew 40%' instead of 'Sales Data'."
    ),
    notes: z.string().max(500).describe("Short speaker notes for this slide (1-2 sentences)."),
    sourcePage: z.union([z.string(), z.number()]).optional(),
    sourcePageApprox: z.boolean().optional(),
    sourceSection: z.string().max(120).optional(),
    meta: z
      .object({
        fallback: z.boolean().optional(),
      })
      .optional(),
  })
  .and(SlideLayouts);

export type SlideData = z.infer<typeof SlideSchema> & { id: string; regenerations?: number };

export interface SanitizeStats {
  truncations: number;
}

/**
 * Formats a page range, single number, or string deterministically into a clean string.
 * Supports single page ("18") and page ranges ("18-20").
 * Returns undefined if sourcePageCount is missing, bounds are invalid, or numbers are non-positive.
 */
export function formatSourcePage(
  pageInput?: { start?: number; end?: number } | number | string | null,
  maxPages?: number,
  approx?: boolean
): string | undefined {
  if (pageInput === undefined || pageInput === null) return undefined;

  let isApprox = Boolean(approx);

  if (typeof pageInput === "object") {
    const start = pageInput.start;
    const end = pageInput.end;
    if (typeof start !== "number" || isNaN(start) || start < 1) return undefined;
    if (maxPages && start > maxPages) return undefined;
    const approxSuffix = isApprox ? " (approx.)" : "";
    if (typeof end === "number" && !isNaN(end) && end > start) {
      const validEnd = maxPages ? Math.min(end, maxPages) : end;
      return `${start}-${validEnd}${approxSuffix}`;
    }
    return `${start}${approxSuffix}`;
  }

  if (typeof pageInput === "number") {
    if (isNaN(pageInput) || pageInput < 1) return undefined;
    if (maxPages && pageInput > maxPages) return undefined;
    const approxSuffix = isApprox ? " (approx.)" : "";
    return `${Math.floor(pageInput)}${approxSuffix}`;
  }

  if (typeof pageInput === "string") {
    const trimmed = pageInput.trim();
    if (!trimmed) return undefined;
    if (/\(approx\.?\)/i.test(trimmed)) {
      isApprox = true;
    }
    const cleanStr = trimmed.replace(/\s*\((?:approx|approx\.)\)/gi, "").trim();
    const match =
      cleanStr.match(/^(?:pp|pages|page|p)\.?\s*(\d+)(?:\s*[-–—]\s*(\d+))?$/i) ||
      cleanStr.match(/^(\d+)(?:\s*[-–—]\s*(\d+))?$/);
    if (!match) return undefined;
    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : undefined;
    if (isNaN(start) || start < 1) return undefined;
    if (maxPages && start > maxPages) return undefined;
    const approxSuffix = isApprox ? " (approx.)" : "";
    if (end !== undefined && !isNaN(end) && end > start) {
      const validEnd = maxPages ? Math.min(end, maxPages) : end;
      return `${start}-${validEnd}${approxSuffix}`;
    }
    return `${start}${approxSuffix}`;
  }

  return undefined;
}

/**
 * Validates and sanitizes sourcePage:
 * - Only populated when extractor provides real page boundaries (sourcePageCount >= 1).
 * - Strips sourcePage for DOCX/text or missing boundaries.
 * - Enforces 1 <= sourcePage <= sourcePageCount. Rejects hallucinated numbers.
 */
export function validateAndSanitizeSourcePage(
  rawPage: unknown,
  sourcePageCount?: number
): string | undefined {
  if (!sourcePageCount || typeof sourcePageCount !== "number" || sourcePageCount < 1) {
    return undefined;
  }
  return formatSourcePage(rawPage as any, sourcePageCount);
}

/**
 * Constructs a standardized source citation for speaker notes.
 * Format examples:
 * - "Source: Annual_Report.pdf, pages 18-20"
 * - "Source: Annual_Report.pdf, pages 18-20 (approx.)"
 * - "Source: Annual_Report.pdf, page 18"
 * - "Source: Product_Roadmap.docx, section: Executive Overview"
 * - "Source: pasted text, section: Quarterly Financial Analysis"
 * - "Source: pasted text"
 */
export function buildSourceCitation(
  sourceName?: string,
  sourcePage?: string | number,
  sourceSection?: string,
  sourcePageApprox?: boolean
): string {
  const docName = (sourceName && sourceName.trim()) || "pasted text";
  const hasPage = sourcePage !== undefined && sourcePage !== null && String(sourcePage).trim().length > 0;
  const isApprox = Boolean(sourcePageApprox || (hasPage && /\(approx\.?\)/i.test(String(sourcePage))));

  // Keep approximate pages out of the citation: cite exact page when verified, otherwise cite section only
  if (hasPage && !isApprox) {
    const rawPageStr = String(sourcePage).trim();
    const cleanPage = rawPageStr.replace(/\s*\((?:approx|approx\.)\)/gi, "").trim();
    const label = cleanPage.includes("-") ? "pages" : "page";
    return `Source: ${docName}, ${label} ${cleanPage}`;
  }
  if (sourceSection && sourceSection.trim()) {
    return `Source: ${docName}, section: ${sourceSection.trim()}`;
  }
  return `Source: ${docName}`;
}

/**
 * Normalizes source text for numerical and factual grounding checks:
 * 1. Converts Devanagari numerals (०-९) to ASCII digits (0-9).
 * 2. Removes page markers: "--- [Page N] ---", "page 18", "p. 18", "pp. 18-20".
 * 3. Removes full dates (e.g. "15/03/2024", "March 15, 2024", "15 March 2024").
 * 4. Removes 4-digit calendar years: 1900-2100.
 * 5. Removes list indices: "1.", "2)", "3.", etc.
 * 6. Removes standalone integers below 32 that do not have a currency symbol,
 *    percent sign, or unit (M, Cr, K, bn, etc.).
 */
export function cleanSourceForGrounding(sourceText: string): string {
  if (!sourceText || typeof sourceText !== "string") return "";

  // 1. Devanagari numerals to ASCII
  const devanagariMap: Record<string, string> = {
    "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
    "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
  };
  let text = sourceText.replace(/[०-९]/g, (ch) => devanagariMap[ch] || ch);

  // 2. Remove page markers: "--- [Page N] ---", "page 18", "p. 18", "pp. 18-20"
  text = text.replace(/---\s*\[Page\s+\d+\]\s*---/gi, " ");
  text = text.replace(/\b(?:pages?|pp?\.?)\s*\d+(?:\s*[-–—]\s*\d+)?\b/gi, " ");

  // 3. Remove dates
  text = text.replace(/\b\d{1,4}[/-]\d{1,2}[/-]\d{1,4}\b/g, " ");
  const monthPattern = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
  const monthDateRegex1 = new RegExp(`\\b${monthPattern}\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?\\b`, "gi");
  const monthDateRegex2 = new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${monthPattern}(?:,?\\s+\\d{4})?\\b`, "gi");
  text = text.replace(monthDateRegex1, " ");
  text = text.replace(monthDateRegex2, " ");

  // 4. Remove 4-digit calendar years (1900–2100)
  text = text.replace(/\b(19\d{2}|20\d{2}|2100)\b/g, " ");

  // 5. Remove list indices like "1." or "2)" at start of line or after punctuation
  text = text.replace(/(?:^|[\n\r\.\?!;])\s*\d{1,2}[\.\)]\s+/g, " ");

  // 6. Remove standalone integers below 32 that lack currency symbol, percent sign, or unit (without matching decimals)
  text = text.replace(
    /(?<![\d\.])([$₹€£]\s*)?\b(\d{1,2})\b(?!\.\d)(\s*(?:%|[a-zA-Z]+))?(?![\d\.])/g,
    (match, prefix, digits, suffix) => {
      const val = parseInt(digits, 10);
      if (val < 32) {
        const hasPrefix = Boolean(prefix && prefix.trim().length > 0);
        const hasSuffix = Boolean(
          suffix &&
            /%|m(?:illion)?|b(?:illion)?|bn|k(?:k)?|cr(?:ore)?|lakh|percent/i.test(
              suffix.trim()
            )
        );
        if (!hasPrefix && !hasSuffix) {
          return " ";
        }
      }
      return match;
    }
  );

  return text;
}

/**
 * Cleans source text for chart category grounding:
 * - Converts Devanagari numerals (०-९) to ASCII digits (0-9).
 * - Removes page markers: "--- [Page N] ---", "page 18", "p. 18", "pp. 18-20".
 * - Keeps calendar years, fiscal quarters (e.g. 2023, FY24, Q3), dates, small integers, and text.
 */
export function cleanSourceForCategoryGrounding(sourceText: string): string {
  if (!sourceText || typeof sourceText !== "string") return "";

  // 1. Devanagari numerals to ASCII
  const devanagariMap: Record<string, string> = {
    "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
    "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
  };
  let text = sourceText.replace(/[०-९]/g, (ch) => devanagariMap[ch] || ch);

  // 2. Remove page markers: "--- [Page N] ---", "page 18", "p. 18", "pp. 18-20"
  text = text.replace(/---\s*\[Page\s+\d+\]\s*---/gi, " ");
  text = text.replace(/\b(?:pages?|pp?\.?)\s*\d+(?:\s*[-–—]\s*\d+)?\b/gi, " ");

  return text;
}

/**
 * Checks if a numeric value appears in the source text, tolerating magnitude and formatting
 * such as "$20.4M" vs 20.4 or 20,400,000, "21.0%" vs 21 or 0.21, "48,000" vs 48000 or 48, "₹28.7Cr" vs 28.7.
 * Ignores page numbers, 4-digit years, dates, list indices, and bare integers below 32.
 */
export function isNumberInSource(num: number, sourceText: string): boolean {
  if (typeof num !== "number" || isNaN(num) || !sourceText || typeof sourceText !== "string") {
    return false;
  }

  const cleaned = cleanSourceForGrounding(sourceText);
  if (!cleaned.trim()) return false;

  // Token scanner matching currency amounts, percentages, and metrics with magnitude units
  const tokenRegex =
    /(?:([$₹€£])\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)\s*(%|[a-zA-Z]+)?/g;

  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(cleaned)) !== null) {
    const currency = match[1];
    const rawDigits = match[2].replace(/,/g, "");
    const unit = (match[3] || "").toLowerCase().trim();

    const baseVal = parseFloat(rawDigits);
    if (isNaN(baseVal)) continue;

    // Filter standalone integers < 32 without currency or valid unit
    if (Number.isInteger(baseVal) && baseVal < 32 && !currency && !unit) {
      continue;
    }

    const candidates: number[] = [baseVal];

    if (unit === "%" || unit === "percent") {
      candidates.push(baseVal / 100);
    } else if (unit === "k" || unit === "thousand") {
      candidates.push(baseVal * 1_000);
    } else if (unit === "m" || unit === "million") {
      candidates.push(baseVal * 1_000_000);
    } else if (unit === "b" || unit === "bn" || unit === "billion") {
      candidates.push(baseVal * 1_000_000_000);
    } else if (unit === "cr" || unit === "crore") {
      candidates.push(baseVal * 10_000_000); // 1 Crore = 10,000,000
    } else if (unit === "lakh") {
      candidates.push(baseVal * 100_000);
    }

    // Inverse scaling support (e.g. source 20,400,000 vs plotted 20.4 in millions)
    if (baseVal >= 1_000_000) {
      candidates.push(baseVal / 1_000_000);
    }
    if (baseVal >= 10_000_000) {
      candidates.push(baseVal / 10_000_000);
    }
    if (baseVal >= 1_000) {
      candidates.push(baseVal / 1_000);
    }

    for (const cand of candidates) {
      if (Math.abs(cand - num) < 0.0001) {
        return true;
      }
      if (num !== 0 && Math.abs(cand - num) / Math.abs(num) < 0.0001) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extracts all unique grounded numeric values from source text using the exact same
 * cleaning and token-scanning rules as isNumberInSource and grounding checks.
 * Strips page markers, 4-digit years, dates, list indices, and bare integers < 32.
 */
export function extractGroundedNumbersFromSource(sourceText?: string): number[] {
  if (!sourceText || typeof sourceText !== "string" || !sourceText.trim()) {
    return [];
  }

  const cleaned = cleanSourceForGrounding(sourceText);
  if (!cleaned.trim()) return [];

  const tokenRegex =
    /(?:([$₹€£])\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)\s*(%|[a-zA-Z]+)?/g;

  const groundedValues: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(cleaned)) !== null) {
    const currency = match[1];
    const rawDigits = match[2].replace(/,/g, "");
    const unit = (match[3] || "").toLowerCase().trim();

    const baseVal = parseFloat(rawDigits);
    if (isNaN(baseVal)) continue;

    // Filter standalone integers < 32 without currency or valid unit
    if (Number.isInteger(baseVal) && baseVal < 32 && !currency && !unit) {
      continue;
    }

    groundedValues.push(baseVal);
  }

  return Array.from(new Set(groundedValues));
}

/**
 * Counts the number of distinct grounded numeric values in an excerpt using cleanSourceForGrounding and isNumberInSource logic.
 */
export function countGroundedNumbersInExcerpt(excerpt?: string): number {
  return extractGroundedNumbersFromSource(excerpt).length;
}

/**
 * Fallback converter for charts that cannot be grounded:
 * - If 2 to 4 grounded data points exist with labels, converts to stats layout.
 * - Otherwise converts to bullets layout with takeaway summaries.
 * - Never invents or pads data.
 */
export function convertChartToFallbackLayout<T extends { title?: string; notes?: string; content?: any; layout?: string }>(
  slide: T,
  sourceText?: string,
  talkingPoints?: string[]
): T {
  const content = slide.content || {};
  const categories: string[] = Array.isArray(content.categories) ? content.categories : [];

  // Convert to bullets layout without inventing placeholder/apology text
  const bullets: string[] = [];
  if (content.caption && typeof content.caption === "string" && content.caption.trim()) {
    bullets.push(truncateWordsAndChars(content.caption, 12, 90));
  }
  if (Array.isArray(content.bullets)) {
    for (const b of content.bullets) {
      if (b && typeof b === "string" && b.trim() && bullets.length < 4) {
        bullets.push(truncateWordsAndChars(b, 12, 90));
      }
    }
  }
  if (bullets.length < 4 && Array.isArray(talkingPoints)) {
    for (const pt of talkingPoints) {
      if (pt && typeof pt === "string" && pt.trim() && bullets.length < 4) {
        bullets.push(truncateWordsAndChars(pt, 12, 90));
      }
    }
  }
  for (const cat of categories) {
    if (cat && typeof cat === "string" && cat.trim() && bullets.length < 4) {
      bullets.push(truncateWordsAndChars(cat, 12, 90));
    }
  }
  if (bullets.length < 3 && slide.notes && typeof slide.notes === "string" && slide.notes.trim()) {
    bullets.push(truncateWordsAndChars(slide.notes, 12, 90));
  }
  if (bullets.length < 3 && slide.title && typeof slide.title === "string" && slide.title.trim()) {
    bullets.push(truncateWordsAndChars(slide.title, 12, 90));
  }
  while (bullets.length < 3) {
    bullets.push(truncateWordsAndChars(slide.title || "Key Takeaways", 12, 90));
  }

  (slide as any).layout = "bullets";
  (slide as any).content = {
    bullets: bullets.slice(0, 6),
  };
  return slide;
}

/**
 * Enforces strict chart data integrity:
 * - Rejects chart if series is flat (all values equal) or has fewer than 3 distinct values.
 * - Rejects numbers that only match page markers ("--- [Page N] ---", "page 18", "p. 18"),
 *   4-digit years, dates, list indices, or integers below 32 without currency/unit.
 * - Requires at least 3 data points that each match a real value in the source excerpt
 *   (supporting magnitude formatting: "$20.4M" matches 20.4 or 20,400,000).
 * - Category labels must also appear in the source excerpt.
 * - On failure, changes layout to clean bullets or stats fallback without inventing or padding data.
 */
export function validateAndGroundChartSlide<T extends { title?: string; notes?: string; content?: any; layout?: string }>(
  slide: T,
  sourceText?: string,
  talkingPoints?: string[]
): T {
  if (slide.layout !== "chart") return slide;

  const content = slide.content || {};
  const categories: string[] = Array.isArray(content.categories) ? content.categories : [];
  const series: Array<{ name: string; values: number[] }> = Array.isArray(content.series) ? content.series : [];

  if (!sourceText || typeof sourceText !== "string" || !sourceText.trim()) {
    return convertChartToFallbackLayout(slide, undefined, talkingPoints);
  }

  const cleanSource = sourceText.trim();
  const categorySourceText = cleanSourceForCategoryGrounding(cleanSource).toLowerCase();

  // Category labels must appear in the source excerpt (tested against category-cleaned text preserving years/quarters)
  if (categories.length < 2) {
    return convertChartToFallbackLayout(slide, cleanSource, talkingPoints);
  }
  const unicodeSplitRegex = /[^\p{L}\p{N}\p{M}]+/u;
  const categoriesGrounded = categories.every((cat) => {
    if (!cat || typeof cat !== "string") return false;
    const trimmed = cat.trim().toLowerCase();
    if (!trimmed) return false;
    if (categorySourceText.includes(trimmed)) return true;
    const tokens = trimmed
      .split(unicodeSplitRegex)
      .filter((w) => {
        const isDevanagari = /[\u0900-\u097F]/u.test(w);
        return Array.from(w).length >= (isDevanagari ? 2 : 2);
      });
    return tokens.length > 0 && tokens.some((t) => categorySourceText.includes(t));
  });

  if (!categoriesGrounded) {
    return convertChartToFallbackLayout(slide, cleanSource, talkingPoints);
  }

  const allValues: number[] = [];
  for (const ser of series) {
    if (!Array.isArray(ser.values)) {
      return convertChartToFallbackLayout(slide, cleanSource, talkingPoints);
    }
    for (const val of ser.values) {
      if (typeof val !== "number" || isNaN(val)) {
        return convertChartToFallbackLayout(slide, cleanSource, talkingPoints);
      }
      allValues.push(val);
    }
  }

  // Must contain at least 3 data points total
  if (allValues.length < 3) {
    return convertChartToFallbackLayout(slide, cleanSource, talkingPoints);
  }

  // Must contain at least 3 distinct values (rejects flat series like [10, 10, 10, 10] or [10, 10, 20, 20])
  const distinctValues = new Set(allValues);
  if (distinctValues.size < 3) {
    return convertChartToFallbackLayout(slide, cleanSource, talkingPoints);
  }

  // At least 3 data points must match a real value in the source excerpt
  const groundedValues = allValues.filter((val) => isNumberInSource(val, cleanSource));
  if (groundedValues.length < 3 || groundedValues.length !== allValues.length) {
    return convertChartToFallbackLayout(slide, cleanSource, talkingPoints);
  }

  return slide;
}

/**
 * Fallback converter for stats slides when source numbers cannot be grounded or sourceText is missing:
 * - Converts stats items to bullet points.
 * - Fills with talking points or title if needed to ensure at least 3 bullets.
 * - Never invents or pads placeholder/apology data.
 */
export function convertStatsToFallbackLayout<T extends { title?: string; notes?: string; content?: any; layout?: string }>(
  slide: T,
  talkingPoints?: string[]
): T {
  const content = slide.content || {};
  const bullets: string[] = [];

  if (Array.isArray(content.stats)) {
    for (const stat of content.stats) {
      if (stat && typeof stat === "object") {
        if (stat.label && stat.value) {
          bullets.push(truncateWordsAndChars(`${stat.label}: ${stat.value}`, 12, 90));
        } else if (stat.label) {
          bullets.push(truncateWordsAndChars(stat.label, 12, 90));
        }
      }
    }
  }

  if (bullets.length < 4 && Array.isArray(talkingPoints)) {
    for (const pt of talkingPoints) {
      if (pt && typeof pt === "string" && pt.trim() && bullets.length < 4) {
        bullets.push(truncateWordsAndChars(pt, 12, 90));
      }
    }
  }

  if (bullets.length < 3 && slide.notes && typeof slide.notes === "string" && slide.notes.trim()) {
    bullets.push(truncateWordsAndChars(slide.notes, 12, 90));
  }
  if (bullets.length < 3 && slide.title && typeof slide.title === "string" && slide.title.trim()) {
    bullets.push(truncateWordsAndChars(slide.title, 12, 90));
  }
  while (bullets.length < 3) {
    bullets.push(truncateWordsAndChars(slide.title || "Key Takeaways", 12, 90));
  }

  (slide as any).layout = "bullets";
  (slide as any).content = {
    bullets: bullets.slice(0, 6),
  };
  return slide;
}

/**
 * Validates and grounds stats slides:
 * - Checks each stat value against cleanSourceForGrounding using isNumberInSource.
 * - Requires at least one grounded stat in sourceText; otherwise falls back to bullets.
 * - If sourceText is missing/deleted, falls back to bullets immediately.
 */
export function validateAndGroundStatsSlide<T extends { title?: string; notes?: string; content?: any; layout?: string }>(
  slide: T,
  sourceText?: string,
  talkingPoints?: string[]
): T {
  if (slide.layout !== "stats") return slide;

  if (!sourceText || typeof sourceText !== "string" || !sourceText.trim()) {
    return convertStatsToFallbackLayout(slide, talkingPoints);
  }

  const cleanSource = sourceText.trim();
  const content = slide.content || {};
  const stats: Array<{ value: string; label: string; icon?: any }> = Array.isArray(content.stats) ? content.stats : [];

  if (stats.length === 0) {
    return convertStatsToFallbackLayout(slide, talkingPoints);
  }

  // Check if at least one stat contains numbers grounded in cleanSource
  const hasAnyGroundedStat = stats.some((stat) => {
    if (!stat || !stat.value || typeof stat.value !== "string") return false;
    const numbers = stat.value.match(/\d+(?:[.,]\d+)*/g);
    if (!numbers || numbers.length === 0) return false;
    return numbers.some((numStr) => {
      const val = parseFloat(numStr.replace(/,/g, ""));
      return !isNaN(val) && isNumberInSource(val, cleanSource);
    });
  });

  if (!hasAnyGroundedStat) {
    return convertStatsToFallbackLayout(slide, talkingPoints);
  }

  return slide;
}

/**
 * Sanitizes raw AI JSON output before strict validation:
 * - Trims and collapses whitespace
 * - Truncates strings exceeding word or char limits at word boundaries
 * - Caps array sizes to maximums
 * - Validates sourcePage against known page boundaries
 */
export function sanitizeSlidePayload(
  raw: any,
  isFirst: boolean = false,
  isLast: boolean = false,
  stats?: SanitizeStats,
  sourcePageCount?: number,
  sourceText?: string,
  talkingPoints?: string[]
): any {
  if (!raw || typeof raw !== "object") return {};

  const recordTruncate = () => {
    if (stats) stats.truncations++;
  };

  const cleanString = (val: any, maxWords: number, maxChars: number): string => {
    return truncateWordsAndChars(val, maxWords, maxChars, recordTruncate);
  };

  const extractImageFields = (c: any, defaultPlacement?: "right" | "background") => {
    const rawQuery = c.imageQuery || c.imageKeyword;
    const imageQuery = rawQuery ? cleanString(rawQuery, 4, 35) : undefined;
    const placementRaw = typeof c.imagePlacement === "string" ? c.imagePlacement.toLowerCase().trim() : undefined;
    const imagePlacement = (placementRaw === "right" || placementRaw === "background" || placementRaw === "none")
      ? placementRaw
      : imageQuery && defaultPlacement ? defaultPlacement : undefined;
    const imageUrl = typeof c.imageUrl === "string" && c.imageUrl.trim().length > 0 ? c.imageUrl.trim() : undefined;
    const photographer = c.photographer ? String(c.photographer).slice(0, 80) : undefined;
    const photographerUrl = typeof c.photographerUrl === "string" ? c.photographerUrl : undefined;

    return {
      ...(imageQuery ? { imageQuery } : {}),
      ...(imagePlacement ? { imagePlacement } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(photographer ? { photographer } : {}),
      ...(photographerUrl ? { photographerUrl } : {}),
    };
  };

  const layout =
    typeof raw.layout === "string"
      ? raw.layout.toLowerCase().trim()
      : isFirst
      ? "title"
      : isLast
      ? "closing"
      : "bullets";
  const title = cleanString(raw.title || "Key Takeaway", 8, 65);
  const notes = typeof raw.notes === "string" ? raw.notes.trim().slice(0, 500) : "";
  const content = raw.content && typeof raw.content === "object" ? { ...raw.content } : {};
  const meta = raw.meta && typeof raw.meta === "object" ? { ...raw.meta } : undefined;

  let result: any;
  switch (layout) {
    case "title": {
      result = {
        title,
        notes,
        layout: "title",
        content: {
          subtitle: content.subtitle ? cleanString(content.subtitle, 15, 120) : undefined,
          ...extractImageFields(content, "background"),
        },
      };
      break;
    }
    case "bullets": {
      let bullets: string[] = Array.isArray(content.bullets)
        ? content.bullets
            .map((b: any) => cleanString(b, 12, 90))
            .filter((s: string) => s.length > 0)
        : [];
      if (bullets.length > 6) {
        bullets = bullets.slice(0, 6);
        recordTruncate();
      }
      while (bullets.length < 3) {
        bullets.push(`Key point ${bullets.length + 1}`);
      }
      const icons = Array.isArray(content.icons)
        ? content.icons.map((ic: any) => (ALLOWED_ICONS.includes(ic) ? ic : undefined))
        : undefined;
      result = {
        title,
        notes,
        layout: "bullets",
        content: {
          bullets,
          ...(icons ? { icons } : {}),
          ...extractImageFields(content, "right"),
        },
      };
      break;
    }
    case "two_column": {
      const cleanCol = (col: any) => {
        let bullets = Array.isArray(col?.bullets)
          ? col.bullets
              .map((b: any) => cleanString(b, 12, 85))
              .filter((s: string) => s.length > 0)
          : [];
        if (bullets.length > 4) {
          bullets = bullets.slice(0, 4);
          recordTruncate();
        }
        while (bullets.length < 2) bullets.push(`Point ${bullets.length + 1}`);
        return {
          heading: col?.heading ? cleanString(col.heading, 6, 45) : undefined,
          bullets,
        };
      };
      result = {
        title,
        notes,
        layout: "two_column",
        content: {
          left: cleanCol(content.left),
          right: cleanCol(content.right),
          ...extractImageFields(content, "right"),
        },
      };
      break;
    }
    case "stats": {
      let statsArr = Array.isArray(content.stats)
        ? content.stats.map((s: any) => ({
            value: cleanString(s?.value ?? "100%", 4, 25),
            label: cleanString(s?.label ?? "Metric", 8, 55),
            icon: ALLOWED_ICONS.includes(s?.icon) ? s.icon : undefined,
          }))
        : [];
      if (statsArr.length > 4) {
        statsArr = statsArr.slice(0, 4);
        recordTruncate();
      }
      while (statsArr.length < 2) statsArr.push({ value: "100%", label: "Impact Metric" });
      result = {
        title,
        notes,
        layout: "stats",
        content: { stats: statsArr },
      };
      break;
    }
    case "process": {
      let steps = Array.isArray(content.steps)
        ? content.steps.map((s: any, idx: number) => ({
            label: cleanString(s?.label ?? `Step ${idx + 1}`, 5, 40),
            desc: cleanString(s?.desc ?? "Description", 10, 80),
            icon: ALLOWED_ICONS.includes(s?.icon) ? s.icon : undefined,
          }))
        : [];
      if (steps.length > 5) {
        steps = steps.slice(0, 5);
        recordTruncate();
      }
      while (steps.length < 3) steps.push({ label: `Step ${steps.length + 1}`, desc: "Key stage in process" });
      result = {
        title,
        notes,
        layout: "process",
        content: { steps },
      };
      break;
    }
    case "comparison": {
      let columns = Array.isArray(content.columns)
        ? content.columns.map((c: any, idx: number) => {
            let bullets = Array.isArray(c?.bullets)
              ? c.bullets
                  .map((b: any) => cleanString(b, 10, 75))
                  .filter((s: string) => s.length > 0)
              : [];
            if (bullets.length > 4) {
              bullets = bullets.slice(0, 4);
              recordTruncate();
            }
            while (bullets.length < 2) bullets.push(`Point ${bullets.length + 1}`);
            return {
              heading: cleanString(c?.heading ?? `Option ${idx + 1}`, 5, 40),
              bullets,
            };
          })
        : [];
      if (columns.length > 3) {
        columns = columns.slice(0, 3);
        recordTruncate();
      }
      while (columns.length < 2) {
        columns.push({ heading: `Option ${columns.length + 1}`, bullets: ["Point 1", "Point 2"] });
      }
      result = {
        title,
        notes,
        layout: "comparison",
        content: { columns },
      };
      break;
    }
    case "quote": {
      const quote = cleanString(content.quote || title, 30, 220);
      const attribution = content.attribution ? cleanString(content.attribution, 8, 60) : undefined;
      result = {
        title,
        notes,
        layout: "quote",
        content: {
          quote,
          attribution,
          ...extractImageFields(content, "background"),
        },
      };
      break;
    }
    case "closing": {
      const headline = cleanString(content.headline || title, 8, 65);
      const cta = content.cta ? cleanString(content.cta, 10, 65) : undefined;
      result = {
        title,
        notes,
        layout: "closing",
        content: {
          headline,
          cta,
          ...extractImageFields(content, "background"),
        },
      };
      break;
    }
    case "chart": {
      const chartType = ["bar", "line", "pie"].includes(content.chartType) ? content.chartType : "bar";
      const chartTitle = content.chartTitle ? cleanString(content.chartTitle, 8, 60) : undefined;
      let categories = Array.isArray(content.categories)
        ? content.categories.map((cat: any) => cleanString(cat, 4, 25)).filter((s: string) => s.length > 0)
        : [];
      if (categories.length > 8) {
        categories = categories.slice(0, 8);
        recordTruncate();
      }

      // Clean series strictly: only keep numeric values, never invent or pad default values
      let series = Array.isArray(content.series)
        ? content.series
            .map((ser: any) => {
              const name = cleanString(ser?.name || "Metric", 4, 30);
              const values = Array.isArray(ser?.values)
                ? ser.values
                    .map((v: any) => (typeof v === "number" && !isNaN(v) ? v : parseFloat(v)))
                    .filter((v: number) => typeof v === "number" && !isNaN(v))
                : [];
              return { name, values };
            })
            .filter((s: any) => s.values.length > 0)
        : [];
      if (series.length > 3) {
        series = series.slice(0, 3);
        recordTruncate();
      }

      const totalValues = series.reduce((sum: number, s: any) => sum + s.values.length, 0);
      const allSeriesMatchCategories =
        series.length >= 1 &&
        categories.length >= 2 &&
        series.every((s: any) => s.values.length === categories.length);

      const tempSlide = {
        title,
        notes,
        layout: "chart",
        content: {
          chartType,
          chartTitle,
          categories,
          series,
          caption: content.caption ? cleanString(content.caption, 15, 100) : undefined,
          bullets: Array.isArray(content.bullets) ? content.bullets : undefined,
        },
      };

      if (!allSeriesMatchCategories || totalValues < 3) {
        result = convertChartToFallbackLayout(tempSlide, sourceText, talkingPoints);
      } else if (sourceText && typeof sourceText === "string" && sourceText.trim()) {
        result = validateAndGroundChartSlide(tempSlide, sourceText, talkingPoints);
      } else {
        const distinctVals = new Set(series.flatMap((s: any) => s.values));
        if (distinctVals.size < 3) {
          result = convertChartToFallbackLayout(tempSlide, undefined, talkingPoints);
        } else {
          result = tempSlide;
        }
      }
      break;
    }
    case "image": {
      const variant = content.variant === "full_bleed" ? "full_bleed" : "split";
      const imageKeyword = cleanString(content.imageKeyword || content.imageQuery || title, 4, 35);
      const imageUrl = typeof content.imageUrl === "string" && content.imageUrl.trim().length > 0 ? content.imageUrl.trim() : undefined;
      const caption = content.caption ? cleanString(content.caption, 15, 120) : undefined;
      const photographer = content.photographer ? String(content.photographer).slice(0, 80) : undefined;
      const photographerUrl = typeof content.photographerUrl === "string" ? content.photographerUrl : undefined;
      const heading = content.heading ? cleanString(content.heading, 6, 45) : undefined;
      let bullets: string[] | undefined;
      if (Array.isArray(content.bullets)) {
        bullets = content.bullets.map((b: any) => cleanString(b, 12, 85)).filter((s: string) => s.length > 0).slice(0, 4);
      }
      const imagePlacement = content.imagePlacement || (variant === "full_bleed" ? "background" : "right");

      result = {
        title,
        notes,
        layout: "image",
        content: {
          variant,
          imageUrl,
          imageKeyword,
          imageQuery: imageKeyword,
          imagePlacement,
          caption,
          photographer,
          photographerUrl,
          heading,
          bullets,
        },
      };
      break;
    }
    default: {
      result = {
        title,
        notes,
        layout: "bullets",
        content: {
          bullets: ["Key finding and summary", "Operational observation", "Recommended next steps"],
        },
      };
      break;
    }
  }

  const sanitizedSourcePage = validateAndSanitizeSourcePage(raw.sourcePage, sourcePageCount);
  if (sanitizedSourcePage !== undefined) {
    result.sourcePage = sanitizedSourcePage;
  }

  if (meta) {
    result.meta = meta;
  }
  return result;
}

/**
 * Builds a safe, guaranteed valid fallback bullets slide from an outline section.
 * Validates through sanitizeSlidePayload and strict SlideSchema validation.
 */
export function buildFallbackBulletsSlide(
  sectionTitle: string,
  sectionPoints: string[] = []
): z.infer<typeof SlideSchema> {
  const rawPayload = {
    title: sectionTitle || "Key Takeaways",
    notes: `Discussion notes for ${sectionTitle || "Key Takeaways"}.`,
    layout: "bullets",
    content: {
      bullets:
        Array.isArray(sectionPoints) && sectionPoints.length > 0
          ? sectionPoints
          : ["Key summary point", "Operational observation", "Recommended action item"],
    },
    meta: { fallback: true },
  };

  const sanitized = sanitizeSlidePayload(rawPayload);
  sanitized.meta = { fallback: true };
  return SlideSchema.parse(sanitized);
}

/**
 * Strips any URL in slide text that does not appear in the source text.
 * Logs (without content) when a stat value or number in a slide does not appear in the source text.
 */
export function groundAndSanitizeSlide<T extends { title?: string; notes?: string; content?: any; layout?: string }>(
  slide: T,
  sourceText?: string,
  talkingPoints?: string[]
): T {
  if (slide && slide.content && typeof slide.content === "object" && "_stash" in slide.content) {
    const { _stash, ...cleanContent } = slide.content;
    slide = { ...slide, content: cleanContent };
  }
  const cleanSource = (sourceText || "").trim();
  const urlRegex = /https?:\/\/[^\s"'<>)\]]+/gi;

  if (!cleanSource) {
    if (slide.layout === "chart") {
      slide = convertChartToFallbackLayout(slide, undefined, talkingPoints);
    } else if (slide.layout === "stats") {
      slide = convertStatsToFallbackLayout(slide, talkingPoints);
    }
  } else {
    if (slide.layout === "chart") {
      slide = validateAndGroundChartSlide(slide, cleanSource, talkingPoints);
    } else if (slide.layout === "stats") {
      slide = validateAndGroundStatsSlide(slide, cleanSource, talkingPoints);
    }
  }

  function stripUnapprovedUrls(text: any): string {
    if (!text || typeof text !== "string") return text;
    return text.replace(urlRegex, (url) => {
      // If the URL appears anywhere in the source document text, keep it.
      if (cleanSource && cleanSource.includes(url)) {
        return url;
      }
      // Otherwise strip it out
      return "";
    }).replace(/\s{2,}/g, " ").trim();
  }

  let ungroundedLogged = false;
  const categoryCleanSource = cleanSourceForCategoryGrounding(cleanSource);

  function stripUngroundedNumbers(val: any): string {
    if (!val || typeof val !== "string" || !cleanSource) return val;
    return val.replace(/(?:[\$€£₹])?\b\d+(?:[.,]\d+)*(?:%|[kKmMbBtTxX]|cr|Cr|lakh)?(?!\w)/gi, (match) => {
      const numPart = match.replace(/[$€£₹%kKmMbBtTxX,]|cr|lakh/gi, "");
      const parsed = parseFloat(numPart);
      if (isNaN(parsed)) return match;

      // 4-digit calendar years: check categoryCleanSource where years are preserved
      if (parsed >= 1900 && parsed <= 2099 && /^\d{4}$/.test(numPart)) {
        if (categoryCleanSource.includes(numPart)) {
          return match;
        }
      }

      if (!isNumberInSource(parsed, cleanSource)) {
        if (!ungroundedLogged) {
          console.warn("[SlideGen] Stat value or number in slide does not appear in source text");
          ungroundedLogged = true;
        }
        return "";
      }
      return match;
    }).replace(/\s{2,}/g, " ").trim();
  }

  if (slide.title) {
    slide.title = stripUnapprovedUrls(stripUngroundedNumbers(slide.title));
  }
  if (slide.notes) {
    slide.notes = stripUnapprovedUrls(stripUngroundedNumbers(slide.notes));
  }

  if (slide.content && typeof slide.content === "object") {
    // Subtitle
    if (slide.content.subtitle) {
      slide.content.subtitle = stripUnapprovedUrls(stripUngroundedNumbers(slide.content.subtitle));
    }
    // Bullets
    if (Array.isArray(slide.content.bullets)) {
      slide.content.bullets = slide.content.bullets.map((b: string) => {
        return stripUnapprovedUrls(stripUngroundedNumbers(b));
      });
    }
    // Two-column left/right content objects
    if (slide.content.left && typeof slide.content.left === "object") {
      if (slide.content.left.heading) {
        slide.content.left.heading = stripUnapprovedUrls(stripUngroundedNumbers(slide.content.left.heading));
      }
      if (Array.isArray(slide.content.left.bullets)) {
        slide.content.left.bullets = slide.content.left.bullets.map((b: string) => {
          return stripUnapprovedUrls(stripUngroundedNumbers(b));
        });
      }
    }
    if (slide.content.right && typeof slide.content.right === "object") {
      if (slide.content.right.heading) {
        slide.content.right.heading = stripUnapprovedUrls(stripUngroundedNumbers(slide.content.right.heading));
      }
      if (Array.isArray(slide.content.right.bullets)) {
        slide.content.right.bullets = slide.content.right.bullets.map((b: string) => {
          return stripUnapprovedUrls(stripUngroundedNumbers(b));
        });
      }
    }
    // Legacy leftBullets / rightBullets fallback
    if (Array.isArray(slide.content.leftBullets)) {
      slide.content.leftBullets = slide.content.leftBullets.map((b: string) => {
        return stripUnapprovedUrls(stripUngroundedNumbers(b));
      });
    }
    if (Array.isArray(slide.content.rightBullets)) {
      slide.content.rightBullets = slide.content.rightBullets.map((b: string) => {
        return stripUnapprovedUrls(stripUngroundedNumbers(b));
      });
    }
    // Headings
    if (slide.content.heading) {
      slide.content.heading = stripUnapprovedUrls(stripUngroundedNumbers(slide.content.heading));
    }
    if (slide.content.leftHeading) {
      slide.content.leftHeading = stripUnapprovedUrls(stripUngroundedNumbers(slide.content.leftHeading));
    }
    if (slide.content.rightHeading) {
      slide.content.rightHeading = stripUnapprovedUrls(stripUngroundedNumbers(slide.content.rightHeading));
    }
    // Stats
    if (Array.isArray(slide.content.stats)) {
      for (const stat of slide.content.stats) {
        if (stat.value) {
          stat.value = stripUnapprovedUrls(stripUngroundedNumbers(stat.value));
        }
        if (stat.label) {
          stat.label = stripUnapprovedUrls(stripUngroundedNumbers(stat.label));
        }
      }
      const remainingStats = slide.content.stats.filter(
        (s: any) => s && s.value && s.value.trim().length > 0
      );
      if (slide.layout === "stats" && remainingStats.length === 0) {
        slide = convertStatsToFallbackLayout(slide, talkingPoints);
      }
    }
    // Steps
    if (Array.isArray(slide.content.steps)) {
      for (const step of slide.content.steps) {
        if (step.label) {
          step.label = stripUnapprovedUrls(stripUngroundedNumbers(step.label));
        }
        if (step.desc) {
          step.desc = stripUnapprovedUrls(stripUngroundedNumbers(step.desc));
        }
        if (step.description) {
          step.description = stripUnapprovedUrls(stripUngroundedNumbers(step.description));
        }
      }
    }
    // Columns
    if (Array.isArray(slide.content.columns)) {
      for (const col of slide.content.columns) {
        if (col.heading) {
          col.heading = stripUnapprovedUrls(stripUngroundedNumbers(col.heading));
        }
        if (Array.isArray(col.bullets)) {
          col.bullets = col.bullets.map((b: string) => {
            return stripUnapprovedUrls(stripUngroundedNumbers(b));
          });
        }
      }
    }
    // Quotes & CTA
    if (slide.content.quote) {
      slide.content.quote = stripUnapprovedUrls(stripUngroundedNumbers(slide.content.quote));
    }
    if (slide.content.attribution) {
      slide.content.attribution = stripUnapprovedUrls(slide.content.attribution);
    }
    if (slide.content.headline) {
      slide.content.headline = stripUnapprovedUrls(stripUngroundedNumbers(slide.content.headline));
    }
    if (slide.content.cta) {
      slide.content.cta = stripUnapprovedUrls(stripUngroundedNumbers(slide.content.cta));
    }
    if (slide.content.caption) {
      slide.content.caption = stripUnapprovedUrls(stripUngroundedNumbers(slide.content.caption));
    }
    // Charts categories & series
    if (Array.isArray(slide.content.categories)) {
      slide.content.categories = slide.content.categories.map((c: string) => stripUnapprovedUrls(c));
    }
    if (Array.isArray(slide.content.series)) {
      for (const s of slide.content.series) {
        if (s.name) s.name = stripUnapprovedUrls(s.name);
      }
    }
  }

  return slide;
}

