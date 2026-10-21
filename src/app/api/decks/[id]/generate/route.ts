import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { connectDB } from "@/app/lib/db";
import Deck from "@/app/models/Deck";
import DeckVersion from "@/app/models/DeckVersion";
import User from "@/app/models/User";
import { getSession } from "@/lib/auth";
import { openai } from "@/lib/openai";
import { runWithConcurrency } from "@/lib/concurrency";
import {
  SlideSchema,
  sanitizeSlidePayload,
  buildFallbackBulletsSlide,
  formatSourcePage,
  validateAndSanitizeSourcePage,
  groundAndSanitizeSlide,
  type SlideData,
} from "@/lib/slides-schema";
import type { OutlineSection } from "@/app/models/Deck";
import { searchStockImage, validateAndCleanImageQuery, isDataHeavyBulletList } from "@/lib/image-search";
import { getUserGenerationLimiter } from "@/lib/ratelimit";
import { trackEvent, sanitizeAnalyticsErrorMessage } from "@/lib/analytics";
import { getSourceExcerptForSection, getRelevantChunkNotesExcerpt } from "@/lib/longdoc";
import { planDeckLayouts, type SlideLayoutType } from "@/lib/layout-planner";
import { checkOrigin } from "@/lib/csrf";
import { isValidObjectId } from "@/lib/validation";

export const maxDuration = 60;

const SLIDES_MODEL = process.env.SLIDES_MODEL ?? "gpt-4o-mini";


