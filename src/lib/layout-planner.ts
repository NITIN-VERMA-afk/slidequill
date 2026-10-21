import { openai } from "./openai";
import type { OutlineSection } from "@/app/models/Deck";
import { countGroundedNumbersInExcerpt } from "./slides-schema";

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
 * 4. At least 1 visual or quote slide (image, quote, or two_column).
 * 5. Grounding integrity: "chart" requires >= 3 numeric values in excerpt,
 *    "stats" requires >= 2 numeric values in excerpt.
 *    Neither can be assigned without a usable excerpt.
 *    (Forced stats/chart rules per deck are REMOVED).
 */
export function validateLayoutPlan(
  layouts: SlideLayoutType[],
  excerpts?: (string | undefined)[]
): LayoutPlanValidation {
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

  // Stats / chart count tracked for statistics only (forced rule removed per A2)
  const statsCount = layouts.filter((l) => l === "stats" || l === "chart").length;

  // 4. At least 1 visual/quote slide
  const visualCount = layouts.filter((l) => l === "image" || l === "quote" || l === "two_column").length;
  if (total >= 4 && visualCount === 0) {
    violations.push("Deck must include at least 1 visual or quote slide ('image', 'quote', or 'two_column')");
  }

  // 5. Excerpt grounding verification:
  // - "chart" requires at least 3 distinct numeric values in excerpt
  // - "stats" requires at least 2 distinct numeric values in excerpt
  // - Never assign chart or stats to a section with no usable excerpt
  if (excerpts) {
    for (let i = 0; i < total; i++) {
      const layout = layouts[i];
      if (layout === "chart" || layout === "stats") {
        const excerpt = excerpts[i];
        if (!excerpt || typeof excerpt !== "string" || !excerpt.trim()) {
          violations.push(`Slide ${i + 1} has '${layout}' layout but section has no usable excerpt`);
          continue;
        }
        const numCount = countGroundedNumbersInExcerpt(excerpt);
        if (layout === "chart" && numCount < 3) {
          violations.push(`Slide ${i + 1} has 'chart' layout but excerpt only has ${numCount} grounded numeric values (minimum 3 required)`);
        } else if (layout === "stats" && numCount < 2) {
          violations.push(`Slide ${i + 1} has 'stats' layout but excerpt only has ${numCount} grounded numeric values (minimum 2 required)`);
        }
      }
    }
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
 * Strictly grounds "chart" (requires >= 3 numbers in excerpt) and "stats" (requires >= 2 numbers in excerpt).
 * Never forces a stats or chart slide per deck, and never assigns chart/stats to a section without a usable excerpt.
 */
export function buildDeterministicLayoutPlan(
  outline: OutlineSection[],
  suggestedLayouts?: SlideLayoutType[],
  excerpts?: (string | undefined)[]
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
    const sectionExcerpt = excerpts?.[i] ?? (outline[i] as any)?.excerpt;
    const numGrounded = countGroundedNumbersInExcerpt(sectionExcerpt);

    if (suggestedLayouts && suggestedLayouts[i] && suggestedLayouts[i] !== "title" && suggestedLayouts[i] !== "closing") {
      const sug = suggestedLayouts[i];
      if (sug === "chart") {
        if (numGrounded >= 3) {
          result[i] = "chart";
          continue;
        }
        if (numGrounded >= 2) {
          result[i] = "stats";
          continue;
        }
        // Fallback to bullets/two_column
      } else if (sug === "stats") {
        if (numGrounded >= 2) {
          result[i] = "stats";
          continue;
        }
        // Fallback to bullets/two_column
      } else {
        result[i] = sug;
        continue;
      }
    }

    const titleLower = outline[i]?.title?.toLowerCase() || "";
    const pointsText = (outline[i]?.points || []).join(" ").toLowerCase();
    const combined = `${titleLower} ${pointsText}`;

    // Only assign chart if numGrounded >= 3, or stats if numGrounded >= 2
    if (numGrounded >= 3 && /\b(chart|trend|growth|comparison|performance|timeline)\b/i.test(combined)) {
      result[i] = "chart";
    } else if (numGrounded >= 2 && /\b(stat|metric|revenue|growth|percent|%|kpi|data|number|score|benchmark)\b/i.test(combined)) {
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

  // NOTE: Any rule forcing stats or chart per deck is REMOVED per A2.

  // Ensure at least 1 visual/quote slide (image, quote, or two_column)
  const visualCount = result.filter((l) => l === "image" || l === "quote" || l === "two_column").length;
  if (total >= 4 && visualCount === 0) {
    const candidateIdx = Math.min(2, total - 2);
    if (candidateIdx > 0 && candidateIdx < total - 1) {
      result[candidateIdx] = "image";
    }
  }

  // Enforce max 40% bullets: convert excess bullets to diverse alternative layouts (never arbitrarily chart/stats)
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
      const sectionExcerpt = excerpts?.[i + 2] ?? (outline[i + 2] as any)?.excerpt;
      const numGrounded = countGroundedNumbersInExcerpt(sectionExcerpt);

      const candidatePool: SlideLayoutType[] = [
        "two_column",
        "process",
        "image",
        "comparison",
        ...(numGrounded >= 2 ? (["stats"] as SlideLayoutType[]) : []),
        ...(numGrounded >= 3 ? (["chart"] as SlideLayoutType[]) : []),
      ];
      const pool = candidatePool.filter((l) => l !== current && l !== result[i + 3]);
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
  model: string = "gpt-4o-mini",
  excerpts?: (string | undefined)[]
): Promise<PlannedLayout[]> {
  const total = outline.length;
  if (total === 0) return [];
  if (total <= 2) {
    return buildDeterministicLayoutPlan(outline, undefined, excerpts).map((layout, index) => ({ index, layout }));
  }

  const promptSections = outline.map((s, idx) => {
    const secExcerpt = excerpts?.[idx] ?? (s as any)?.excerpt;
    const numGrounded = countGroundedNumbersInExcerpt(secExcerpt);
    return {
      index: idx,
      title: s.title,
      points: s.points,
      groundedNumericCount: numGrounded,
      hasExcerpt: Boolean(secExcerpt && secExcerpt.trim()),
    };
  });

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
5. Must include at least one visual slide ("image", "quote", or "two_column").
6. CRITICAL DATA INTEGRITY:
   - ONLY assign "chart" if the section excerpt contains at least 3 distinct numeric values (groundedNumericCount >= 3).
   - ONLY assign "stats" if the section excerpt contains at least 2 distinct numeric values (groundedNumericCount >= 2).
   - NEVER assign "chart" or "stats" to a section without a usable excerpt or with insufficient numbers.

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
          content: `Deck Title: "${deckTitle}"\nTotal Slides: ${total}\n\nOutline with Numeric Availability:\n${JSON.stringify(promptSections, null, 2)}`,
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

    const validation = validateLayoutPlan(suggestedLayouts, excerpts);
    if (validation.valid) {
      return suggestedLayouts.map((layout, index) => {
        const item = rawPlan.find((p) => p.index === index);
        return { index, layout, reason: item?.reason };
      });
    }

    console.warn("[LayoutPlanner] AI layout plan had violations, repairing deterministically:", validation.violations);
    const repaired = buildDeterministicLayoutPlan(outline, suggestedLayouts, excerpts);
    return repaired.map((layout, index) => ({ index, layout, reason: "Repaired for diversity constraints" }));
  } catch (err) {
    console.warn("[LayoutPlanner] Failed to generate AI layout plan, using deterministic planner:", err);
    const fallback = buildDeterministicLayoutPlan(outline, undefined, excerpts);
    return fallback.map((layout, index) => ({ index, layout, reason: "Deterministic diversity plan" }));
  }
}

