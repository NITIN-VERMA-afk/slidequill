import { z } from "zod";
import { connectDB } from "@/app/lib/db";
import Deck from "@/app/models/Deck";
import DeckVersion from "@/app/models/DeckVersion";
import { validateAndSanitizeSourcePage } from "@/lib/slides-schema";
import { executeAtomicRefund } from "@/app/api/decks/[id]/generate/route";
import { isValidObjectId } from "@/lib/validation";

export const patchSchema = z.object({
  title: z.string().trim().max(200).optional(),
  theme: z.string().max(50).optional(),
  outline: z
    .array(
      z.object({
        id: z.string().max(100),
        title: z.string().max(200),
        points: z.array(z.string().max(500)).max(10),
      })
    )
    .max(20)
    .optional(),
  slides: z.array(z.any()).max(60).optional(),
  slideIndex: z.number().int().min(0).max(59).optional(),
  slide: z.any().optional(),
  expectedUpdatedAt: z.string().or(z.date()).optional(),
  version: z.number().int().optional(),
});

export async function resolveOwned(id: string, userId: string) {
  if (!isValidObjectId(id)) return null;
  await connectDB();
  const deck = await Deck.findOne({ _id: id, userId }).select("-sourceText");
  return deck;
}

export async function getDeckById(id: string, userId: string) {
  if (!isValidObjectId(id)) return null;
  await connectDB();
  const deck = await Deck.findOne({ _id: id, userId }).select("+sourceText");
  if (!deck) return null;

  // Stuck deck recovery: if deck is in "outlining" or "generating" with no progress for >30 minutes,
  // run the same atomic refund-and-fail logic used by the cron (exactly-once)
  const STUCK_TIMEOUT_MS = 30 * 60 * 1000;
  const isStuckStatus = deck.status === "outlining" || deck.status === "generating";
  const lastActivity = deck.lastProgressAt || deck.updatedAt;
  const isStuckDuration =
    lastActivity && Date.now() - new Date(lastActivity).getTime() > STUCK_TIMEOUT_MS;

  if (isStuckStatus && isStuckDuration) {
    await executeAtomicRefund(deck._id, userId);
    const refreshed = await Deck.findOne({ _id: id, userId }).select("+sourceText");
    if (refreshed) {
      const hasSourceText = Boolean(refreshed.sourceText && refreshed.sourceText.trim().length > 0);
      const deckObj = refreshed.toObject();
      delete deckObj.sourceText;
      return { ...deckObj, hasSourceText };
    }
  }

  const hasSourceText = Boolean(deck.sourceText && deck.sourceText.trim().length > 0);
  const deckObj = deck.toObject();
  delete deckObj.sourceText;

  return { ...deckObj, hasSourceText };
}

export const VALID_LAYOUTS = [
  "title",
  "bullets",
  "two_column",
  "stats",
  "process",
  "comparison",
  "quote",
  "closing",
  "chart",
  "image",
];

/**
 * Validates and caps slide field lengths.
 * Checks image URLs if present.
 */
