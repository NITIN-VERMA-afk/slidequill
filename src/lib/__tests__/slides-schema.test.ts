import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  countWords,
  truncateWordsAndChars,
  sanitizeSlidePayload,
  buildFallbackBulletsSlide,
  validateAndSanitizeSourcePage,
  SlideSchema,
} from "../slides-schema";

describe("countWords", () => {
  it("counts words in standard strings", () => {
    assert.equal(countWords("Hello world"), 2);
    assert.equal(countWords("One two three four five"), 5);
  });

  it("handles whitespace, tabs, and newlines properly", () => {
    assert.equal(countWords("   Leading and trailing   "), 3);
    assert.equal(countWords("Multiple   \t  spaces \n and \r\n newlines"), 4);
  });

  it("returns 0 for empty or whitespace-only strings", () => {
    assert.equal(countWords(""), 0);
    assert.equal(countWords("   "), 0);
    assert.equal(countWords("\n\t  "), 0);
  });

  it("handles unicode and Hindi text", () => {
    assert.equal(countWords("नमस्ते दुनिया कैसे हो आप"), 5);
    assert.equal(countWords("  प्रस्तुति   की रूपरेखा  "), 3);
    assert.equal(countWords("Café au lait schön"), 4);
  });
});

describe("truncateWordsAndChars", () => {
  it("truncates strings exceeding char limit at word boundary", () => {
    const text = "The quick brown fox jumps over the lazy dog";
    const truncated = truncateWordsAndChars(text, 20, 20);
    assert.ok(truncated.length <= 21); // includes ellipsis
    assert.ok(truncated.endsWith("…"));
    assert.equal(truncated, "The quick brown fox…");
  });

  it("truncates strings exceeding word limit", () => {
    const text = "One two three four five six seven eight nine ten";
    const truncated = truncateWordsAndChars(text, 4, 100);
    assert.equal(countWords(truncated.replace("…", "")), 4);
    assert.equal(truncated, "One two three four…");
  });

  it("handles non-string values gracefully", () => {
    assert.equal(truncateWordsAndChars(null, 5, 20), "");
    assert.equal(truncateWordsAndChars(undefined, 5, 20), "");
    assert.equal(truncateWordsAndChars(12345, 5, 20), "12345");
    assert.equal(truncateWordsAndChars(true, 5, 20), "true");
  });

  it("handles unicode and Hindi text truncation", () => {
    const hindi = "यह एक बहुत लंबा वाक्य है जो प्रस्तुति के लिए उपयुक्त नहीं है";
    const truncated = truncateWordsAndChars(hindi, 4, 50);
    assert.ok(truncated.endsWith("…"));
    assert.ok(countWords(truncated.replace("…", "")) <= 4);
  });

  it("invokes onTruncate callback when truncation occurs", () => {
    let called = 0;
    truncateWordsAndChars("Short text", 10, 50, () => called++);
    assert.equal(called, 0);

    truncateWordsAndChars("Extremely long text that will definitely exceed limit", 2, 10, () => called++);
    assert.equal(called, 1);
  });
});

describe("sanitizeSlidePayload", () => {
  it("caps array items to maximum allowed per layout", () => {
    const stats = { truncations: 0 };
    const raw = {
      layout: "bullets",
      title: "Quarterly Growth",
      notes: "Speaker notes here",
      content: {
        bullets: [
          "Bullet 1",
          "Bullet 2",
          "Bullet 3",
          "Bullet 4",
          "Bullet 5",
          "Bullet 6",
          "Bullet 7 (over)",
          "Bullet 8 (over)",
        ],
      },
    };

    const sanitized = sanitizeSlidePayload(raw, false, false, stats);
    assert.equal(sanitized.content.bullets.length, 6);
    assert.ok(stats.truncations > 0);
    // Verified against schema
    assert.doesNotThrow(() => SlideSchema.parse(sanitized));
  });

  it("pads arrays that do not meet minimums", () => {
    const raw = {
      layout: "bullets",
      title: "Summary",
      content: {
        bullets: ["Single point"],
      },
    };

    const sanitized = sanitizeSlidePayload(raw);
    assert.equal(sanitized.content.bullets.length, 3);
    assert.doesNotThrow(() => SlideSchema.parse(sanitized));
  });

  it("handles empty or missing fields safely", () => {
    const sanitized = sanitizeSlidePayload({});
    assert.equal(sanitized.layout, "bullets");
    assert.ok(sanitized.title.length > 0);
    assert.ok(Array.isArray(sanitized.content.bullets));
    assert.doesNotThrow(() => SlideSchema.parse(sanitized));
  });

  it("handles non-string values inside content objects", () => {
    const raw = {
      layout: "stats",
      title: 999,
      content: {
        stats: [
          { value: 42, label: 100 },
          { value: true, label: "True metric" },
        ],
      },
    };

    const sanitized = sanitizeSlidePayload(raw);
    assert.equal(sanitized.title, "999");
    assert.equal(sanitized.content.stats[0].value, "42");
    assert.doesNotThrow(() => SlideSchema.parse(sanitized));
  });

  it("truncates over-long titles and bullets and passes strict schema", () => {
    const stats = { truncations: 0 };
    const raw = {
      layout: "bullets",
      title: "This is an absurdly long slide title that goes on and on and contains way too many words and characters to fit",
      content: {
        bullets: [
          "This is a massive bullet point description that describes architectural decentralization of microservice systems in extreme and excessive detail",
          "Second massive bullet point that should also be trimmed cleanly at a word boundary",
          "Third valid bullet point",
        ],
      },
    };

    const sanitized = sanitizeSlidePayload(raw, false, false, stats);
    assert.ok(stats.truncations >= 2);
    const parsed = SlideSchema.parse(sanitized);
    assert.ok(parsed.title.length <= 65);
    assert.ok(countWords(parsed.title) <= 8);
  });
});

