import "./load_env";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
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
  groundAndSanitizeSlide,
  type SlideData,
} from "../src/lib/slides-schema";
import {
  searchStockImage,
  validateAndCleanImageQuery,
  isDataHeavyBulletList,
  resetHourlyBudget,
  getHourlyBudgetUsage,
} from "../src/lib/image-search";

const projectRoot = "e:/projects/Slidequill/slidequill";

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
- Specificity: "imageQuery" MUST be a highly specific 2 to 4 word search keyword directly describing a concrete visual subject in English, NOT a generic topic.
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

async function rerunHindiDeck() {
  console.log("Starting Rerun of Hindi Deck (20-page-hindi.txt)...");
  resetHourlyBudget();

  const filePath = path.join(projectRoot, "src/fixtures", "20-page-hindi.txt");
  const text = fs.readFileSync(filePath, "utf-8");
  const charCount = text.length;
  const startTime = Date.now();

  const scaling = calculateTargetSectionCount(charCount, undefined, 20);
  console.log(`Scaling target: ${scaling.targetSections} sections (${scaling.minSections}-${scaling.maxSections})`);

  const outlinePrompt = `You are an expert presentation architect.
Create a presentation outline with EXACTLY ${scaling.targetSections} cohesive sections for this document in JSON:
{
  "sections": [
    { "id": "1", "title": "Heading", "points": ["Key point 1", "Key point 2"], "pageRange": { "start": 1, "end": 2 } }
  ]
}`;
  const outlineRes = await callOpenAI([
    { role: "system", content: outlinePrompt },
    { role: "user", content: `Deck Title: "कॉरपोरेट वित्तीय एवं परिचालन विश्लेषण"\n\n<document>\n${text.slice(0, 35000)}\n</document>` },
  ]);

  const rawSections = Array.isArray(outlineRes.parsed)
    ? outlineRes.parsed
    : (outlineRes.parsed as any).sections || (outlineRes.parsed as any).outline || [];

  let outlineSections = [...rawSections];
  while (outlineSections.length < scaling.minSections) {
    const idx = outlineSections.length + 1;
    outlineSections.push({
      id: `s${idx}`,
      title: `सामरिक फोकस क्षेत्र ${idx}`,
      points: ["परिचालन निष्पादन मील का पत्थर", "लक्षित प्रदर्शन"],
      pageRange: { start: idx, end: idx + 1 },
    });
  }
  if (outlineSections.length > scaling.maxSections) {
    outlineSections = outlineSections.slice(0, scaling.maxSections);
  }

  console.log(`Outline prepared: ${outlineSections.length} sections`);

  // Layout planning
  const layoutPlan = await planDeckLayouts("कॉरपोरेट वित्तीय एवं परिचालन विश्लेषण", outlineSections, SLIDES_MODEL);
  console.log(`Layout Plan:`, layoutPlan.map((p) => `${p.index + 1}:${p.layout}`).join(" -> "));

  // Slide Generation
  const slides: SlideData[] = [];
  for (let i = 0; i < outlineSections.length; i++) {
    const section = outlineSections[i];
    const isFirst = i === 0;
    const isLast = i === outlineSections.length - 1;
    const targetLayout = layoutPlan[i]?.layout || (isFirst ? "title" : isLast ? "closing" : "bullets");

    let context = `Deck Title: कॉरपोरेट वित्तीय एवं परिचालन विश्लेषण\n\nSection Title: ${section.title}\nSection Points:\n${section.points.map((p: string) => `- ${p}`).join("\n")}`;
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
    const sanitized = sanitizeSlidePayload(res.parsed, isFirst, isLast, sanitizeStats, 20);
    if (sanitized.layout !== targetLayout && !isFirst && !isLast) {
      sanitized.layout = targetLayout;
    }
    const parsed = SlideSchema.safeParse(sanitized);

    let finalSlide: SlideData;
    if (parsed.success) {
      finalSlide = { ...parsed.data, id: randomUUID(), sourceSection: section.title };
    } else {
      console.warn(`Slide ${i + 1} validation fallback for layout ${targetLayout}`);
      finalSlide = { ...buildFallbackBulletsSlide(section.title, section.points), id: randomUUID(), sourceSection: section.title };
    }
    slides.push(groundAndSanitizeSlide(finalSlide, text));
  }

  // Image Deduplication and Resolution with Step 3 Quality Controls
  const usedPhotoIds = new Set<string>();
  const usedQueriesInDeck = new Set<string>();
  const slideImageReport: Array<{
    slideIdx: number;
    title: string;
    layout: string;
    hasImage: boolean;
    imageQuery: string;
    queryStatus: string;
    source: string;
    photographer: string;
    photoId: string;
  }> = [];

  for (let idx = 0; idx < slides.length; idx++) {
    const slide = slides[idx];
    const c = slide.content as any;
    if (!c) continue;

    // Check data-heavy bullet list
    if (isDataHeavyBulletList(slide)) {
      console.log(`Slide ${idx + 1} (${slide.layout}): Data-heavy bullet list detected; skipped image.`);
      delete c.imageQuery;
      delete c.imageKeyword;
      delete c.imageUrl;
      delete c.photoId;
      delete c.photographer;
      delete c.photographerUrl;
      c.imagePlacement = "none";
      slideImageReport.push({
        slideIdx: idx + 1,
        title: slide.title,
        layout: slide.layout,
        hasImage: false,
        imageQuery: "N/A",
        queryStatus: "skipped_data_heavy_bullets",
        source: "none",
        photographer: "None",
        photoId: "N/A",
      });
      continue;
    }

    const rawQuery = (c?.imageQuery || c?.imageKeyword || (slide.layout === "title" ? "corporate financial report" : "")).trim();
    const isTitleOrClosing = slide.layout === "title" || slide.layout === "closing";

    if (rawQuery) {
      const validation = validateAndCleanImageQuery(rawQuery, usedQueriesInDeck);
      if (!validation.valid) {
        console.log(`Slide ${idx + 1} (${slide.layout}): Query "${rawQuery}" rejected (${validation.reason}); skipped image.`);
        delete c.imageQuery;
        delete c.imageKeyword;
        delete c.imageUrl;
        delete c.photoId;
        delete c.photographer;
        delete c.photographerUrl;
        c.imagePlacement = "none";
        slideImageReport.push({
          slideIdx: idx + 1,
          title: slide.title,
          layout: slide.layout,
          hasImage: false,
          imageQuery: rawQuery,
          queryStatus: `rejected_${validation.reason}`,
          source: "none",
          photographer: "None",
          photoId: "N/A",
        });
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
          slideImageReport.push({
            slideIdx: idx + 1,
            title: slide.title,
            layout: slide.layout,
            hasImage: true,
            imageQuery: query,
            queryStatus: "accepted",
            source: stock.source,
            photographer: stock.photographer,
            photoId: stock.id || "N/A",
          });
        } else {
          delete c.imageUrl;
          delete c.photoId;
          delete c.photographer;
          delete c.photographerUrl;
          c.imagePlacement = "none";
          slideImageReport.push({
            slideIdx: idx + 1,
            title: slide.title,
            layout: slide.layout,
            hasImage: false,
            imageQuery: query,
            queryStatus: "api_no_result_or_rate_limit",
            source: "none",
            photographer: "None",
            photoId: "N/A",
          });
        }
      } catch (err: any) {
        delete c.imageUrl;
        delete c.photoId;
        delete c.photographer;
        delete c.photographerUrl;
        c.imagePlacement = "none";
        slideImageReport.push({
          slideIdx: idx + 1,
          title: slide.title,
          layout: slide.layout,
          hasImage: false,
          imageQuery: query,
          queryStatus: `error_${err?.message || "unknown"}`,
          source: "none",
          photographer: "None",
          photoId: "N/A",
        });
      }
    } else {
      slideImageReport.push({
        slideIdx: idx + 1,
        title: slide.title,
        layout: slide.layout,
        hasImage: false,
        imageQuery: "N/A",
        queryStatus: "no_image_requested",
        source: "none",
        photographer: "None",
        photoId: "N/A",
      });
    }
  }

  const durationSec = Math.round((Date.now() - startTime) / 1000);
  console.log(`\nHindi Deck rerun complete in ${durationSec}s!`);

  const outPath = path.join(projectRoot, "exports", "rerun", "hindi_deck_step3_results.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ durationSec, slides, report: slideImageReport }, null, 2));

  console.log("\n==========================================================================");
  console.log("HINDI DECK SLIDES: (Title, Layout, imageQuery, Photographer, Source)");
  console.log("==========================================================================");
  for (const r of slideImageReport) {
    console.log(
      `Slide ${String(r.slideIdx).padStart(2, " ")} [${r.layout.padEnd(10, " ")}] | ${r.hasImage ? "IMG: YES" : "IMG: NO "} | Query: "${r.imageQuery.padEnd(30, " ")}" | Photo: ${r.photographer.padEnd(25, " ")} | Source: ${r.source}`
    );
  }
}

rerunHindiDeck().catch((err) => {
  console.error("Fatal error running Hindi deck:", err);
  process.exit(1);
});