const SYSTEM_PROMPT = `You are a professional presentation slide generator.
The user will provide a section from a presentation outline. Your task is to generate ONE beautifully designed slide for this section.

LAYOUT DIVERSITY & PACING (CRITICAL REQUIREMENTS):
- Never more than 40% bullet layouts in total across the presentation.
- Never generate 3 consecutive slides with the same layout.
- At least 1 stats/numbers slide per 6+ slides.
- Exactly 1 title (slide 1) and 1 closing (last slide).
- Adhere strictly to the ASSIGNED LAYOUT specified for this slide in the prompt.

Pick the best layout based on the content and assigned layout:
- Use "chart" when the source contains numeric data, metrics over time, percentages, or distributions.
- Use "image" when the section is a dedicated visual showcase slide (split or full-bleed).
- Use "stats" for 2-4 standalone key metrics (optionally select an icon name from the allowlist).
- Use "process" for chronological or numbered sequences (optionally select an icon name from the allowlist).
- Use "two_column" for pros/cons or dual perspectives.
- Use "comparison" for multi-column option evaluations.
- Use "bullets" for structured takeaways.

ALLOWED ICON NAMES:
["TrendingUp", "TrendingDown", "BarChart2", "PieChart", "Users", "Target", "Shield", "CheckCircle2", "Award", "Zap", "Globe", "DollarSign", "Briefcase", "Clock", "Activity", "Cpu", "Layers", "Compass", "Rocket", "Search", "Star", "Heart", "FileText", "Settings", "Lock", "Cloud", "Database", "Calendar", "Flag", "Lightbulb"]

SPECIFIC IMAGERY & STOCK PHOTOGRAPHY (CRITICAL REQUIREMENTS):
- Specificity: "imageQuery" MUST be a highly specific 2 to 4 word search keyword directly describing a concrete visual subject, NOT a generic topic.
  - Good: "solar panel rooftop installation", "electric vehicle battery assembly", "biochemical laboratory microscope", "container shipping crane harbor".
  - Strictly Forbidden: Generic 1-word abstracts like "data", "energy", "success", "technology", "business", "growth", "finance", "analytics", "abstract", "network", "cloud", "security", "teamwork", "ai", "money".
  - Strictly Forbidden Prefixes: NEVER write "a photo of", "picture of", or "image of".
- Deck Uniqueness: Every slide with an image in the deck MUST have a distinct, non-overlapping search query. No two slides in the same deck may use the exact same imageQuery.
- Data-heavy exclusion: If a "bullets" slide is data-heavy (contains statistics, numbers, percentages, financial metrics), do NOT provide an "imageQuery". Text readability comes first!
- "imagePlacement":
  - For "title" and "closing": choose "background" (atmospheric backdrop) or "right".
  - For "bullets" and "two_column": choose "right" (creates a modern side-by-side split layout with text on left and photo on right).
  - For "quote": choose "background" or "right".
- RATIO GUIDELINE: Roughly 30% to 40% of slides across the deck should include an "imageQuery". The title slide and closing slide should almost always include one.
- STRICT EXCLUSION: NEVER provide "imageQuery" on "stats", "process", "chart", or "comparison" slides (these layouts rely strictly on numbers, diagrams, steps, or comparison columns).

CONSTRAINTS (STRICT):
- Titles: Max 8 words, max 65 characters. State the conclusion (e.g., "Sales Grew 40%" instead of "Sales Data"). Optional "imageQuery" (2-4 words), optional "imagePlacement".
- Bullets: Max 12 words, max 90 characters per bullet. Exactly 3 to 6 bullets. Optional "imageQuery" (2-4 words), optional "imagePlacement" ("right").
- Two-column: Headings max 6 words (45 chars). Bullets max 12 words (85 chars), 2 to 4 bullets per column. Optional "imageQuery" (2-4 words), optional "imagePlacement" ("right").
- Stats: 2 to 4 metrics. Value max 4 words (25 chars). Label max 8 words (55 chars). Optional "icon". NO images.
- Process: 3 to 5 steps. Step label max 5 words (40 chars). Description max 10 words (80 chars). Optional "icon". NO images.
- Chart: "chartType" ("bar" | "line" | "pie"), "categories" (2-6 items, max 25 chars each), "series" (1-2 series with "name" and "values" array of numbers matching categories length), optional "caption". NO images.
- Image: "variant" ("split" | "full_bleed"), "imageKeyword" or "imageQuery" (2-4 words e.g. "team collaboration"), optional "heading", optional "bullets", optional "caption".
- Comparison: 2 to 3 columns. Heading max 5 words (40 chars). Bullets max 10 words (75 chars), 2 to 4 bullets per column. NO images.
- Quote: Quote max 30 words (220 chars). Attribution max 8 words (60 chars). Optional "imageQuery", optional "imagePlacement".
- Closing: Headline max 8 words (65 chars). CTA max 10 words (65 chars). Optional "imageQuery", optional "imagePlacement".
- Notes: 1-2 sentences of speaker notes (max 400 chars).

Output strictly in JSON matching the exact schema:
{
  "title": "string (conclusion, not topic)",
  "notes": "string (1-2 sentences speaker notes)",
  "layout": "title" | "bullets" | "two_column" | "stats" | "process" | "comparison" | "quote" | "closing" | "chart" | "image",
  "content": { ... }
}`;

