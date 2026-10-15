import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "../.env.local") });

import { OpenAI } from "openai";
import {
  splitDocumentIntoChunks,
  fitsSingleCallBudget,
  summarizeChunk,
  reduceNotesToOutline,
  getSourceExcerptForSection,
} from "../src/lib/longdoc";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error("Missing OPENAI_API_KEY in .env.local");
}
const openai = new OpenAI({ apiKey });

const FIXTURES_DIR = path.join(__dirname, "../src/fixtures");

const USD_TO_INR = 85.0;
const COST_PER_INPUT_TOKEN_USD = 0.15 / 1_000_000;
const COST_PER_OUTPUT_TOKEN_USD = 0.60 / 1_000_000;
const COST_PER_INPUT_TOKEN_INR = COST_PER_INPUT_TOKEN_USD * USD_TO_INR;
const COST_PER_OUTPUT_TOKEN_INR = COST_PER_OUTPUT_TOKEN_USD * USD_TO_INR;

const SLIDES_COUNT = 8;
const SLIDE_SYSTEM_PROMPT = `You are a professional presentation slide generator.
Generate ONE slide matching this schema in JSON:
{
  "title": "string (conclusion, max 8 words, max 65 chars)",
  "notes": "string (1-2 sentences speaker notes)",
  "layout": "bullets" | "stats" | "two_column",
  "content": { ... }
}`;

interface FixtureTest {
  name: string;
  pages: number;
  label: string;
}

const files: FixtureTest[] = [
  { name: "5-page.txt", pages: 5, label: "5-Page Report" },
  { name: "30-page.txt", pages: 30, label: "30-Page Report" },
  { name: "80-page.txt", pages: 80, label: "80-Page Report" },
  { name: "30-page-mixed.txt", pages: 30, label: "30-Page Mixed (Hindi/Eng)" },
  { name: "20-page-hindi.txt", pages: 20, label: "20-Page Pure Hindi (Devanagari)" },
];

