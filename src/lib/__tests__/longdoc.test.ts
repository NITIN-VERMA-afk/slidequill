import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  estimateTokenCount,
  fitsSingleCallBudget,
  splitDocumentIntoChunks,
  getSourceExcerptForSection,
  calculateTargetSectionCount,
  MAX_SOURCE_CHARS,
  SINGLE_CALL_TOKEN_THRESHOLD,
} from "../longdoc";

const fixturesDir = path.resolve(process.cwd(), "src/fixtures");

describe("Long Document Pipeline Core (src/lib/longdoc.ts)", () => {
  it("estimates token count correctly based on character density", () => {
    assert.equal(estimateTokenCount(""), 0);
    assert.equal(estimateTokenCount("1234"), 1);
    assert.equal(estimateTokenCount("12345678"), 2);
    assert.equal(estimateTokenCount("a".repeat(400)), 100);
  });

  it("determines whether document fits single-call budget (~12k tokens)", () => {
    // 5-page fixture fits single call
    const doc5 = fs.readFileSync(path.join(fixturesDir, "5-page.txt"), "utf8");
    assert.equal(fitsSingleCallBudget(doc5), true);

    // 30-page fixture exceeds single call (triggers map-reduce)
    const doc30 = fs.readFileSync(path.join(fixturesDir, "30-page.txt"), "utf8");
    // If doc30 length > 48,000, it should be map-reduce
    const isDoc30OverBudget = estimateTokenCount(doc30) > SINGLE_CALL_TOKEN_THRESHOLD;
    assert.equal(fitsSingleCallBudget(doc30), !isDoc30OverBudget);

    // Over-sized synthetic string
    const largeDoc = "a".repeat(50_000);
    assert.equal(fitsSingleCallBudget(largeDoc), false);
  });

  it("splits page-marked documents into bounded, page-aware chunks", () => {
    const doc30 = fs.readFileSync(path.join(fixturesDir, "30-page.txt"), "utf8");
    const chunks = splitDocumentIntoChunks(doc30, 30);

    assert.ok(chunks.length >= 2, "30-page document must be split into multiple chunks");
    assert.equal(chunks[0].startPage, 1);
    assert.ok(chunks[0].endPage > 1);

    // Verify continuity of page ranges across chunks
    for (let i = 0; i < chunks.length; i++) {
      assert.equal(chunks[i].index, i);
      assert.ok(chunks[i].startPage <= chunks[i].endPage);
      if (i > 0) {
        assert.equal(chunks[i].startPage, chunks[i - 1].endPage + 1);
      }
    }
  });

  it("splits unformatted plain text into paragraphs without crashing", () => {
    const rawParagraphs = Array.from({ length: 30 }, (_, i) => `Paragraph ${i}: ${"Sentence. ".repeat(60)}`).join("\n\n");
    const chunks = splitDocumentIntoChunks(rawParagraphs);

    assert.ok(chunks.length >= 2);
    assert.equal(chunks[0].startPage, 1);
    assert.ok(chunks[0].text.includes("Paragraph 0"));
  });

  it("extracts exact relevant page range text for slide generation", () => {
    const doc5 = fs.readFileSync(path.join(fixturesDir, "5-page.txt"), "utf8");
    
    // Request excerpt for Pages 2 to 3
    const excerpt = getSourceExcerptForSection(doc5, { start: 2, end: 3 });
    assert.ok(excerpt);
    assert.ok(excerpt.includes("[Page 2]"));
    assert.ok(excerpt.includes("[Page 3]"));
    assert.ok(!excerpt.includes("[Page 1]"));
    assert.ok(!excerpt.includes("[Page 4]"));
  });

  it("properly isolates prompt injection attempts within raw text delimiters", () => {
    const injectionDoc = fs.readFileSync(path.join(fixturesDir, "prompt-injection.txt"), "utf8");
    const chunks = splitDocumentIntoChunks(injectionDoc, 3);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0].text.includes("IGNORE ALL PREVIOUS INSTRUCTIONS"));
    assert.ok(chunks[0].text.includes("HackerGPT"));

    // Excerpt extraction preserves text safely without execution
    const excerpt = getSourceExcerptForSection(injectionDoc, { start: 2, end: 2 });
    assert.ok(excerpt);
    assert.ok(excerpt.includes("PIRATE INVASION"));
  });

  it("safely handles second prompt injection fixture targeting slide output", () => {
    const injectionDoc2 = fs.readFileSync(path.join(fixturesDir, "prompt-injection-output.txt"), "utf8");
    const chunks = splitDocumentIntoChunks(injectionDoc2, 3);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0].text.includes("attacker-malicious-redirect.example.com"));
    assert.ok(chunks[0].text.includes("$9,999,999,999"));

    // Excerpt extraction preserves text safely without execution
    const excerpt = getSourceExcerptForSection(injectionDoc2, { start: 1, end: 1 });
    assert.ok(excerpt);
    assert.ok(excerpt.includes("$14.8M"));
    assert.ok(!excerpt.includes("$9,999,999,999"));
  });

  it("correctly chunks pure Hindi (Devanagari) 20-page fixture along page boundaries", () => {
    const hindiDoc = fs.readFileSync(path.join(fixturesDir, "20-page-hindi.txt"), "utf8");
    const chunks = splitDocumentIntoChunks(hindiDoc, 20);
    assert.ok(chunks.length >= 1);
    assert.ok(chunks[0].text.includes("--- [Page 1] ---"));
    assert.ok(chunks[0].text.includes("वार्षिक कॉर्पोरेट समीक्षा"));

    const excerpt = getSourceExcerptForSection(hindiDoc, { start: 1, end: 2 });
    assert.ok(excerpt);
    assert.ok(excerpt.includes("[Page 1]"));
    assert.ok(excerpt.includes("[Page 2]"));
    assert.ok(!excerpt.includes("[Page 3]"));
  });

  it("scales outline section counts dynamically based on document length and pages", () => {
    // 1-page memo (< 8k chars) -> 6 slides
    const shortDoc = calculateTargetSectionCount(2500, 1);
    assert.equal(shortDoc.targetSections, 6);
    assert.equal(shortDoc.minSections, 5);
    assert.equal(shortDoc.maxSections, 7);

    // Medium doc (15k chars / 6 pages) -> 10 slides
    const medDoc = calculateTargetSectionCount(15000, 6);
    assert.equal(medDoc.targetSections, 10);
    assert.equal(medDoc.minSections, 8);
    assert.equal(medDoc.maxSections, 12);

    // Long doc (35k chars / 14 pages) -> 14 slides
    const longDoc = calculateTargetSectionCount(35000, 14);
    assert.equal(longDoc.targetSections, 14);
    assert.equal(longDoc.minSections, 12);
    assert.equal(longDoc.maxSections, 16);

    // Very long 30-page doc (> 50k chars / 30 pages) -> 18 slides
    const veryLongDoc = calculateTargetSectionCount(75000, 30);
    assert.equal(veryLongDoc.targetSections, 18);
    assert.equal(veryLongDoc.minSections, 15);
    assert.equal(veryLongDoc.maxSections, 20);

    // User explicit target slide count overrides (6, 10, 15, 20)
    const userPref6 = calculateTargetSectionCount(75000, 30, 6);
    assert.equal(userPref6.targetSections, 6);

    const userPref15 = calculateTargetSectionCount(2500, 1, 15);
    assert.equal(userPref15.targetSections, 15);

    const userPref20 = calculateTargetSectionCount(5000, 2, 20);
    assert.equal(userPref20.targetSections, 20);
  });
});
