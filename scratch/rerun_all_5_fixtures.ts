import "./load_env";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { randomUUID } from "crypto";

const projectRoot = "e:/projects/Slidequill/slidequill";

import { OpenAI } from "openai";
import {
  calculateTargetSectionCount,
  getSourceExcerptForSection,
} from "../src/lib/longdoc";
import {
  planDeckLayouts,
  validateLayoutPlan,
} from "../src/lib/layout-planner";
import {
  SlideSchema,
  sanitizeSlidePayload,
  buildFallbackBulletsSlide,
  validateAndSanitizeSourcePage,
  groundAndSanitizeSlide,
  type SlideData,
} from "../src/lib/slides-schema";
import { searchStockImage, validateAndCleanImageQuery, isDataHeavyBulletList } from "../src/lib/image-search";
import { buildPptx } from "../src/lib/export/pptx";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error("Missing OPENAI_API_KEY");
}
const openai = new OpenAI({ apiKey });
const SLIDES_MODEL = process.env.SLIDES_MODEL ?? "gpt-4o-mini";

const SYSTEM_PROMPT = `You are an elite presentation designer and information architect.
The user will provide a presentation topic/section and a target layout. Your task is to generate ONE beautifully designed slide strictly matching the requested layout.

LAYOUT REQUIREMENTS:
- If layout is "title": Title must be a powerful concluding headline (max 8 words, 65 chars). Optional subtitle (max 15 words, 100 chars). imageQuery (specific 2-4 word visual query, NO generic business cliches), imagePlacement: "background".
- If layout is "bullets": Headline stating the takeaway. 3 to 4 bullets max (never exceed 4 bullets). Max 12 words, 90 chars per bullet. If bullets contain metrics/statistics, do NOT provide an imageQuery.
- If layout is "stats": 2 to 4 impactful numerical stats. Stat value (e.g. "+42%", "3.5x", "₹12.4Cr", "$85M"), stat label max 8 words (55 chars). Optional icon. NO images.
- If layout is "chart": chartType ("bar" | "line" | "pie"), categories (2-6 items), series (1-2 numeric arrays). All numbers must be directly from source text. NO images.
- If layout is "process": 3 to 5 chronological or logical steps. Step label max 5 words, description max 10 words. Optional icon. NO images.
- If layout is "two_column": 2 distinct perspectives/columns. Each column has heading + 2-3 bullets. Optional imageQuery, imagePlacement: "right".
- If layout is "comparison": 2-3 comparison columns with structured points. NO images.
- If layout is "quote": memorable testimonial or key quote (max 30 words, 220 chars), attribution max 8 words. Optional imageQuery, imagePlacement: "background".
- If layout is "closing": inspiring final takeaway + call to action. imageQuery (2-4 words), imagePlacement: "background".

IMAGES & VISUAL ENHANCEMENT (STRICT):
- Specificity: "imageQuery" MUST be a highly specific 2 to 4 word search keyword directly describing a concrete visual subject, NOT a generic topic.
  - Good: "solar panel rooftop installation", "electric vehicle battery assembly", "biochemical laboratory microscope", "container shipping crane harbor".
  - Strictly Forbidden: Generic 1-word abstracts like "data", "energy", "success", "technology", "business", "growth", "finance", "analytics", "abstract", "network", "cloud", "security", "teamwork", "ai", "money".
  - Strictly Forbidden Prefixes: NEVER write "a photo of", "picture of", or "image of".
- Deck Uniqueness: Every slide with an image in the deck MUST have a distinct, non-overlapping search query. No two slides in the same deck may use the exact same imageQuery.
- Data-heavy exclusion: If a "bullets" slide is data-heavy (contains statistics, numbers, percentages, financial metrics), do NOT provide an "imageQuery". Text readability comes first!

Output strictly in JSON:
{
  "title": "string (conclusion headline, max 65 chars)",
  "notes": "string (1-2 sentences speaker notes)",
  "layout": "title" | "bullets" | "two_column" | "stats" | "process" | "comparison" | "quote" | "closing" | "chart" | "image",
  "content": { ... }
}`;