async function runFixture(file: FixtureTest) {
  console.log(`\n================================================================`);
  console.log(`Running REAL API measurements for: ${file.label} (${file.name})`);
  console.log(`================================================================`);

  const filePath = path.join(FIXTURES_DIR, file.name);
  const text = fs.readFileSync(filePath, "utf-8");
  const chars = text.length;

  const isSingleCall = fitsSingleCallBudget(text);
  const chunks = splitDocumentIntoChunks(text);

  let mapInputTokens = 0;
  let mapOutputTokens = 0;
  let reduceInputTokens = 0;
  let reduceOutputTokens = 0;
  let outlineInputTokens = 0;
  let outlineOutputTokens = 0;

  let outlineSections: Array<{ title: string; points: string[]; pageRange?: { start: number; end: number } }> = [];

  if (isSingleCall) {
    console.log(`[Pipeline] Strategy: Single-Call Outline`);
    const systemPrompt = `You are a professional presentation architect.
Generate a concise presentation outline with 5-10 sections in JSON:
{
  "sections": [
    { "title": "Heading", "points": ["Point 1", "Point 2"], "pageRange": { "start": 1, "end": 2 } }
  ]
}`;
    const userPrompt = `Deck Title: "${file.label}"\n\n<document_content>\n${text}\n</document_content>`;

    const comp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    outlineInputTokens = comp.usage?.prompt_tokens ?? 0;
    outlineOutputTokens = comp.usage?.completion_tokens ?? 0;
    try {
      const parsed = JSON.parse(comp.choices[0]?.message?.content ?? "{}");
      outlineSections = parsed.sections || [];
    } catch {
      outlineSections = [];
    }
    console.log(`[Single-Call Outline Real Usage] In: ${outlineInputTokens}, Out: ${outlineOutputTokens}`);
  } else {
    console.log(`[Pipeline] Strategy: Map-Reduce (${chunks.length} chunks)`);
    const chunkNotes = [];
    for (const chunk of chunks) {
      console.log(`  Processing chunk ${chunk.index} (Pages ${chunk.startPage}-${chunk.endPage})...`);
      const { chunkNote, usage } = await summarizeChunk(chunk, "gpt-4o-mini");
      chunkNotes.push(chunkNote);
      mapInputTokens += usage.promptTokens;
      mapOutputTokens += usage.completionTokens;
    }
    console.log(`  Total Map Phase Real Tokens: In: ${mapInputTokens}, Out: ${mapOutputTokens}`);

    console.log(`  Executing Reduce Phase...`);
    const reduced = await reduceNotesToOutline(file.label, chunkNotes, "gpt-4o-mini");
    reduceInputTokens = reduced.usage.promptTokens;
    reduceOutputTokens = reduced.usage.completionTokens;
    outlineSections = reduced.outline;
    console.log(`  Reduce Phase Real Tokens: In: ${reduceInputTokens}, Out: ${reduceOutputTokens}`);

    outlineInputTokens = mapInputTokens + reduceInputTokens;
    outlineOutputTokens = mapOutputTokens + reduceOutputTokens;
  }

  // Ensure we have at least SLIDES_COUNT sections to test 8 slides
  if (outlineSections.length < SLIDES_COUNT) {
    while (outlineSections.length < SLIDES_COUNT) {
      const idx = outlineSections.length + 1;
      outlineSections.push({
        title: `Strategic Focus Area ${idx}`,
        points: ["Key operational priority", "Measurable impact on growth"],
        pageRange: { start: idx, end: idx + 1 },
      });
    }
  }

  // Now measure real API slide generation calls for 8 slides
  console.log(`[Slide Generation] Generating ${SLIDES_COUNT} grounded slides via real API calls...`);
  let slideGenInputTotal = 0;
  let slideGenOutputTotal = 0;

  for (let i = 0; i < SLIDES_COUNT; i++) {
    const sec = outlineSections[i];
    const excerpt = getSourceExcerptForSection(text, sec.pageRange, 4000);

    let userContent = `Section Title: ${sec.title}\nPoints:\n${sec.points.map((p) => `- ${p}`).join("\n")}`;
    if (excerpt) {
      userContent += `\n\n<source_excerpt>\n${excerpt}\n</source_excerpt>`;
    }

    const slideComp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.5,
      messages: [
        { role: "system", content: SLIDE_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });

    const inTok = slideComp.usage?.prompt_tokens ?? 0;
    const outTok = slideComp.usage?.completion_tokens ?? 0;
    slideGenInputTotal += inTok;
    slideGenOutputTotal += outTok;
  }
  console.log(`[Slide Gen Real Usage] Total In: ${slideGenInputTotal}, Total Out: ${slideGenOutputTotal}`);

  const totalInputTokens = outlineInputTokens + slideGenInputTotal;
  const totalOutputTokens = outlineOutputTokens + slideGenOutputTotal;
  const totalTokens = totalInputTokens + totalOutputTokens;

  const costUSD = totalInputTokens * COST_PER_INPUT_TOKEN_USD + totalOutputTokens * COST_PER_OUTPUT_TOKEN_USD;
  const costINR = totalInputTokens * COST_PER_INPUT_TOKEN_INR + totalOutputTokens * COST_PER_OUTPUT_TOKEN_INR;

  const result = {
    name: file.name,
    label: file.label,
    pages: file.pages,
    chars,
    pipeline: isSingleCall ? "Single-Call" : `Map-Reduce (${chunks.length} chunks)`,
    chunks: isSingleCall ? 0 : chunks.length,
    mapInputTokens,
    mapOutputTokens,
    reduceInputTokens,
    reduceOutputTokens,
    outlineInputTokens,
    outlineOutputTokens,
    slideGenInputTotal,
    slideGenOutputTotal,
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    costUSD: Number(costUSD.toFixed(4)),
    costINR: Number(costINR.toFixed(2)),
    exceedsRs4: costINR > 4.0,
  };

  console.log(`[RESULT] Total Tokens: ${totalTokens.toLocaleString()} (Prompt: ${totalInputTokens}, Comp: ${totalOutputTokens})`);
  console.log(`[RESULT] Real Cost: $${result.costUSD.toFixed(4)} USD = ₹${result.costINR.toFixed(2)} INR`);
  console.log(`[RESULT] Exceeds ₹4.00 cap? ${result.exceedsRs4 ? "YES" : "NO"}`);

  return result;
}

async function main() {
  const allResults = [];
  for (const f of files) {
    const res = await runFixture(f);
    allResults.push(res);
  }

  fs.writeFileSync(
    path.join(FIXTURES_DIR, "measurement-results.json"),
    JSON.stringify(allResults, null, 2),
    "utf-8"
  );
  console.log("\nAll real measurements saved to src/fixtures/measurement-results.json");
}

main().catch((err) => {
  console.error("Measurement run failed:", err);
  process.exit(1);
});
