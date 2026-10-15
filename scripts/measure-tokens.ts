import fs from "fs";
import path from "path";
import {
  splitDocumentIntoChunks,
  fitsSingleCallBudget,
  estimateTokenCount,
} from "../src/lib/longdoc";

const FIXTURES_DIR = path.join(__dirname, "../src/fixtures");

// Pricing constants for gpt-4o-mini
// Input: $0.150 per 1M tokens
// Output: $0.600 per 1M tokens
// USD to INR: 85
const USD_TO_INR = 85.0;
const COST_PER_INPUT_TOKEN_USD = 0.15 / 1_000_000;
const COST_PER_OUTPUT_TOKEN_USD = 0.60 / 1_000_000;
const COST_PER_INPUT_TOKEN_INR = COST_PER_INPUT_TOKEN_USD * USD_TO_INR; // ~0.00001275 INR
const COST_PER_OUTPUT_TOKEN_INR = COST_PER_OUTPUT_TOKEN_USD * USD_TO_INR; // ~0.00005100 INR

// Token counts for prompts and outputs
// Map Step:
// - System prompt: ~300 tokens
// - User prompt framing: ~50 tokens
// - Chunk text: chunk.approxTokens
// - Output summary: ~350 tokens (keyPoints, dataPoints, notes)
const MAP_SYSTEM_TOKENS = 350;
const MAP_OUTPUT_TOKENS = 350;

// Reduce Step:
// - System prompt: ~400 tokens
// - Input: all chunk summaries concatenated (~350 * N tokens)
// - Output: Outline JSON (8 slides ~700 tokens)
const REDUCE_SYSTEM_TOKENS = 400;
const REDUCE_OUTPUT_TOKENS = 700;

// Single-call Outline Step (for <= 12k tokens):
// - System prompt: ~400 tokens
// - Source text: approxTokens
// - Output: Outline JSON (7 slides ~600 tokens)
const SINGLE_SYSTEM_TOKENS = 400;
const SINGLE_OUTPUT_TOKENS = 600;

// Slide Generation Step:
// Average 8 slides per deck
// - System prompt + constraints: ~550 tokens
// - Section info + prompt: ~150 tokens
// - Excerpt: clamped to ~1,500 tokens (up to 6,000 chars)
// - Output: Slide JSON with layout + content + speaker notes: ~320 tokens
const SLIDES_COUNT = 8;
const SLIDE_SYSTEM_TOKENS = 550;
const SLIDE_PROMPT_TOKENS = 150;
const SLIDE_OUTPUT_TOKENS = 320;

function estimateTokensForText(text: string, isMixedHindi = false): number {
  if (!text) return 0;
  if (!isMixedHindi) {
    return Math.ceil(text.length / 4);
  }
  // In Devanagari script, characters often encode into ~0.7-1.2 tokens per character
  // Check proportion of non-ASCII / Devanagari characters
  let devanagariCount = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x0900 && code <= 0x097f) {
      devanagariCount++;
    }
  }
  const asciiCount = text.length - devanagariCount;
  // 4 chars per token for ascii, ~1.5 chars per token for Devanagari
  return Math.ceil(asciiCount / 4 + devanagariCount / 1.5);
}

const files = [
  { name: "5-page.txt", pages: 5, mixed: false },
  { name: "30-page.txt", pages: 30, mixed: false },
  { name: "80-page.txt", pages: 80, mixed: false },
  { name: "30-page-mixed.txt", pages: 30, mixed: true },
  { name: "20-page-hindi.txt", pages: 20, mixed: true },
];

console.log("=== TOKEN & COST MEASUREMENT REPORT ===");
console.log(`USD/INR Rate: ₹${USD_TO_INR}`);
console.log(`Input Token Cost: ₹${(COST_PER_INPUT_TOKEN_INR * 1000).toFixed(5)} / 1k tokens ($0.150 / 1M)`);
console.log(`Output Token Cost: ₹${(COST_PER_OUTPUT_TOKEN_INR * 1000).toFixed(5)} / 1k tokens ($0.600 / 1M)`);
console.log("--------------------------------------------------------------------------------\n");

const results = [];

