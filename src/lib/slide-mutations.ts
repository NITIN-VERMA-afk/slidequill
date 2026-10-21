import type { SlideData } from "./slides-schema";

export const MAX_DECK_SLIDES = 60;

export type SupportedLayout =
  | "title"
  | "bullets"
  | "two_column"
  | "stats"
  | "process"
  | "comparison"
  | "quote"
  | "closing"
  | "chart"
  | "image";

export const LAYOUT_OPTIONS: Array<{ value: SupportedLayout; label: string; description: string }> = [
  { value: "title", label: "Title Slide", description: "Cover slide with heading and subtitle" },
  { value: "bullets", label: "Bullet Points", description: "Key summary points and insights" },
  { value: "two_column", label: "Two Columns", description: "Side-by-side comparison or sections" },
  { value: "stats", label: "Key Metrics", description: "High-impact numerical statistics" },
  { value: "process", label: "Process Steps", description: "Sequential timeline or workflow steps" },
  { value: "comparison", label: "Comparison", description: "Multi-column comparison grid" },
  { value: "quote", label: "Quote Callout", description: "Full-bleed quote and attribution" },
  { value: "closing", label: "Closing / CTA", description: "Next steps and call to action" },
];

/**
 * Pure immutability helpers for updating individual fields of a slide during inline canvas editing.
 */

export function updateSlideTitle(slide: SlideData, newTitle: string): SlideData {
  return {
    ...slide,
    title: newTitle,
  } as SlideData;
}

export function updateSlideBullet(slide: SlideData, bulletIndex: number, newText: string): SlideData {
  const currentBullets = Array.isArray((slide.content as any)?.bullets) ? [...(slide.content as any).bullets] : [];
  currentBullets[bulletIndex] = newText;
  return {
    ...slide,
    content: {
      ...(slide.content as any),
      bullets: currentBullets,
    },
  } as SlideData;
}

export function updateSlideSubtitle(slide: SlideData, newSubtitle: string): SlideData {
  return {
    ...slide,
    content: {
      ...(slide.content as any),
      subtitle: newSubtitle,
    },
  } as SlideData;
}

export function updateSlideStat(
  slide: SlideData,
  statIndex: number,
  field: "value" | "label",
  newValue: string
): SlideData {
  const currentStats = Array.isArray((slide.content as any)?.stats)
    ? (slide.content as any).stats.map((s: any, idx: number) => (idx === statIndex ? { ...s, [field]: newValue } : s))
    : [];
  return {
    ...slide,
    content: {
      ...(slide.content as any),
      stats: currentStats,
    },
  } as SlideData;
}

export function updateSlideColumn(
  slide: SlideData,
  colKey: "left" | "right",
  field: "heading" | "bullet",
  newValue: string,
  bulletIndex?: number
): SlideData {
  const colObj = (slide.content as any)?.[colKey];
  const currentCol = colObj ? { ...colObj } : { heading: "", bullets: [] };
  if (field === "heading") {
    currentCol.heading = newValue;
  } else if (field === "bullet" && typeof bulletIndex === "number") {
    const bullets = Array.isArray(currentCol.bullets) ? [...currentCol.bullets] : [];
    bullets[bulletIndex] = newValue;
    currentCol.bullets = bullets;
  }
  return {
    ...slide,
    content: {
      ...(slide.content as any),
      [colKey]: currentCol,
    },
  } as SlideData;
}

export function updateSlideQuote(
  slide: SlideData,
  field: "quote" | "attribution",
  newValue: string
): SlideData {
  return {
    ...slide,
    content: {
      ...(slide.content as any),
      [field]: newValue,
    },
  } as SlideData;
}

export function updateSlideProcessStep(
  slide: SlideData,
  stepIndex: number,
  field: "label" | "desc",
  newValue: string
): SlideData {
  const currentSteps = Array.isArray((slide.content as any)?.steps)
    ? (slide.content as any).steps.map((s: any, idx: number) => (idx === stepIndex ? { ...s, [field]: newValue } : s))
    : [];
  return {
    ...slide,
    content: {
      ...(slide.content as any),
      steps: currentSteps,
    },
  } as SlideData;
}