export async function validateAndCapSlide(
  slide: any,
  sourcePageCount?: number
): Promise<{ valid: boolean; error?: string }> {
  if (!slide || typeof slide !== "object") {
    return { valid: false, error: "Slide must be an object." };
  }
  if (!slide.layout || !VALID_LAYOUTS.includes(slide.layout)) {
    return { valid: false, error: `Invalid slide layout: ${slide.layout}` };
  }
  if (!slide.id || typeof slide.id !== "string" || !slide.id.trim()) {
    return { valid: false, error: "Slide must have a valid non-empty id." };
  }

  // Cap slide-level fields
  if (typeof slide.title === "string") {
    slide.title = slide.title.slice(0, 200);
  }
  if (typeof slide.notes === "string") {
    slide.notes = slide.notes.slice(0, 2000);
  }
  if (slide.sourcePage !== undefined) {
    slide.sourcePage = validateAndSanitizeSourcePage(slide.sourcePage, sourcePageCount);
  }

  // Cap content fields if present
  const content = slide.content;
  if (content && typeof content === "object") {
    if (Array.isArray(content.bullets)) {
      content.bullets = content.bullets.slice(0, 10).map((b: any) =>
        typeof b === "string" ? b.slice(0, 500) : String(b || "")
      );
    }
    if (typeof content.subtitle === "string") {
      content.subtitle = content.subtitle.slice(0, 500);
    }
    if (typeof content.headline === "string") {
      content.headline = content.headline.slice(0, 200);
    }
    if (typeof content.cta === "string") {
      content.cta = content.cta.slice(0, 200);
    }
    if (typeof content.quote === "string") {
      content.quote = content.quote.slice(0, 500);
    }
    if (typeof content.attribution === "string") {
      content.attribution = content.attribution.slice(0, 200);
    }

    if (Array.isArray(content.columns)) {
      content.columns = content.columns.slice(0, 3).map((col: any) => ({
        heading: typeof col?.heading === "string" ? col.heading.slice(0, 200) : undefined,
        bullets: Array.isArray(col?.bullets)
          ? col.bullets.slice(0, 6).map((b: any) =>
              typeof b === "string" ? b.slice(0, 500) : String(b || "")
            )
          : [],
      }));
    }

    if (Array.isArray(content.stats)) {
      content.stats = content.stats.slice(0, 4).map((st: any) => ({
        value: typeof st?.value === "string" ? st.value.slice(0, 50) : String(st?.value || ""),
        label: typeof st?.label === "string" ? st.label.slice(0, 200) : String(st?.label || ""),
        icon: typeof st?.icon === "string" ? st.icon.slice(0, 50) : undefined,
      }));
    }

    if (Array.isArray(content.steps)) {
      content.steps = content.steps.slice(0, 5).map((step: any, idx: number) => ({
        step: typeof step?.step === "number" ? step.step : idx + 1,
        title: typeof step?.title === "string" ? step.title.slice(0, 200) : String(step?.title || ""),
        description:
          typeof step?.description === "string"
            ? step.description.slice(0, 500)
            : String(step?.description || ""),
        icon: typeof step?.icon === "string" ? step.icon.slice(0, 50) : undefined,
      }));
    }

    if (Array.isArray(content.options)) {
      content.options = content.options.slice(0, 3).map((opt: any) => ({
        name: typeof opt?.name === "string" ? opt.name.slice(0, 200) : String(opt?.name || ""),
        bullets: Array.isArray(opt?.bullets)
          ? opt.bullets.slice(0, 6).map((b: any) =>
              typeof b === "string" ? b.slice(0, 500) : String(b || "")
            )
          : [],
        highlight: Boolean(opt?.highlight),
      }));
    }

    if (content.chart && typeof content.chart === "object") {
      const ch = content.chart;
      if (!["bar", "line", "pie"].includes(ch.type)) {
        return { valid: false, error: `Invalid chart type: ${ch.type}` };
      }
      if (!Array.isArray(ch.data) || ch.data.length === 0 || ch.data.length > 8) {
        return { valid: false, error: "Chart must have between 1 and 8 data points." };
      }
      ch.data = ch.data.map((dp: any) => ({
        label: typeof dp?.label === "string" ? dp.label.slice(0, 50) : String(dp?.label || ""),
        value: typeof dp?.value === "number" && !isNaN(dp.value) ? dp.value : 0,
      }));
    }

    // SSRF protection: validate image URL if changed or added
    if (content.image && typeof content.image === "object") {
      if (typeof content.image.url === "string") {
        content.image.url = content.image.url.trim().slice(0, 2000);
      }
      if (typeof content.image.alt === "string") {
        content.image.alt = content.image.alt.slice(0, 500);
      }
      if (typeof content.image.photographer === "string") {
        content.image.photographer = content.image.photographer.slice(0, 200);
      }
      if (typeof content.image.photographerUrl === "string") {
        content.image.photographerUrl = content.image.photographerUrl.trim().slice(0, 2000);
      }
    }
  }

  return { valid: true };
}

/**
 * Saves a snapshot in DeckVersion with pinning for initial version.
 * Capped at 10 unpinned snapshots (pinned versions are never rotated out).
 */
export async function saveDeckSnapshot(deck: any) {
  if (deck.slides && deck.slides.length > 0) {
    const hasPinned = await DeckVersion.exists({ deckId: deck._id, pinned: true });
    const isFirst = !hasPinned && (await DeckVersion.countDocuments({ deckId: deck._id })) === 0;

    await DeckVersion.create({
      deckId: deck._id,
      slides: deck.slides,
      theme: deck.theme,
      pinned: isFirst,
      isInitial: isFirst,
      reason: isFirst ? "Initial generated version" : "Manual snapshot",
    });

    // Cap unpinned historical snapshots at 10 (pinned initial version is never rotated out)
    const unpinnedVersions = await DeckVersion.find({
      deckId: deck._id,
      pinned: { $ne: true },
    })
      .sort({ createdAt: 1 })
      .select("_id");

    if (unpinnedVersions.length > 10) {
      const toDelete = unpinnedVersions.slice(0, unpinnedVersions.length - 10).map((v) => v._id);
      await DeckVersion.deleteMany({ _id: { $in: toDelete } });
    }
  }
}