interface FixtureSpec {
  file: string;
  label: string;
  theme: string;
  estPages: number;
}

const fixtures: FixtureSpec[] = [
  { file: "5-page.txt", label: "Q3 Business Review", theme: "modern", estPages: 5 },
  { file: "30-page.txt", label: "Enterprise Portfolio Strategy", theme: "corporate", estPages: 30 },
  { file: "80-page.txt", label: "Multi-Division Annual Report", theme: "elegant", estPages: 80 },
  { file: "30-page-mixed.txt", label: "India Market Dynamics (Mixed)", theme: "playful", estPages: 30 },
  { file: "20-page-hindi.txt", label: "Corporate Financial Analysis (Hindi)", theme: "creative", estPages: 20 },
];

async function callOpenAI(messages: { role: "system" | "user" | "assistant"; content: string }[]) {
  const completion = await openai.chat.completions.create({
    model: SLIDES_MODEL,
    response_format: { type: "json_object" },
    temperature: 0.5,
    messages,
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  return { parsed, usage: completion.usage };
}

async function runSingleFixture(fixture: FixtureSpec) {
  console.log(`\n======================================================`);
  console.log(`Starting Run for: ${fixture.label} (${fixture.file})`);
  console.log(`======================================================`);

  const filePath = path.join(projectRoot, "src/fixtures", fixture.file);
  const text = fs.readFileSync(filePath, "utf-8");
  const charCount = text.length;
  const startTime = Date.now();

  // 1. Scaling calculation
  const scaling = calculateTargetSectionCount(charCount, undefined, fixture.estPages);
  console.log(
    `Scaling calculated: target ${scaling.targetSections} sections (${scaling.minSections}-${scaling.maxSections}) [${charCount} chars, ${fixture.estPages} pages]`
  );

  // 2. Generate outline matching scaled section count
  const outlinePrompt = `You are an expert presentation architect.
Create a presentation outline with EXACTLY ${scaling.targetSections} cohesive sections for this document in JSON:
{
  "sections": [
    { "id": "1", "title": "Heading", "points": ["Key point 1", "Key point 2"], "pageRange": { "start": 1, "end": 2 } }
  ]
}`;
  const outlineRes = await callOpenAI([
    { role: "system", content: outlinePrompt },
    { role: "user", content: `Deck Title: "${fixture.label}"\n\n<document>\n${text.slice(0, 35000)}\n</document>` },
  ]);

  const rawSections = Array.isArray(outlineRes.parsed)
    ? outlineRes.parsed
    : (outlineRes.parsed as any).sections || (outlineRes.parsed as any).outline || [];

  let outlineSections = rawSections.map((s: any, idx: number) => ({
    id: s.id || String(idx + 1),
    title: s.title || `Section ${idx + 1}`,
    points: Array.isArray(s.points) && s.points.length >= 2 ? s.points : ["Strategic overview", "Key performance takeaways"],
    pageRange: s.pageRange,
  }));

  // Ensure minimum sections
  while (outlineSections.length < scaling.minSections) {
    const idx = outlineSections.length + 1;
    outlineSections.push({
      id: `s${idx}`,
      title: `Strategic Focus Area ${idx}`,
      points: ["Operational execution milestone", "Delivering targeted performance"],
      pageRange: { start: idx, end: idx + 1 },
    });
  }
  // Trim if exceeds max
  if (outlineSections.length > scaling.maxSections) {
    outlineSections = outlineSections.slice(0, scaling.maxSections);
  }

  console.log(`Outline prepared: ${outlineSections.length} sections`);

  // 3. Plan Layouts via Deck-Level Layout Planner
  const layoutPlan = await planDeckLayouts(fixture.label, outlineSections, SLIDES_MODEL);
  console.log(`Layout plan generated:`, layoutPlan.map((p) => `${p.index + 1}:${p.layout}`).join(" -> "));

  const planValidation = validateLayoutPlan(layoutPlan.map((p) => p.layout));
  console.log(`Plan validation results:`, planValidation);

  // 4. Generate slides
  const slides: SlideData[] = [];
  let fallbackCount = 0;
  for (let i = 0; i < outlineSections.length; i++) {
    const section = outlineSections[i];
    const isFirst = i === 0;
    const isLast = i === outlineSections.length - 1;
    const targetLayout = layoutPlan[i]?.layout || (isFirst ? "title" : isLast ? "closing" : "bullets");

    let context = `Deck Title: ${fixture.label}\n\nSection Title: ${section.title}\nSection Points:\n${section.points.map((p: string) => `- ${p}`).join("\n")}`;
    const excerpt = getSourceExcerptForSection(text, section.pageRange);
    if (excerpt) {
      context += `\n\nOriginal Source Document Excerpt:\n<source_excerpt>\n${excerpt}\n</source_excerpt>`;
    }
    context += `\n\nASSIGNED LAYOUT: "${targetLayout}". You MUST generate this slide with layout "${targetLayout}".`;

    const res = await callOpenAI([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: context },
    ]);

    const sanitizeStats = { truncations: 0 };
    const sanitized = sanitizeSlidePayload(res.parsed, isFirst, isLast, sanitizeStats, fixture.estPages);
    if (sanitized.layout !== targetLayout && !isFirst && !isLast) {
      sanitized.layout = targetLayout;
    }
    const parsed = SlideSchema.safeParse(sanitized);

    let finalSlide: SlideData;
    if (parsed.success) {
      finalSlide = { ...parsed.data, id: randomUUID(), sourceSection: section.title };
    } else {
      fallbackCount++;
      console.warn(`Slide ${i + 1} validation failed, applying fallback for layout ${targetLayout}`);
      finalSlide = { ...buildFallbackBulletsSlide(section.title, section.points), id: randomUUID(), sourceSection: section.title };
    }
    slides.push(groundAndSanitizeSlide(finalSlide, text));
  }

  // 5. Deduplicate and resolve images
  const usedPhotoIds = new Set<string>();
  const usedQueriesInDeck = new Set<string>();
  const imageLog: Array<{ slideIdx: number; title: string; query: string; source: string; photographer: string; photoId: string; url: string }> = [];

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

    const rawQuery = (c?.imageQuery || c?.imageKeyword || (slide.layout === "title" ? slide.title : "")).trim();
    const isTitleOrClosing = slide.layout === "title" || slide.layout === "closing";

    if (rawQuery && (!c?.imageUrl || !c.imageUrl.startsWith("http"))) {
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
          imageLog.push({
            slideIdx: idx + 1,
            title: slide.title,
            query,
            source: stock.source,
            photographer: stock.photographer,
            photoId: stock.id || "N/A",
            url: stock.url,
          });
        } else {
          delete c.imageUrl;
          delete c.photoId;
          delete c.photographer;
          delete c.photographerUrl;
          c.imagePlacement = "none";
        }
      } catch (err) {
        console.warn(`Failed image lookup for slide ${idx + 1}: ${query}`);
        delete c.imageUrl;
        delete c.photoId;
        delete c.photographer;
        delete c.photographerUrl;
        c.imagePlacement = "none";
      }
    }
  }

  // Layout distribution & verification
  const layoutCounts: Record<string, number> = {};
  for (const s of slides) {
    layoutCounts[s.layout] = (layoutCounts[s.layout] || 0) + 1;
  }
  const bulletCount = layoutCounts["bullets"] || 0;
  const bulletPct = Math.round((bulletCount / slides.length) * 100);
  const statsOrChartCount = (layoutCounts["stats"] || 0) + (layoutCounts["chart"] || 0);

  // Check unique photos
  const photoIds = imageLog.map((img) => img.photoId || img.url);
  const uniquePhotoIds = new Set(photoIds);
  const duplicatePhotos = photoIds.length - uniquePhotoIds.size;

  // Build PPTX
  const pptxBuffer = await buildPptx(fixture.label, slides, fixture.theme, false);
  const exportDir = path.join(projectRoot, "exports", "rerun");
  fs.mkdirSync(exportDir, { recursive: true });
  const exportPath = path.join(exportDir, `${fixture.file.replace(".txt", "")}.pptx`);
  fs.writeFileSync(exportPath, pptxBuffer);

  console.log(`Saved PPTX to ${exportPath} (${Math.round(pptxBuffer.length / 1024)} KB)`);

  return {
    fixture: fixture.file,
    label: fixture.label,
    theme: fixture.theme,
    chars: charCount,
    generationTimeMs: Date.now() - startTime,
    slideCount: slides.length,
    scalingTarget: scaling.targetSections,
    layoutDistribution: layoutCounts,
    bulletPct,
    statsOrChartCount,
    hasStatsOrChart: statsOrChartCount >= 1,
    validPlan: planValidation.valid,
    planViolations: planValidation.violations,
    totalImages: imageLog.length,
    uniqueImages: uniquePhotoIds.size,
    duplicatePhotos,
    fallbackSlides: fallbackCount,
    pptxPath: exportPath,
    slides: slides.map((s, idx) => ({
      idx: idx + 1,
      layout: s.layout,
      title: s.title,
      content: s.content,
      hasImage: Boolean((s.content as any)?.imageUrl),
      imageQuery: (s.content as any)?.imageQuery || (s.content as any)?.imageKeyword,
      photoId: (s.content as any)?.photoId,
      photographer: (s.content as any)?.photographer,
      bulletCount: Array.isArray((s.content as any)?.bullets) ? (s.content as any).bullets.length : undefined,
    })),
  };
}