export function updateSlideClosing(
  slide: SlideData,
  field: "headline" | "cta",
  newValue: string
): SlideData {
  return {
    ...slide,
    content: {
      ...(slide.content as any),
      [field]: newValue,
    },
  } as SlideData;
}

export function updateSlideImageHeadingOrCaption(
  slide: SlideData,
  field: "heading" | "caption",
  newValue: string
): SlideData {
  return {
    ...slide,
    content: {
      ...(slide.content as any),
      [field]: newValue,
    },
  } as SlideData;
}

/**
 * Creates a clean default slide for the given layout.
 */
export function createDefaultSlide(layout: string, id?: string): SlideData {
  const slideId = id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `slide-${Date.now()}`);
  let defaultTitle = "Slide Title";
  let content: any = {};

  switch (layout) {
    case "title":
      defaultTitle = "Presentation Title";
      content = { subtitle: "Add subtitle or executive summary" };
      break;
    case "bullets":
      defaultTitle = "Key Highlights";
      content = {
        bullets: [
          "Primary takeaway or milestone",
          "Operational performance and strategic focus",
          "Next quarterly priorities and action items",
        ],
      };
      break;
    case "two_column":
      defaultTitle = "Comparative Analysis";
      content = {
        left: {
          heading: "Overview",
          bullets: ["Current operational foundation", "Baseline performance metrics"],
        },
        right: {
          heading: "Strategic Opportunities",
          bullets: ["Targeted expansion initiatives", "Projected efficiency gains"],
        },
      };
      break;
    case "stats":
      defaultTitle = "Key Performance Metrics";
      content = {
        stats: [
          { value: "40%", label: "Annual Growth" },
          { value: "$12M", label: "Net Revenue" },
          { value: "99.8%", label: "Customer Retention" },
        ],
      };
      break;
    case "process":
      defaultTitle = "Implementation Roadmap";
      content = {
        steps: [
          { label: "Phase 1", desc: "Discovery, alignment, and initial kickoff" },
          { label: "Phase 2", desc: "Execution, integration, and rollout" },
          { label: "Phase 3", desc: "Measurement, optimization, and scaling" },
        ],
      };
      break;
    case "comparison":
      defaultTitle = "Options Overview";
      content = {
        columns: [
          { heading: "Approach A", bullets: ["Fast time to value", "Lower upfront investment"] },
          { heading: "Approach B", bullets: ["Comprehensive scalability", "Long-term architecture"] },
        ],
      };
      break;
    case "quote":
      defaultTitle = "Strategic Perspective";
      content = {
        quote: "Innovation distinguishes between a leader and a follower.",
        attribution: "Executive Leadership",
      };
      break;
    case "closing":
      defaultTitle = "Next Steps";
      content = {
        headline: "Ready to Accelerate Growth",
        cta: "Schedule Follow-up",
      };
      break;
    case "image":
      defaultTitle = "Visual Spotlight";
      content = {
        variant: "split",
        imageKeyword: "leadership teamwork",
        heading: "Strategic Execution",
        bullets: ["Cross-functional collaboration", "Continuous alignment across teams"],
      };
      break;
    case "chart":
      defaultTitle = "Quarterly Trends";
      content = {
        chartType: "bar",
        categories: ["Q1", "Q2", "Q3", "Q4"],
        series: [{ name: "Metric", values: [15, 28, 35, 52] }],
        caption: "Quarterly performance progression",
      };
      break;
    default:
      defaultTitle = "Slide Title";
      content = { bullets: ["Key summary point", "Supporting insight"] };
      break;
  }

  return {
    id: slideId,
    layout,
    title: defaultTitle,
    notes: `Notes for ${defaultTitle}.`,
    content,
    regenerations: 0,
  } as SlideData;
}

/**
 * Duplicates a slide at index, resetting regenerations to 0 while keeping sourcePage & sourceSection.
 * Enforces MAX_DECK_SLIDES.
 */
