import { openai } from "./openai";
import type { OutlineSection } from "@/app/models/Deck";

export type SlideLayoutType =
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

export interface PlannedLayout {
  index: number;
  layout: SlideLayoutType;
  reason?: string;
}

export interface LayoutPlanValidation {
  valid: boolean;
  violations: string[];
  bulletRatio: number;
  statsCount: number;
  visualCount: number;
}

/**
 * Validates whether a deck layout plan satisfies all diversity constraints:
 * 1. Exactly 1 title (slide 1) and 1 closing (last slide).
 * 2. Never more than 40% bullet layouts in total.
 * 3. No 3 consecutive slides with the same layout.
 * 4. At least 1 stats/numbers slide per 6+ slides.
 * 5. At least 1 visual or quote slide (image, quote, or two_column).
 */
export function validateLayoutPlan(layouts: SlideLayoutType[]): LayoutPlanValidation {
  const violations: string[] = [];
  const total = layouts.length;

  if (total === 0) {
    return { valid: false, violations: ["Empty layouts array"], bulletRatio: 0, statsCount: 0, visualCount: 0 };
  }

  // 1. Title & Closing
  if (layouts[0] !== "title") {
    violations.push(`Slide 1 must be 'title', got '${layouts[0]}'`);
  }
  if (total > 1 && layouts[total - 1] !== "closing") {
    violations.push(`Last slide must be 'closing', got '${layouts[total - 1]}'`);
  }

  // 2. Max 40% bullets
  const bulletCount = layouts.filter((l) => l === "bullets").length;
  const bulletRatio = total > 0 ? bulletCount / total : 0;
  if (bulletRatio > 0.40) {
    violations.push(`Bullet layout ratio (${(bulletRatio * 100).toFixed(1)}%) exceeds 40% maximum (${bulletCount}/${total} slides)`);
  }

  // 3. No 3 consecutive slides with the same layout
  for (let i = 0; i <= total - 3; i++) {
    if (layouts[i] === layouts[i + 1] && layouts[i + 1] === layouts[i + 2]) {
      violations.push(`3 consecutive slides have the same layout '${layouts[i]}' at positions ${i + 1}, ${i + 2}, ${i + 3}`);
    }
  }

  // 4. At least 1 stats/numbers slide per 6+ slides
  const statsCount = layouts.filter((l) => l === "stats" || l === "chart").length;
  if (total >= 6 && statsCount === 0) {
    violations.push(`Deck with ${total} slides must include at least 1 'stats' or 'chart' slide`);
  }

  // 5. At least 1 visual/quote slide
  const visualCount = layouts.filter((l) => l === "image" || l === "quote" || l === "two_column").length;
  if (total >= 4 && visualCount === 0) {
    violations.push("Deck must include at least 1 visual or quote slide ('image', 'quote', or 'two_column')");
  }

  return {
    valid: violations.length === 0,
    violations,
    bulletRatio,
    statsCount,
    visualCount,
  };
}

/**
 * Deterministically constructs or repairs a layout plan to guarantee all diversity constraints are met.
 */
export function buildDeterministicLayoutPlan(
  outline: OutlineSection[],
  suggestedLayouts?: SlideLayoutType[]
): SlideLayoutType[] {
  const total = outline.length;
  if (total === 0) return [];
  if (total === 1) return ["title"];
  if (total === 2) return ["title", "closing"];

  // Initialize from suggested or infer from content keywords
  const result: SlideLayoutType[] = Array(total).fill("bullets");
  result[0] = "title";
  result[total - 1] = "closing";

  for (let i = 1; i < total - 1; i++) {
    if (suggestedLayouts && suggestedLayouts[i] && suggestedLayouts[i] !== "title" && suggestedLayouts[i] !== "closing") {
      result[i] = suggestedLayouts[i];
      continue;
    }

    const titleLower = outline[i]?.title?.toLowerCase() || "";
    const pointsText = (outline[i]?.points || []).join(" ").toLowerCase();
    const combined = `${titleLower} ${pointsText}`;

    if (/\b(stat|metric|revenue|growth|percent|%|kpi|data|number|score|benchmark)\b/i.test(combined)) {
      result[i] = "stats";
    } else if (/\b(step|phase|stage|roadmap|timeline|process|journey|implementation|workflow)\b/i.test(combined)) {
      result[i] = "process";
    } else if (/\b(vs|versus|compare|comparison|pros|cons|option|alternative|before|after)\b/i.test(combined)) {
      result[i] = "two_column";
    } else if (/\b(quote|quote:|said|vision|credo|statement|belief|mission)\b/i.test(combined)) {
      result[i] = "quote";
    } else if (/\b(architecture|overview|spotlight|ecosystem|visual|landscape|breakdown)\b/i.test(combined)) {
      result[i] = "image";
    } else {
      result[i] = "bullets";
    }
  }

  // Ensure at least 1 stats/chart slide if >= 6 slides
  const statsCount = result.filter((l) => l === "stats" || l === "chart").length;
  if (total >= 6 && statsCount === 0) {
    // Pick the best middle slide to become a stats slide
    const candidateIdx = Math.floor(total / 2);
    if (candidateIdx > 0 && candidateIdx < total - 1) {
      result[candidateIdx] = "stats";
    }
  }

  // Ensure at least 1 visual/quote slide
  const visualCount = result.filter((l) => l === "image" || l === "quote" || l === "two_column").length;
  if (total >= 4 && visualCount === 0) {
    const candidateIdx = Math.min(2, total - 2);
    if (candidateIdx > 0 && candidateIdx < total - 1) {
      result[candidateIdx] = "image";
    }
  }

  // Enforce max 40% bullets: convert excess bullets to diverse alternative layouts
  const maxBullets = Math.floor(total * 0.40);
  let currentBullets = result.filter((l) => l === "bullets").length;
  const alternates: SlideLayoutType[] = ["two_column", "process", "image", "comparison"];
  let altIdx = 0;

  if (currentBullets > maxBullets) {
    for (let i = 1; i < total - 1 && currentBullets > maxBullets; i++) {
      if (result[i] === "bullets") {
        result[i] = alternates[altIdx % alternates.length];
        altIdx++;
        currentBullets--;
      }
    }
  }

  // Enforce no 3 consecutive identical layouts
  for (let i = 0; i <= total - 3; i++) {
    if (result[i] === result[i + 1] && result[i + 1] === result[i + 2]) {
      const current = result[i + 2];
      const pool: SlideLayoutType[] = (["two_column", "process", "image", "stats", "comparison"] as SlideLayoutType[]).filter(
        (l) => l !== current && l !== result[i + 3]
      );
      result[i + 2] = pool[0] || "two_column";
    }
  }

  return result;
}