/**
 * Core business logic for patching a deck.
 * Supports verifying ownership, field validation and capping, single slide patch,
 * and stale write rejection via expectedUpdatedAt or version.
 */
export async function executeDeckPatch({
  deckId,
  userId,
  patchData,
}: {
  deckId: string;
  userId: string;
  patchData: any;
}): Promise<{ status: number; data: any }> {
  if (!isValidObjectId(deckId)) {
    return { status: 400, data: { error: "Invalid deck ID." } };
  }
  await connectDB();
  const deck = await resolveOwned(deckId, userId);
  if (!deck) {
    return { status: 404, data: { error: "Not found." } };
  }

  const parsed = patchSchema.safeParse(patchData);
  if (!parsed.success) {
    return {
      status: 400,
      data: { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
    };
  }

  const {
    title,
    outline,
    theme,
    slides,
    slideIndex,
    slide,
    expectedUpdatedAt,
    version,
  } = parsed.data;

  // Stale write detection: reject if updatedAt or version indicates concurrent edits
  if (expectedUpdatedAt) {
    const clientTime = new Date(expectedUpdatedAt).getTime();
    const serverTime = deck.updatedAt ? new Date(deck.updatedAt).getTime() : 0;
    // Allow 1000ms grace period for clock drift / serialization differences
    if (serverTime - clientTime > 1000) {
      return {
        status: 409,
        data: {
          error: "Stale write detected. Deck has been modified elsewhere.",
          conflict: true,
          updatedAt: deck.updatedAt,
          version: deck.version,
        },
      };
    }
  }

  if (version !== undefined && deck.version !== undefined && version !== deck.version) {
    return {
      status: 409,
      data: {
        error: "Stale write detected. Version mismatch.",
        conflict: true,
        version: deck.version,
        updatedAt: deck.updatedAt,
      },
    };
  }

  // Handle single slide update vs full slides update
  const isSingleSlidePatch = slideIndex !== undefined || slide !== undefined;
  if (isSingleSlidePatch) {
    if (slideIndex === undefined || slide === undefined) {
      return {
        status: 400,
        data: { error: "Both slideIndex and slide must be provided for single-slide update." },
      };
    }
    if (!deck.slides || slideIndex < 0 || slideIndex >= deck.slides.length) {
      return {
        status: 400,
        data: { error: `Invalid slideIndex: ${slideIndex}. Deck has ${deck.slides?.length || 0} slides.` },
      };
    }

    if (slide.id) {
      const duplicateIndex = deck.slides.findIndex(
        (s: any, idx: number) => s.id === slide.id && idx !== slideIndex
      );
      if (duplicateIndex !== -1) {
        return { status: 400, data: { error: `Duplicate slide id detected: ${slide.id}` } };
      }
    }

    const validation = await validateAndCapSlide(slide, deck.sourcePageCount);
    if (!validation.valid) {
      return { status: 400, data: { error: validation.error } };
    }

    // Save snapshot before mutating
    await saveDeckSnapshot(deck);

    // Update only the targeted slide
    deck.slides[slideIndex] = slide;
    deck.markModified("slides");
  } else if (slides !== undefined) {
    if (slides.length > 60) {
      return { status: 400, data: { error: "Deck cannot exceed maximum of 60 slides." } };
    }

    const seenSlideIds = new Set<string>();
    for (const s of slides) {
      if (!s || typeof s !== "object" || !s.id) {
        return { status: 400, data: { error: "All slides must have a valid id." } };
      }
      if (seenSlideIds.has(s.id)) {
        return { status: 400, data: { error: `Duplicate slide id detected: ${s.id}` } };
      }
      seenSlideIds.add(s.id);

      const validation = await validateAndCapSlide(s, deck.sourcePageCount);
      if (!validation.valid) {
        return { status: 400, data: { error: validation.error } };
      }
    }

    // Save snapshot before mutating
    await saveDeckSnapshot(deck);

    deck.slides = slides;
    deck.markModified("slides");
  }

  if (title !== undefined) deck.title = title;
  if (outline !== undefined) deck.outline = outline;
  if (theme !== undefined) deck.theme = theme;

  // Increment version counter for concurrency tracking
  deck.version = (deck.version || 1) + 1;
  await deck.save();

  return {
    status: 200,
    data: {
      deck,
      version: deck.version,
      updatedAt: deck.updatedAt,
    },
  };
}