export function duplicateSlide(
  slides: SlideData[],
  index: number
): { updated: SlideData[]; newIndex: number } {
  if (slides.length >= MAX_DECK_SLIDES) {
    throw new Error(`Deck cannot exceed maximum of ${MAX_DECK_SLIDES} slides.`);
  }
  if (index < 0 || index >= slides.length) {
    return { updated: slides, newIndex: index };
  }

  const target = slides[index];
  const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `slide-${Date.now()}`;

  // Deep clone content
  const clonedContent = JSON.parse(JSON.stringify(target.content || {}));

  const duplicate: SlideData = {
    ...JSON.parse(JSON.stringify(target)),
    id: newId,
    content: clonedContent,
    regenerations: 0,
    sourcePage: target.sourcePage,
    sourcePageApprox: target.sourcePageApprox,
    sourceSection: target.sourceSection,
  };

  const updated = [...slides];
  const newIndex = index + 1;
  updated.splice(newIndex, 0, duplicate);

  return { updated, newIndex };
}

/**
 * Deletes a slide at index, guarding that at least 1 slide remains.
 */
export function deleteSlide(
  slides: SlideData[],
  index: number
): { updated: SlideData[]; newIndex: number } {
  if (slides.length <= 1) {
    throw new Error("Cannot delete the only slide in a deck.");
  }
  if (index < 0 || index >= slides.length) {
    return { updated: slides, newIndex: index };
  }

  const updated = slides.filter((_, idx) => idx !== index);
  const newIndex = Math.min(index, updated.length - 1);
  return { updated, newIndex };
}

/**
 * Pure reordering helper for drag-and-drop and keyboard navigation.
 */
