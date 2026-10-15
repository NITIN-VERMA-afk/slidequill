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
    sourcePage: z.number().int().min(1).optional(),
    sourceSection: z.string().max(120).optional(),
    meta: z
      .object({
        fallback: z.boolean().optional(),
      })
      .optional(),
  })
  .and(SlideLayouts);

export type SlideData = z.infer<typeof SlideSchema> & { id: string };

export interface SanitizeStats {
  truncations: number;
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
): number | undefined {
  if (!sourcePageCount || typeof sourcePageCount !== "number" || sourcePageCount < 1) {
    return undefined;
  }

  let parsed: number | undefined;
  if (typeof rawPage === "number") {
    parsed = Math.floor(rawPage);
  } else if (typeof rawPage === "string") {
    const num = parseInt(rawPage.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(num)) {
      parsed = num;
    }
  }

  if (parsed !== undefined && parsed >= 1 && parsed <= sourcePageCount) {
    return parsed;
  }

  return undefined;
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
  sourcePageCount?: number
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
      while (categories.length < 2) {
        categories.push(`Item ${categories.length + 1}`);
      }

      let series = Array.isArray(content.series)
        ? content.series.map((ser: any) => {
            const name = cleanString(ser?.name || "Metric", 4, 30);
            const values = Array.isArray(ser?.values)
              ? ser.values.slice(0, categories.length).map((v: any) => (typeof v === "number" && !isNaN(v) ? v : Number(v) || 0))
              : [];
            while (values.length < categories.length) {
              values.push(10);
            }
            return { name, values };
          })
        : [];
      if (series.length > 3) {
        series = series.slice(0, 3);
        recordTruncate();
      }
      if (series.length === 0) {
        series = [{ name: "Value", values: categories.map(() => 10) }];
      }

      result = {
        title,
        notes,
        layout: "chart",
        content: {
          chartType,
          chartTitle,
          categories,
          series,
          caption: content.caption ? cleanString(content.caption, 15, 100) : undefined,
        },
      };
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
  sourceText?: string
): T {
  const cleanSource = (sourceText || "").trim();
  const urlRegex = /https?:\/\/[^\s"'<>)\]]+/gi;

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
  function checkNumericGrounding(val: any) {
    if (!val || typeof val !== "string" || !cleanSource || ungroundedLogged) return;
    const numbers = val.match(/\d+(?:[.,]\d+)*/g);
    if (numbers) {
      for (const num of numbers) {
        const rawDigits = num.replace(/[.,]/g, "");
        if (rawDigits.length > 0 && !cleanSource.includes(num) && !cleanSource.includes(rawDigits)) {
          console.warn("[SlideGen] Stat value or number in slide does not appear in source text");
          ungroundedLogged = true;
          break;
        }
      }
    }
  }

  if (slide.title) {
    checkNumericGrounding(slide.title);
    slide.title = stripUnapprovedUrls(slide.title);
  }
  if (slide.notes) {
    checkNumericGrounding(slide.notes);
    slide.notes = stripUnapprovedUrls(slide.notes);
  }

  if (slide.content && typeof slide.content === "object") {
    // Bullets
    if (Array.isArray(slide.content.bullets)) {
      slide.content.bullets = slide.content.bullets.map((b: string) => {
        checkNumericGrounding(b);
        return stripUnapprovedUrls(b);
      });
    }
    if (Array.isArray(slide.content.leftBullets)) {
      slide.content.leftBullets = slide.content.leftBullets.map((b: string) => {
        checkNumericGrounding(b);
        return stripUnapprovedUrls(b);
      });
    }
    if (Array.isArray(slide.content.rightBullets)) {
      slide.content.rightBullets = slide.content.rightBullets.map((b: string) => {
        checkNumericGrounding(b);
        return stripUnapprovedUrls(b);
      });
    }
    // Headings
    if (slide.content.heading) {
      checkNumericGrounding(slide.content.heading);
      slide.content.heading = stripUnapprovedUrls(slide.content.heading);
    }
    if (slide.content.leftHeading) {
      checkNumericGrounding(slide.content.leftHeading);
      slide.content.leftHeading = stripUnapprovedUrls(slide.content.leftHeading);
    }
    if (slide.content.rightHeading) {
      checkNumericGrounding(slide.content.rightHeading);
      slide.content.rightHeading = stripUnapprovedUrls(slide.content.rightHeading);
    }
    // Stats
    if (Array.isArray(slide.content.stats)) {
      for (const stat of slide.content.stats) {
        if (stat.value) {
          checkNumericGrounding(stat.value);
          stat.value = stripUnapprovedUrls(stat.value);
        }
        if (stat.label) {
          checkNumericGrounding(stat.label);
          stat.label = stripUnapprovedUrls(stat.label);
        }
      }
    }
    // Steps
    if (Array.isArray(slide.content.steps)) {
      for (const step of slide.content.steps) {
        if (step.label) {
          checkNumericGrounding(step.label);
          step.label = stripUnapprovedUrls(step.label);
        }
        if (step.description) {
          checkNumericGrounding(step.description);
          step.description = stripUnapprovedUrls(step.description);
        }
      }
    }
    // Columns
    if (Array.isArray(slide.content.columns)) {
      for (const col of slide.content.columns) {
        if (col.heading) {
          checkNumericGrounding(col.heading);
          col.heading = stripUnapprovedUrls(col.heading);
        }
        if (Array.isArray(col.bullets)) {
          col.bullets = col.bullets.map((b: string) => {
            checkNumericGrounding(b);
            return stripUnapprovedUrls(b);
          });
        }
      }
    }
    // Quotes & CTA
    if (slide.content.quote) {
      checkNumericGrounding(slide.content.quote);
      slide.content.quote = stripUnapprovedUrls(slide.content.quote);
    }
    if (slide.content.attribution) {
      slide.content.attribution = stripUnapprovedUrls(slide.content.attribution);
    }
    if (slide.content.headline) {
      checkNumericGrounding(slide.content.headline);
      slide.content.headline = stripUnapprovedUrls(slide.content.headline);
    }
    if (slide.content.cta) {
      checkNumericGrounding(slide.content.cta);
      slide.content.cta = stripUnapprovedUrls(slide.content.cta);
    }
    if (slide.content.caption) {
      checkNumericGrounding(slide.content.caption);
      slide.content.caption = stripUnapprovedUrls(slide.content.caption);
    }
    // Charts categories & series
    if (Array.isArray(slide.content.categories)) {
      slide.content.categories = slide.content.categories.map((c: string) => stripUnapprovedUrls(c));
    }
    if (Array.isArray(slide.content.series)) {
      for (const s of slide.content.series) {
        if (s.name) s.name = stripUnapprovedUrls(s.name);
        if (Array.isArray(s.values)) {
          for (const v of s.values) {
            checkNumericGrounding(String(v));
          }
        }
      }
    }
  }

  return slide;
}