async function main() {
  const results = [];
  const exportPngDir = path.join(projectRoot, "exports", "rerun", "pngs");
  fs.mkdirSync(exportPngDir, { recursive: true });

  for (const f of fixtures) {
    try {
      const res = await runSingleFixture(f);
      results.push(res);
    } catch (e: any) {
      console.error(`Error processing fixture ${f.file}:`, e);
      results.push({ fixture: f.file, error: e.message });
    }
  }

  // Save report
  const summaryPath = path.join(projectRoot, "exports", "rerun", "rerun_results.json");
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  console.log(`\nAll 5 fixtures finished. Saved results to ${summaryPath}`);

  // Render representative PPTX to PNG using PowerPoint COM
  // Render 5-page.txt, 30-page.txt, and 80-page.txt
  const pptxToRender = [
    path.join(projectRoot, "exports", "rerun", "5-page.pptx"),
    path.join(projectRoot, "exports", "rerun", "30-page.pptx"),
    path.join(projectRoot, "exports", "rerun", "80-page.pptx"),
    path.join(projectRoot, "exports", "rerun", "20-page-hindi.pptx"),
    path.join(projectRoot, "exports", "rerun", "30-page-mixed.pptx"),
  ];

  for (const pptx of pptxToRender) {
    if (fs.existsSync(pptx)) {
      const name = path.basename(pptx, ".pptx");
      const outSubDir = path.join(exportPngDir, name);
      console.log(`Rendering ${pptx} -> ${outSubDir}`);
      try {
        execSync(`python scratch/render_pptx_to_png.py "${pptx}" "${outSubDir}"`, {
          cwd: projectRoot,
          stdio: "inherit",
        });
      } catch (err) {
        console.error(`Error rendering PPTX for ${name}:`, err);
      }
    }
  }

  console.log(`\nRendering complete!`);
}

main().catch(console.error);