for (const file of files) {
  const filePath = path.join(FIXTURES_DIR, file.name);
  const text = fs.readFileSync(filePath, "utf-8");
  const chars = text.length;
  const approxTokens = estimateTokensForText(text, file.mixed);
  const singleCall = fitsSingleCallBudget(text);
  const chunks = splitDocumentIntoChunks(text);

  let mapInputTokens = 0;
  let mapOutputTokens = 0;
  let reduceInputTokens = 0;
  let reduceOutputTokens = 0;
  let outlineInputTokens = 0;
  let outlineOutputTokens = 0;

  if (singleCall) {
    outlineInputTokens = SINGLE_SYSTEM_TOKENS + approxTokens;
    outlineOutputTokens = SINGLE_OUTPUT_TOKENS;
  } else {
    for (const chunk of chunks) {
      const chunkTokens = estimateTokensForText(chunk.text, file.mixed);
      mapInputTokens += MAP_SYSTEM_TOKENS + chunkTokens;
      mapOutputTokens += MAP_OUTPUT_TOKENS;
    }
    reduceInputTokens = REDUCE_SYSTEM_TOKENS + mapOutputTokens;
    reduceOutputTokens = REDUCE_OUTPUT_TOKENS;
    outlineInputTokens = mapInputTokens + reduceInputTokens;
    outlineOutputTokens = mapOutputTokens + reduceOutputTokens;
  }

  // Slide generation tokens:
  // For each slide, excerpt is up to 6,000 chars of relevant pages
  // Let's estimate average excerpt tokens per slide
  let avgExcerptTokens = 0;
  if (singleCall) {
    avgExcerptTokens = Math.min(approxTokens, 1500);
  } else {
    // Excerpt covers ~1-4 pages, typical chunk/page excerpt is 1,200 tokens
    avgExcerptTokens = Math.min(Math.round(approxTokens / SLIDES_COUNT * 1.5), 1500);
  }

  const slideGenInputPerSlide = SLIDE_SYSTEM_TOKENS + SLIDE_PROMPT_TOKENS + avgExcerptTokens;
  const slideGenInputTotal = slideGenInputPerSlide * SLIDES_COUNT;
  const slideGenOutputTotal = SLIDE_OUTPUT_TOKENS * SLIDES_COUNT;

  const totalInputTokens = outlineInputTokens + slideGenInputTotal;
  const totalOutputTokens = outlineOutputTokens + slideGenOutputTotal;
  const totalTokens = totalInputTokens + totalOutputTokens;

  const costUSD = totalInputTokens * COST_PER_INPUT_TOKEN_USD + totalOutputTokens * COST_PER_OUTPUT_TOKEN_USD;
  const costINR = totalInputTokens * COST_PER_INPUT_TOKEN_INR + totalOutputTokens * COST_PER_OUTPUT_TOKEN_INR;

  const res = {
    name: file.name,
    pages: file.pages,
    mixed: file.mixed,
    chars,
    approxTokens,
    pipeline: singleCall ? "Single-call" : `Map-Reduce (${chunks.length} chunks)`,
    chunks: chunks.length,
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
  results.push(res);

  console.log(`Fixture: ${file.name} (${file.pages} pages${file.mixed ? ", Hindi/Eng" : ""})`);
  console.log(`  Characters: ${chars.toLocaleString()}`);
  console.log(`  Source Tokens: ${approxTokens.toLocaleString()}`);
  console.log(`  Pipeline Strategy: ${res.pipeline}`);
  if (!singleCall) {
    console.log(`  Map Chunks: ${chunks.length}`);
    console.log(`  Map Tokens: In: ${mapInputTokens.toLocaleString()} | Out: ${mapOutputTokens.toLocaleString()}`);
    console.log(`  Reduce Tokens: In: ${reduceInputTokens.toLocaleString()} | Out: ${reduceOutputTokens.toLocaleString()}`);
  }
  console.log(`  Outline Total Tokens: In: ${outlineInputTokens.toLocaleString()} | Out: ${outlineOutputTokens.toLocaleString()}`);
  console.log(`  Slide Gen Total Tokens (${SLIDES_COUNT} slides): In: ${slideGenInputTotal.toLocaleString()} | Out: ${slideGenOutputTotal.toLocaleString()}`);
  console.log(`  TOTAL TOKENS: ${totalTokens.toLocaleString()} (In: ${totalInputTokens.toLocaleString()}, Out: ${totalOutputTokens.toLocaleString()})`);
  console.log(`  ESTIMATED COST: $${res.costUSD.toFixed(4)} = ₹${res.costINR.toFixed(2)}`);
  console.log(`  Exceeds ₹4.00 cap? ${res.exceedsRs4 ? "YES (FLAGGED)" : "NO (Within cap)"}`);
  console.log("--------------------------------------------------------------------------------\n");
}

fs.writeFileSync(
  path.join(__dirname, "../src/fixtures/measurement-results.json"),
  JSON.stringify(results, null, 2)
);
console.log("Saved measurement results to src/fixtures/measurement-results.json");