async function callOpenAI(messages: { role: "system" | "user" | "assistant"; content: string }[]): Promise<{ parsed: any; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }> {
  const completion = await openai.chat.completions.create({
    model: SLIDES_MODEL,
    response_format: { type: "json_object" },
    temperature: 0.6,
    messages,
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  return {
    parsed,
    usage: completion.usage
      ? {
          prompt_tokens: completion.usage.prompt_tokens,
          completion_tokens: completion.usage.completion_tokens,
          total_tokens: completion.usage.total_tokens,
        }
      : undefined,
  };
}

export interface DeckImageReport {
  totalImages: number;
  uniqueImages: number;
  duplicateImages: number;
  uniquenessRatio: number;
}

/**
 * Resolves images for generated slides, ensuring no duplicate photos across the deck.
 * Queries 10 candidates from provider, selects first unused photo ID in deck, and caches queries for 24h.
 */
export async function resolveDeckImages(slides: SlideData[]): Promise<DeckImageReport> {
  const usedPhotoIds = new Set<string>();
  const usedQueriesInDeck = new Set<string>();

  for (let idx = 0; idx < slides.length; idx++) {
    const slide = slides[idx];
    const c = slide.content as any;
    if (!c) continue;

    // 1. Data-heavy bullet list check: skip image for readability
    if (isDataHeavyBulletList(slide)) {
      console.log(`[SlideImage] Slide ${idx + 1} (${slide.layout}): data-heavy bullet list detected; skipping image for readability.`);
      delete c.imageQuery;
      delete c.imageKeyword;
      delete c.imageUrl;
      delete c.photoId;
      delete c.photographer;
      delete c.photographerUrl;
      c.imagePlacement = "none";
      continue;
    }

    const rawQuery = (c.imageQuery || c.imageKeyword || (slide.layout === "title" ? slide.title : "")).trim();
    if (!rawQuery || (c.imageUrl && c.imageUrl.startsWith("http"))) {
      continue;
    }

    const isTitleOrClosing = slide.layout === "title" || slide.layout === "closing";

    // 2. Validate and clean query (2-4 words, no banned abstracts, distinct across deck)
    const validation = validateAndCleanImageQuery(rawQuery, usedQueriesInDeck);
    if (!validation.valid) {
      console.log(
        `[SlideImage] Slide ${idx + 1} (${slide.layout}): query "${rawQuery}" rejected (${validation.reason}); skipping image.`
      );
      delete c.imageQuery;
      delete c.imageKeyword;
      delete c.imageUrl;
      delete c.photoId;
      delete c.photographer;
      delete c.photographerUrl;
      c.imagePlacement = "none";
      continue;
    }

    const query = validation.query!;
    usedQueriesInDeck.add(query.toLowerCase());
    c.imageQuery = query;

    try {
      const stock = await searchStockImage(query, usedPhotoIds, {
        isTitleOrClosing,
        layout: slide.layout,
        slideIdx: idx + 1,
      });
      if (stock && stock.url) {
        c.imageUrl = stock.url;
        c.photoId = stock.id;
        c.photographer = stock.photographer;
        c.photographerUrl = stock.photographerUrl;
      } else {
        delete c.imageUrl;
        delete c.photoId;
        delete c.photographer;
        delete c.photographerUrl;
        c.imagePlacement = "none";
      }
    } catch (err) {
      console.warn(
        `[SlideImage] Slide ${idx + 1} (${slide.layout}): failed to resolve image for "${query}", leaving slide without image.`,
        err
      );
      delete c.imageUrl;
      delete c.photoId;
      delete c.photographer;
      delete c.photographerUrl;
      c.imagePlacement = "none";
    }
  }

  // Calculate unique photos report
  const resolvedUrls = slides
    .map((s) => (s.content as any)?.imageUrl)
    .filter(Boolean) as string[];
  const totalImages = resolvedUrls.length;
  const uniqueImages = new Set(resolvedUrls).size;
  const duplicateImages = totalImages - uniqueImages;
  const uniquenessRatio = totalImages > 0 ? uniqueImages / totalImages : 1.0;

  console.log(
    `[DeckImageReport] Total images: ${totalImages}, Unique: ${uniqueImages}, Duplicates: ${duplicateImages} (${(uniquenessRatio * 100).toFixed(1)}% unique)`
  );

  return {
    totalImages,
    uniqueImages,
    duplicateImages,
    uniquenessRatio,
  };
}

interface GenerationMetrics {
  truncations: number;
  retries: number;
  fallbacks: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

async function generateSlide(
  deckTitle: string,
  section: OutlineSection,
  isFirst: boolean,
  isLast: boolean,
  metrics: GenerationMetrics,
  sourcePageCount?: number,
  sourceExcerpt?: string,
  includeImages: boolean = true,
  assignedLayout?: SlideLayoutType,
  sourceExcerptLabel?: string
): Promise<SlideData> {
  let context = `Deck Title: ${deckTitle}\n\nSection Title: ${section.title}\nSection Points:\n${section.points
    .map((p) => `- ${p}`)
    .join("\n")}`;

  if (sourceExcerpt) {
    const label =
      sourceExcerptLabel ||
      (section.pageRange && !section.pageRangeApprox
        ? `Original Source Document Excerpts (Pages ${section.pageRange.start}–${section.pageRange.end})`
        : `Original Source Document Excerpts (Section: ${section.title})`);
    context += `\n\n${label}:\n<source_excerpt>\n${sourceExcerpt}\n</source_excerpt>\nUse relevant numbers, statistics, and facts from this excerpt where appropriate.`;
  }

  if (isFirst) context += `\n\n(This is the FIRST section. You MUST use the "title" layout.)`;
  else if (isLast) context += `\n\n(This is the LAST section. You MUST use the "closing" layout.)`;
  else if (assignedLayout) context += `\n\n(ASSIGNED LAYOUT: You MUST use the "${assignedLayout}" layout for this slide.)`;

  if (!includeImages) {
    context += `\n\n(Note: Stock images are DISABLED for this presentation. Do NOT produce any "imageQuery" or "imageKeyword".)`;
  }

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: context },
  ];

  try {
    // 1. Initial generation call
    const res = await callOpenAI(messages);
    if (res.usage) {
      metrics.promptTokens += res.usage.prompt_tokens;
      metrics.completionTokens += res.usage.completion_tokens;
      metrics.totalTokens += res.usage.total_tokens;
    }

    // 2. Lenient parse + sanitize
    const sanitizeStats = { truncations: 0 };
    const sanitized = sanitizeSlidePayload(
      res.parsed,
      isFirst,
      isLast,
      sanitizeStats,
      sourcePageCount,
      sourceExcerpt,
      section.points
    );
    metrics.truncations += sanitizeStats.truncations;

    const deterministicSourcePage = section.pageRangeApprox
      ? undefined
      : formatSourcePage(section.pageRange, sourcePageCount);

    // 3. Strict validation
    const parsed = SlideSchema.safeParse(sanitized);
    if (parsed.success) {
      return {
        ...parsed.data,
        id: randomUUID(),
        sourceSection: section.title,
        sourcePage: deterministicSourcePage,
        sourcePageApprox: section.pageRangeApprox,
      };
    }

    // 4. Retry ONCE if validation failed
    metrics.retries++;
    console.warn(
      `[SlideGen] Section ${section.id}: initial schema validation error, attempting retry 1.`
    );
    const retryFeedback = `Your previous output did not pass validation: ${parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ")}. Please regenerate strictly adhering to character and word bounds.`;

    const retryRes = await callOpenAI([
      ...messages,
      { role: "assistant", content: JSON.stringify(res.parsed) },
      { role: "user", content: retryFeedback },
    ]);
    if (retryRes.usage) {
      metrics.promptTokens += retryRes.usage.prompt_tokens;
      metrics.completionTokens += retryRes.usage.completion_tokens;
      metrics.totalTokens += retryRes.usage.total_tokens;
    }

    const retrySanitizeStats = { truncations: 0 };
    const sanitizedRetry = sanitizeSlidePayload(
      retryRes.parsed,
      isFirst,
      isLast,
      retrySanitizeStats,
      sourcePageCount,
      sourceExcerpt,
      section.points
    );
    metrics.truncations += retrySanitizeStats.truncations;

    const parsedRetry = SlideSchema.safeParse(sanitizedRetry);
    if (parsedRetry.success) {
      return {
        ...parsedRetry.data,
        id: randomUUID(),
        sourceSection: section.title,
        sourcePage: deterministicSourcePage,
        sourcePageApprox: section.pageRangeApprox,
      };
    }

    // 5. Fallback bullets slide from outline
    metrics.fallbacks++;
    console.warn(
      `[SlideGen] Section ${section.id}: retry failed validation, applying fallback bullets slide.`
    );
    return {
      ...buildFallbackBulletsSlide(section.title, section.points),
      id: randomUUID(),
      sourceSection: section.title,
      sourcePage: deterministicSourcePage,
      sourcePageApprox: section.pageRangeApprox,
    };
  } catch (err) {
    metrics.fallbacks++;
    console.error(`[SlideGen] Section ${section.id}: unexpected error in generation, using fallback.`, err);
    return {
      ...buildFallbackBulletsSlide(section.title, section.points),
      id: randomUUID(),
      sourceSection: section.title,
    };
  }
}

export async function processSlideBatch(
  id: string,
  userId: string
): Promise<{ status: number; data: any }> {
  if (!isValidObjectId(id)) return { status: 400, data: { error: "Invalid deck ID." } };
  await connectDB();

  const deck = await Deck.findOne({ _id: id, userId }).select("+sourceText +chunkNotes");
  if (!deck) return { status: 404, data: { error: "Not found." } };

  if (deck.status === "ready") {
    return {
      status: 200,
      data: {
        status: "ready",
        slidesDone: deck.slides?.length || 0,
        slidesTotal: deck.slides?.length || 0,
        slides: deck.slides,
        isComplete: true,
      },
    };
  }

  if (deck.status === "failed") {
    return { status: 500, data: { error: deck.error || "Generation failed." } };
  }

  if (!deck.outline || deck.outline.length === 0) {
    return { status: 400, data: { error: "No outline to generate from." } };
  }

  const userCheck = await User.findById(userId).select("emailVerified hasPurchased").lean();
  if (userCheck && !userCheck.emailVerified && !userCheck.hasPurchased) {
    return {
      status: 403,
      data: { error: "Please verify your email before generating free presentations." },
    };
  }

  // Rate limit daily generations per user (100/day for paid users, 20/day for free users)
  try {
    const isPaid = Boolean(userCheck?.hasPurchased);
    const { success } = await getUserGenerationLimiter(isPaid).limit(userId);
    if (!success) {
      return {
        status: 429,
        data: {
          error: isPaid
            ? "Daily generation limit reached (100 decks/day). Please try again tomorrow."
            : "Daily generation limit reached (20 decks/day). Please try again tomorrow.",
        },
      };
    }
  } catch {
    // If rate limiter fails or redis is unavailable, do not block generation
  }

  // Deduct credit atomically only on initial generation start (once per deck lifecycle)
  if (!deck.creditCharged) {
    // (a) Atomically claim the charge; only the request that wins the claim continues
    const claimDeck = await Deck.findOneAndUpdate(
      { _id: id, userId, creditCharged: { $ne: true } },
      { $set: { creditCharged: true, creditRefunded: false, status: "generating" } },
      { returnDocument: "after" }
    );
    if (!claimDeck) {
      return {
        status: 409,
        data: { inProgress: true, error: "Generation is already starting in another request." },
      };
    }

    // (b) Then deduct the user's credit and record deductionId on user
    const deductionId = randomUUID();
    const chargeTime = new Date();

    const user = await User.findOneAndUpdate(
      { _id: userId, credits: { $gte: 1 } },
      {
        $inc: { credits: -1 },
        $push: {
          creditDeductions: {
            deductionId,
            deckId: id,
            deductedAt: chargeTime,
            refunded: false,
          },
        },
      },
      { returnDocument: "after" }
    );

    // (c) If deduction fails (insufficient credits), release the claim and return 402
    if (!user) {
      await Deck.updateOne(
        { _id: id, userId },
        { $set: { creditCharged: false, status: "outlined" } }
      );
      return { status: 402, data: { error: "Insufficient credits." } };
    }

    // (d) Record deductionId, creditDeductedAt and lastProgressAt; never rely on deck.save() for charge flag
    await Deck.updateOne(
      { _id: id, userId },
      {
        $set: {
          deductionId,
          creditDeductedAt: chargeTime,
          lastProgressAt: chargeTime,
        },
      }
    );
    deck.creditCharged = true;
    deck.creditRefunded = false;
  }

  const totalSlides = deck.outline.length;
  const currentDone = Array.isArray(deck.slides) ? deck.slides.length : 0;

  if (currentDone >= totalSlides) {
    await Deck.updateOne(
      { _id: deck._id },
      {
        $set: {
          status: "ready",
          slidesDone: totalSlides,
          slidesTotal: totalSlides,
          slideBatchLease: null,
        },
      }
    );
    return {
      status: 200,
      data: {
        status: "ready",
        slidesDone: totalSlides,
        slidesTotal: totalSlides,
        slides: deck.slides,
        isComplete: true,
      },
    };
  }

  // Atomically acquire batch lease so two simultaneous requests or tabs cannot process the same slides
  const BATCH_SIZE = 4;
  const LEASE_TIMEOUT_MS = 60 * 1000; // 60 seconds
  const now = new Date();
  const leaseCutoff = new Date(now.getTime() - LEASE_TIMEOUT_MS);
  const batchStartIndex = currentDone;

  const leasedDeck = await Deck.findOneAndUpdate(
    {
      _id: deck._id,
      userId,
      status: { $in: ["outlined", "generating"] },
      $or: [
        { slideBatchLease: null },
        { "slideBatchLease.leasedAt": { $lt: leaseCutoff } },
        { "slideBatchLease.batchStartIndex": { $ne: batchStartIndex } },
      ],
    },
    {
      $set: {
        status: "generating",
        slidesDone: currentDone,
        slidesTotal: totalSlides,
        slideBatchLease: { batchStartIndex, leasedAt: now },
      },
    },
    { returnDocument: "after" }
  ).select("+sourceText +chunkNotes");

  if (!leasedDeck) {
    // Another concurrent request or tab is currently processing this batch
    return {
      status: 200,
      data: {
        status: "generating",
        slidesDone: currentDone,
        slidesTotal: totalSlides,
        inProgress: true,
      },
    };
  }

  const metrics: GenerationMetrics = {
    truncations: 0,
    retries: 0,
    fallbacks: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  try {
    // Persist layout plan and precomputed excerpts so resume requests never repeat planning
    let layoutPlan: Array<{ index: number; layout: SlideLayoutType; reason?: string }>;
    let sectionExcerpts: (string | undefined)[];

    if (
      Array.isArray(leasedDeck.slideGenerationProgress?.layoutPlan) &&
      leasedDeck.slideGenerationProgress.layoutPlan.length === totalSlides &&
      Array.isArray(leasedDeck.slideGenerationProgress?.sectionExcerpts)
    ) {
      layoutPlan = leasedDeck.slideGenerationProgress.layoutPlan as any;
      sectionExcerpts = leasedDeck.slideGenerationProgress.sectionExcerpts;
    } else {
      sectionExcerpts = (leasedDeck.outline as OutlineSection[]).map((section) => {
        let excerpt = leasedDeck.sourceText
          ? getSourceExcerptForSection(
              leasedDeck.sourceText,
              section.pageRange,
              4_000,
              section.pageRangeApprox,
              section.title,
              section.points
            )
          : undefined;

        if (!excerpt && leasedDeck.sourceText) {
          if (leasedDeck.sourceText.length <= 12_000) {
            excerpt = leasedDeck.sourceText;
          } else if (Array.isArray(leasedDeck.chunkNotes) && leasedDeck.chunkNotes.length > 0) {
            excerpt = getRelevantChunkNotesExcerpt(leasedDeck.chunkNotes, section.title, section.points);
          }
        }
        return excerpt;
      });

      layoutPlan = await planDeckLayouts(
        leasedDeck.title,
        leasedDeck.outline as OutlineSection[],
        SLIDES_MODEL,
        sectionExcerpts
      );

      await Deck.updateOne(
        { _id: leasedDeck._id },
        {
          $set: {
            "slideGenerationProgress.layoutPlan": layoutPlan,
            "slideGenerationProgress.sectionExcerpts": sectionExcerpts,
            "slideGenerationProgress.slidesTotal": totalSlides,
          },
        }
      );
    }

    const batchEndIndex = Math.min(batchStartIndex + BATCH_SIZE, totalSlides);
    const batchSections = (leasedDeck.outline as OutlineSection[]).slice(batchStartIndex, batchEndIndex);

    const batchResults = await runWithConcurrency(
      batchSections,
      Math.min(batchSections.length, 4),
      async (section, offset) => {
        const globalIdx = batchStartIndex + offset;
        const isFirst = globalIdx === 0;
        const isLast = globalIdx === totalSlides - 1;
        const excerpt = sectionExcerpts[globalIdx];

        let excerptLabel =
          section.pageRange && !section.pageRangeApprox
            ? `Original Source Document Excerpts (Pages ${section.pageRange.start}–${section.pageRange.end})`
            : `Original Source Document Excerpts (Section: ${section.title})`;

        if (!excerpt && leasedDeck.sourceText && leasedDeck.sourceText.length <= 12_000) {
          excerptLabel = "Original Source Document (Full document reference)";
        } else if (!excerpt && Array.isArray(leasedDeck.chunkNotes) && leasedDeck.chunkNotes.length > 0) {
          excerptLabel = "Source Document Notes (Reference notes, not verbatim source text)";
        }

        return generateSlide(
          leasedDeck.title,
          section,
          isFirst,
          isLast,
          metrics,
          leasedDeck.sourcePageCount,
          excerpt,
          leasedDeck.includeImages !== false,
          layoutPlan[globalIdx]?.layout,
          excerptLabel
        );
      }
    );

    const rawBatchSlides = batchResults.filter(Boolean) as SlideData[];
    const validBatchSlides = rawBatchSlides.map((s, offset) => {
      const globalIdx = batchStartIndex + offset;
      const sec = (leasedDeck.outline as OutlineSection[])[globalIdx];
      const groundingSource = leasedDeck.sourceText || "";
      return groundAndSanitizeSlide(s, groundingSource, sec?.points);
    });

    if (leasedDeck.includeImages !== false) {
      await resolveDeckImages(validBatchSlides);
    }

    // Idempotent write by slide index: ensure existing slides up to batchStartIndex are preserved
    const currentDeck = await Deck.findById(leasedDeck._id).select("slides");
    const existingSlides = (currentDeck?.slides || []).slice(0, batchStartIndex);
    const updatedSlides = [...existingSlides, ...validBatchSlides];
    const newDone = updatedSlides.length;
    const isComplete = newDone >= totalSlides;

    const firstSlideWithImg = updatedSlides.find((s: any) => s.content?.imageUrl);
    const coverImage = firstSlideWithImg ? (firstSlideWithImg.content as any).imageUrl : undefined;

    const progressTime = new Date();
    await Deck.updateOne(
      { _id: leasedDeck._id },
      {
        $set: {
          slides: updatedSlides,
          slidesDone: newDone,
          slidesTotal: totalSlides,
          "slideGenerationProgress.slidesDone": newDone,
          "slideGenerationProgress.slidesTotal": totalSlides,
          status: isComplete ? "ready" : "generating",
          coverImage,
          slideBatchLease: null,
          lastProgressAt: progressTime,
          updatedAt: progressTime,
        },
        $inc: {
          "tokenUsage.generatePromptTokens": metrics.promptTokens,
          "tokenUsage.generateCompletionTokens": metrics.completionTokens,
          "tokenUsage.totalTokens": metrics.totalTokens,
        },
      }
    );

    if (isComplete) {
      // Pin the first generated version in DeckVersion so it's never rotated out
      try {
        const hasPinned = await DeckVersion.exists({ deckId: leasedDeck._id, pinned: true });
        if (!hasPinned) {
          await DeckVersion.create({
            deckId: leasedDeck._id,
            slides: updatedSlides,
            theme: leasedDeck.theme,
            pinned: true,
            isInitial: true,
            reason: "Initial generated version",
          });
        }
      } catch (versionErr) {
        console.error("Failed to pin initial generated DeckVersion:", versionErr);
      }

      void trackEvent("deck_generated", {
        userId,
        deckId: id,
        meta: {
          slideCount: updatedSlides.length,
          tokens: metrics.totalTokens,
          fallbacks: metrics.fallbacks,
          retries: metrics.retries,
        },
      });
    }

    return {
      status: 200,
      data: {
        status: isComplete ? "ready" : "generating",
        slidesDone: newDone,
        slidesTotal: totalSlides,
        slides: updatedSlides,
        isComplete,
      },
    };
  } catch (err) {
    console.error("Generation error:", err);

    void trackEvent("generation_failed", {
      userId,
      deckId: id,
      meta: { error: sanitizeAnalyticsErrorMessage(err) },
    });

    await executeAtomicRefund(deck._id, userId);

    return { status: 500, data: { error: "Generation failed." } };
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = checkOrigin(req);
  if (csrfError) return csrfError;

  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid deck ID." }, { status: 400 });
  }
  const result = await processSlideBatch(id, session.sub);
  return NextResponse.json(result.data, { status: result.status });
}

/**
 * Atomically refunds 1 credit to a user for a failed generation:
 * - Only if credit was claimed and charged (creditCharged === true).
 * - Only if credit was actually deducted (creditDeductedAt on deck OR unrefunded deduction on user).
 * - Only if credit was not already refunded (creditRefunded === false).
 * - Never refunds a deck whose status is "ready".
 * - Atomic findOneAndUpdate guarantees exactly-once refund even under concurrent calls.
 */
export async function executeAtomicRefund(
  deckId: string | any,
  userId: string | any
): Promise<boolean> {
  if (!isValidObjectId(deckId)) return false;
  const deck = await Deck.findOne({ _id: deckId, userId });
  if (!deck || deck.status === "ready" || deck.creditRefunded || !deck.creditCharged) {
    if (deck && deck.status !== "ready") {
      await Deck.updateOne(
        { _id: deckId, status: { $ne: "ready" } },
        { $set: { status: "failed", error: "Slide generation failed." } }
      );
    }
    return false;
  }

  // Check if deduction happened:
  // (a) either recorded on deck (creditDeductedAt)
  // (b) or recorded on user (creditDeductions for this deckId with refunded === false)
  let deductionConfirmed = Boolean(deck.creditDeductedAt);
  if (!deductionConfirmed) {
    const userWithDeduction = await User.findOne({
      _id: userId,
      creditDeductions: {
        $elemMatch: { deckId, refunded: false },
      },
    });
    if (userWithDeduction) {
      deductionConfirmed = true;
    }
  }

  if (!deductionConfirmed) {
    // Deduction never happened (crash between claim and deduction, or free deck)
    await Deck.updateOne(
      { _id: deckId, status: { $ne: "ready" } },
      { $set: { status: "failed", error: "Slide generation failed." } }
    );
    return false;
  }

  const updatedDeck = await Deck.findOneAndUpdate(
    {
      _id: deckId,
      userId,
      creditCharged: true,
      creditRefunded: false,
      status: { $ne: "ready" },
    },
    {
      $set: { creditRefunded: true, status: "failed", error: "Slide generation failed." },
    },
    { returnDocument: "after" }
  );

  if (updatedDeck) {
    const updateResult = await User.updateOne(
      {
        _id: userId,
        creditDeductions: {
          $elemMatch: { deckId, refunded: false },
        },
      },
      {
        $inc: { credits: 1 },
        $set: { "creditDeductions.$.refunded": true },
      }
    );
    if (updateResult.modifiedCount === 0) {
      await User.updateOne({ _id: userId }, { $inc: { credits: 1 } });
    }
    console.log(`[SlideGen] Deck ${deckId}: Refunded 1 credit after failure.`);
    return true;
  } else {
    await Deck.updateOne(
      { _id: deckId, status: { $ne: "ready" } },
      { $set: { status: "failed", error: "Slide generation failed." } }
    );
    return false;
  }
}