describe("buildFallbackBulletsSlide", () => {
  it("builds a schema-valid slide with meta.fallback = true", () => {
    const slide = buildFallbackBulletsSlide("Strategic Planning", [
      "Review past quarter performance metrics and milestones",
      "Set operational priorities for upcoming release cycle",
    ]);

    assert.equal(slide.layout, "bullets");
    assert.equal(slide.meta?.fallback, true);
    assert.ok(slide.content.bullets.length >= 3);
    assert.doesNotThrow(() => SlideSchema.parse(slide));
  });

  it("handles empty title and empty points", () => {
    const slide = buildFallbackBulletsSlide("", []);
    assert.equal(slide.layout, "bullets");
    assert.equal(slide.meta?.fallback, true);
    assert.equal(slide.content.bullets.length, 3);
    assert.doesNotThrow(() => SlideSchema.parse(slide));
  });
});

describe("validateAndSanitizeSourcePage", () => {
  it("strips sourcePage when sourcePageCount is undefined (DOCX or text)", () => {
    assert.equal(validateAndSanitizeSourcePage(5, undefined), undefined);
    assert.equal(validateAndSanitizeSourcePage("3", undefined), undefined);
    assert.equal(validateAndSanitizeSourcePage(1, undefined), undefined);
  });

  it("strips sourcePage when sourcePageCount is 0 or negative", () => {
    assert.equal(validateAndSanitizeSourcePage(2, 0), undefined);
    assert.equal(validateAndSanitizeSourcePage(1, -1), undefined);
  });

  it("validates 1 <= sourcePage <= sourcePageCount for PDFs", () => {
    assert.equal(validateAndSanitizeSourcePage(1, 10), 1);
    assert.equal(validateAndSanitizeSourcePage(5, 10), 5);
    assert.equal(validateAndSanitizeSourcePage(10, 10), 10);
    assert.equal(validateAndSanitizeSourcePage("p. 7", 10), 7);
  });

  it("rejects hallucinated page numbers exceeding known page bounds", () => {
    assert.equal(validateAndSanitizeSourcePage(11, 10), undefined);
    assert.equal(validateAndSanitizeSourcePage(99, 5), undefined);
    assert.equal(validateAndSanitizeSourcePage(0, 10), undefined);
    assert.equal(validateAndSanitizeSourcePage(-3, 10), undefined);
  });

  it("sanitizes slide payload with sourcePageCount properly", () => {
    const validRaw = {
      title: "Quarterly Growth Analysis",
      notes: "Speaker notes",
      layout: "bullets",
      content: { bullets: ["Revenue up 25%", "New client acquisitions", "Expansion into EMEA"] },
      sourcePage: 3,
    };
    const sanitizedValid = sanitizeSlidePayload(validRaw, false, false, undefined, 5);
    assert.equal(sanitizedValid.sourcePage, 3);

    const hallucinatedRaw = {
      ...validRaw,
      sourcePage: 42,
    };
    const sanitizedHallucinated = sanitizeSlidePayload(hallucinatedRaw, false, false, undefined, 5);
    assert.equal(sanitizedHallucinated.sourcePage, undefined);

    const nonPdfRaw = {
      ...validRaw,
      sourcePage: 2,
    };
    const sanitizedNonPdf = sanitizeSlidePayload(nonPdfRaw, false, false, undefined, undefined);
    assert.equal(sanitizedNonPdf.sourcePage, undefined);
  });
});