export function reorderSlides(
  slides: SlideData[],
  fromIndex: number,
  toIndex: number
): SlideData[] {
  if (
    fromIndex < 0 ||
    fromIndex >= slides.length ||
    toIndex < 0 ||
    toIndex >= slides.length ||
    fromIndex === toIndex
  ) {
    return slides;
  }

  const result = [...slides];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

/**
 * Extracts all user-visible text items from a slide's content into an ordered list of strings.
 * Used for lossless layout mapping.
 */
export function extractTextItemsFromContent(layout: string, content: any): string[] {
  if (!content || typeof content !== "object") return [];
  const items: string[] = [];

  if (Array.isArray(content.bullets)) {
    for (const b of content.bullets) {
      if (typeof b === "string" && b.trim()) items.push(b.trim());
    }
  }

  if (content.left && typeof content.left === "object" && Array.isArray(content.left.bullets)) {
    for (const b of content.left.bullets) {
      if (typeof b === "string" && b.trim()) items.push(b.trim());
    }
  }
  if (content.right && typeof content.right === "object" && Array.isArray(content.right.bullets)) {
    for (const b of content.right.bullets) {
      if (typeof b === "string" && b.trim()) items.push(b.trim());
    }
  }

  if (Array.isArray(content.steps)) {
    for (const s of content.steps) {
      const desc = typeof s?.desc === "string" ? s.desc.trim() : "";
      const label = typeof s?.label === "string" ? s.label.trim() : "";
      if (desc) items.push(desc);
      else if (label) items.push(label);
    }
  }

  if (Array.isArray(content.stats)) {
    for (const s of content.stats) {
      const val = typeof s?.value === "string" ? s.value.trim() : "";
      const lbl = typeof s?.label === "string" ? s.label.trim() : "";
      if (val && lbl) items.push(`${val} ${lbl}`);
      else if (lbl) items.push(lbl);
      else if (val) items.push(val);
    }
  }

  if (Array.isArray(content.columns)) {
    for (const col of content.columns) {
      if (Array.isArray(col?.bullets)) {
        for (const b of col.bullets) {
          if (typeof b === "string" && b.trim()) items.push(b.trim());
        }
      }
    }
  }

  if (typeof content.quote === "string" && content.quote.trim()) {
    items.push(content.quote.trim());
  }

  if (typeof content.subtitle === "string" && content.subtitle.trim()) {
    items.push(content.subtitle.trim());
  }

  if (typeof content.headline === "string" && content.headline.trim()) {
    items.push(content.headline.trim());
  }
  if (typeof content.cta === "string" && content.cta.trim()) {
    items.push(content.cta.trim());
  }

  return items;
}

/**
 * Switches a slide's layout safely:
 * - Preserves notes, sourcePage, sourceSection, id, regenerations.
 * - Preserves image fields (imageUrl, imagePlacement, imageKeyword, photographer, etc.)
 *   even when moving to a layout that does not show images, so switching back restores them.
 * - Lossless content conversion: maps text between layouts without data loss, falling back to bullets.
 * - Caches previously structured content in `_stash` so A -> B -> A roundtrips restore exact structures.
 */
export function switchSlideLayout(
  slide: SlideData,
  targetLayout: string
): SlideData {
  if (slide.layout === targetLayout) {
    return slide;
  }

  const currentContent = (slide.content || {}) as any;
  const stash = { ...(currentContent._stash || {}) };
  // Store current layout's content in stash
  stash[slide.layout] = { ...currentContent };
  delete stash[slide.layout]._stash;

  // Cap _stash size to max 8 layouts and <= 15KB serialized
  const stashKeys = Object.keys(stash);
  if (stashKeys.length > 8) {
    for (const k of stashKeys.slice(0, stashKeys.length - 8)) {
      delete stash[k];
    }
  }
  try {
    let stashStr = JSON.stringify(stash);
    if (stashStr.length > 15000) {
      const keys = Object.keys(stash);
      while (keys.length > 1 && JSON.stringify(stash).length > 15000) {
        delete stash[keys.shift()!];
      }
    }
  } catch {
    Object.keys(stash).forEach((k) => delete stash[k]);
  }

  // Preserve image fields
  const imageFields: Record<string, any> = {};
  for (const key of [
    "imageUrl",
    "imagePlacement",
    "imageKeyword",
    "imageQuery",
    "variant",
    "photographer",
    "photographerUrl",
    "caption",
  ]) {
    if (currentContent[key] !== undefined) {
      imageFields[key] = currentContent[key];
    }
  }

  let newContent: any = { ...imageFields };

  // If we have an exact cached version of the target layout from a previous edit in this session, restore it
  if (stash[targetLayout]) {
    newContent = {
      ...stash[targetLayout],
      ...imageFields,
      _stash: stash,
    };
    return {
      ...slide,
      layout: targetLayout,
      content: newContent,
    } as SlideData;
  }

  // Otherwise, do a lossless mapping based on extracted textual content
  const items = extractTextItemsFromContent(slide.layout, currentContent);
  const fallbackBullet = items[0] || slide.title || "Key strategic insight";

  switch (targetLayout) {
    case "bullets": {
      const bullets = items.length > 0 ? items.slice(0, 8) : [fallbackBullet];
      newContent.bullets = bullets;
      break;
    }

    case "two_column": {
      const leftHeading = currentContent.left?.heading || "Overview";
      const rightHeading = currentContent.right?.heading || "Details";
      const half = Math.ceil(items.length / 2);
      const leftBullets = items.slice(0, Math.max(1, half));
      const rightBullets = items.slice(Math.max(1, half), items.length);

      newContent.left = {
        heading: leftHeading,
        bullets: leftBullets.length ? leftBullets : [fallbackBullet],
      };
      newContent.right = {
        heading: rightHeading,
        bullets: rightBullets.length ? rightBullets : [items[1] || "Supporting operational metric"],
      };
      break;
    }

    case "process": {
      if (Array.isArray(currentContent.steps) && currentContent.steps.length > 0) {
        newContent.steps = currentContent.steps;
      } else {
        const stepsSource = items.length > 0 ? items.slice(0, 6) : [fallbackBullet, "Execution & delivery", "Optimization & scaling"];
        newContent.steps = stepsSource.map((text, idx) => ({
          label: `Phase ${idx + 1}`,
          desc: text,
        }));
      }
      break;
    }

    case "stats": {
      if (Array.isArray(currentContent.stats) && currentContent.stats.length > 0) {
        newContent.stats = currentContent.stats;
      } else {
        const statsSource = items.length > 0 ? items.slice(0, 4) : [fallbackBullet];
        newContent.stats = statsSource.map((text, idx) => {
          // If text contains a number or percentage, use it
          const numMatch = text.match(/(?:[\$€£₹])?\d+(?:[.,]\d+)*(?:%|[kKmMbBtT])?/);
          const value = numMatch ? numMatch[0] : `${(idx + 1) * 25}%`;
          const label = numMatch ? text.replace(numMatch[0], "").trim() || "Performance Metric" : text;
          return { value, label: label.slice(0, 80) };
        });
      }
      break;
    }

    case "comparison": {
      if (Array.isArray(currentContent.columns) && currentContent.columns.length > 0) {
        newContent.columns = currentContent.columns;
      } else {
        const half = Math.ceil(items.length / 2);
        const col1Bullets = items.slice(0, Math.max(1, half));
        const col2Bullets = items.slice(Math.max(1, half));
        newContent.columns = [
          { heading: "Option A", bullets: col1Bullets.length ? col1Bullets : [fallbackBullet] },
          { heading: "Option B", bullets: col2Bullets.length ? col2Bullets : ["Alternative implementation"] },
        ];
      }
      break;
    }

    case "quote": {
      newContent.quote = currentContent.quote || items[0] || slide.title || "Perspective on strategic excellence.";
      newContent.attribution = currentContent.attribution || currentContent.subtitle || "Executive Summary";
      break;
    }

    case "closing": {
      newContent.headline = currentContent.headline || slide.title || "Looking Forward";
      newContent.cta = currentContent.cta || items[0] || "Get Started";
      break;
    }

    case "title": {
      newContent.subtitle = currentContent.subtitle || items[0] || "Strategic Presentation";
      break;
    }

    case "image": {
      newContent.variant = currentContent.variant || "split";
      newContent.imageKeyword = currentContent.imageKeyword || "business strategy";
      newContent.heading = currentContent.heading || slide.title;
      newContent.bullets = items.length > 0 ? items.slice(0, 4) : [fallbackBullet];
      break;
    }

    case "chart": {
      newContent.chartType = currentContent.chartType || "bar";
      newContent.categories = currentContent.categories || ["Q1", "Q2", "Q3", "Q4"];
      newContent.series = currentContent.series || [{ name: "Metric", values: [20, 35, 50, 75] }];
      newContent.caption = currentContent.caption || items[0] || "Quarterly progression";
      break;
    }

    default: {
      newContent.bullets = items.length > 0 ? items : [fallbackBullet];
      break;
    }
  }

  newContent._stash = stash;

  return {
    ...slide,
    layout: targetLayout,
    content: newContent,
  } as SlideData;
}

/**
 * Strips internal _stash metadata from slide content so it is never leaked
 * to PPTX exports, public responses, number grounding, or AI contexts.
 */
export function stripStashFromSlide<T extends { content?: any }>(slide: T): T {
  if (!slide || !slide.content || typeof slide.content !== "object") return slide;
  if (!("_stash" in slide.content)) return slide;
  const { _stash, ...cleanContent } = slide.content;
  return {
    ...slide,
    content: cleanContent,
  };
}

export function stripStashFromDeck<T extends { slides?: any[] }>(deck: T): T {
  if (!deck || !Array.isArray(deck.slides)) return deck;
  return {
    ...deck,
    slides: deck.slides.map(stripStashFromSlide),
  };
}

/**
 * Debounce controller for keyboard slide reordering.
 * Ensures moves are debounced (~500ms) during rapid navigation,
 * but immediately flushed before any other mutation, on unmount, or on beforeunload.
 */
export class ReorderDebounceManager {
  private timer: NodeJS.Timeout | null = null;
  private pendingSlides: any[] | null = null;
  private commitFn: (slides: any[]) => void;
  private delay: number;

  constructor(commitFn: (slides: any[]) => void, delay = 500) {
    this.commitFn = commitFn;
    this.delay = delay;
  }

  schedule(slides: any[]) {
    this.pendingSlides = slides;
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.flush();
    }, this.delay);
  }

  hasPending(): boolean {
    return this.timer !== null || this.pendingSlides !== null;
  }

  flush(): boolean {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pendingSlides) {
      const slides = this.pendingSlides;
      this.pendingSlides = null;
      this.commitFn(slides);
      return true;
    }
    return false;
  }

  cancel() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingSlides = null;
  }
}