/**
 * Plans deck layouts via OpenAI with structured validation and automatic fallback.
 */
export async function planDeckLayouts(
  deckTitle: string,
  outline: OutlineSection[],
  model: string = "gpt-4o-mini"
): Promise<PlannedLayout[]> {
  const total = outline.length;
  if (total === 0) return [];
  if (total <= 2) {
    return buildDeterministicLayoutPlan(outline).map((layout, index) => ({ index, layout }));
  }

  const promptSections = outline.map((s, idx) => ({
    index: idx,
    title: s.title,
    points: s.points,
  }));

  const systemPrompt = `You are a world-class presentation designer and creative director.
Your role is to assign the optimal layout for each slide in a presentation deck to ensure maximum narrative impact, visual engagement, and aesthetic diversity.

ALLOWED LAYOUTS:
- "title": Presentation opener (slide index 0 ONLY).
- "bullets": Structured list of key takeaways.
- "two_column": Side-by-side comparison, dual perspectives, or pro/con.
- "stats": Key numerical highlights, percentages, or standalone metric cards.
- "process": Step-by-step linear workflow, chronological sequence, or roadmap phases.
- "comparison": Multi-column options or product comparisons.
- "quote": Notable statement, customer quote, or vision philosophy.
- "closing": Presentation conclusion with call-to-action (final slide index ONLY).
- "chart": Visual data graph (bar/line/pie).
- "image": Dedicated photo visual showcase (split or full-bleed).

MANDATORY RULES:
1. Index 0 MUST be "title".
2. The final index (${total - 1}) MUST be "closing".
3. NEVER assign "bullets" to more than 40% of the slides in total (max ${Math.floor(total * 0.40)} bullet slides for this deck).
4. NEVER assign the same layout to 3 consecutive slides (e.g. no bullets -> bullets -> bullets).
5. Decks with 6+ slides MUST include at least one "stats" or "chart" slide.
6. Must include at least one visual slide ("image", "quote", or "two_column").

Output strictly valid JSON:
{
  "plan": [
    { "index": 0, "layout": "title", "reason": "Opening slide" }
  ]
}`;

  try {
    const res = await openai.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Deck Title: "${deckTitle}"\nTotal Slides: ${total}\n\nOutline:\n${JSON.stringify(promptSections, null, 2)}`,
        },
      ],
    });

    const parsed = JSON.parse(res.choices[0]?.message?.content || "{}");
    const rawPlan: { index: number; layout: SlideLayoutType; reason?: string }[] = parsed.plan || [];

    const suggestedLayouts: SlideLayoutType[] = [];
    for (let i = 0; i < total; i++) {
      const match = rawPlan.find((p) => p.index === i);
      suggestedLayouts.push(match?.layout || "bullets");
    }

    const validation = validateLayoutPlan(suggestedLayouts);
    if (validation.valid) {
      return suggestedLayouts.map((layout, index) => {
        const item = rawPlan.find((p) => p.index === index);
        return { index, layout, reason: item?.reason };
      });
    }

    console.warn("[LayoutPlanner] AI layout plan had violations, repairing deterministically:", validation.violations);
    const repaired = buildDeterministicLayoutPlan(outline, suggestedLayouts);
    return repaired.map((layout, index) => ({ index, layout, reason: "Repaired for diversity constraints" }));
  } catch (err) {
    console.warn("[LayoutPlanner] Failed to generate AI layout plan, using deterministic planner:", err);
    const fallback = buildDeterministicLayoutPlan(outline);
    return fallback.map((layout, index) => ({ index, layout, reason: "Deterministic diversity plan" }));
  }
}
