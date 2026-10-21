import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  countWords,
  truncateWordsAndChars,
  sanitizeSlidePayload,
  buildFallbackBulletsSlide,
  formatSourcePage,
  validateAndSanitizeSourcePage,
  buildSourceCitation,
  isNumberInSource,
  cleanSourceForGrounding,
  cleanSourceForCategoryGrounding,
  validateAndGroundChartSlide,
  convertChartToFallbackLayout,
  validateAndGroundStatsSlide,
  convertStatsToFallbackLayout,
  groundAndSanitizeSlide,
  SlideSchema,
} from "../slides-schema";
import {
  computeDeterministicSectionPageRanges,
  getSourceExcerptForSection,
  getSectionExcerptForUnpagedDocument,
  getRelevantChunkNotesExcerpt,
  getLightEnglishStem,
  matchTokenWithStem,
} from "../longdoc";

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
    assert.equal(validateAndSanitizeSourcePage(1, 10), "1");
    assert.equal(validateAndSanitizeSourcePage(5, 10), "5");
    assert.equal(validateAndSanitizeSourcePage(10, 10), "10");
    assert.equal(validateAndSanitizeSourcePage("p. 7", 10), "7");
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
    assert.equal(sanitizedValid.sourcePage, "3");

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

describe("Chart Data Integrity and Grounding", () => {
  const sourceWithNumbers =
    "In fiscal year 2025, Total ARR reached $20.4M, representing 21.0% YoY growth. Enterprise active users hit 48,000 across regions, and India revenue totaled ₹28.7Cr.";

  it("isNumberInSource correctly matches formatted currency, percentage, and comma numbers", () => {
    assert.equal(isNumberInSource(20.4, sourceWithNumbers), true, "20.4 should match $20.4M");
    assert.equal(isNumberInSource(21, sourceWithNumbers), true, "21 should match 21.0%");
    assert.equal(isNumberInSource(21.0, sourceWithNumbers), true, "21.0 should match 21.0%");
    assert.equal(isNumberInSource(48000, sourceWithNumbers), true, "48000 should match 48,000");
    assert.equal(isNumberInSource(28.7, sourceWithNumbers), true, "28.7 should match ₹28.7Cr");
    assert.equal(isNumberInSource(99.9, sourceWithNumbers), false, "99.9 does not appear in source");
    assert.equal(isNumberInSource(10, sourceWithNumbers), false, "10 does not appear in source");
  });

  it("allows chart slide when source excerpt contains >= 3 real grounded data points", () => {
    const rawChart = {
      layout: "chart",
      title: "ARR Growth and User Metrics",
      notes: "Speaker notes",
      content: {
        chartType: "bar",
        chartTitle: "Key Performance Metrics",
        categories: ["ARR (Millions)", "YoY Growth (%)", "India Revenue (Cr)"],
        series: [
          {
            name: "Performance",
            values: [20.4, 21.0, 28.7],
          },
        ],
      },
    };

    const sanitized = sanitizeSlidePayload(rawChart, false, false, undefined, undefined, sourceWithNumbers);
    assert.equal(sanitized.layout, "chart", "Chart with 3 grounded numbers should remain a chart");
    assert.equal(sanitized.content.series[0].values.length, 3);
    assert.deepEqual(sanitized.content.series[0].values, [20.4, 21.0, 28.7]);

    const grounded = groundAndSanitizeSlide(sanitized, sourceWithNumbers);
    assert.equal(grounded.layout, "chart");
    assert.deepEqual(grounded.content.series[0].values, [20.4, 21.0, 28.7]);
  });

  it("converts chart to bullets when source text has NO numbers at all", () => {
    const textWithoutNumbers =
      "Our team focuses on operational excellence, customer empathy, cultural transparency, and disciplined execution.";

    const rawChart = {
      layout: "chart",
      title: "Performance Trends",
      notes: "Speaker notes",
      content: {
        chartType: "line",
        categories: ["Q1", "Q2", "Q3", "Q4"],
        series: [{ name: "Metric", values: [10, 20, 30, 40] }],
      },
    };

    const sanitized = sanitizeSlidePayload(rawChart, false, false, undefined, undefined, textWithoutNumbers);
    assert.equal(sanitized.layout, "bullets", "Chart must convert to bullets when source has no numbers");
    assert.ok(sanitized.content.bullets.length >= 2, "Must produce valid bullet points");
    // Verify schema passes
    assert.doesNotThrow(() => SlideSchema.parse(sanitized));

    // Also verify groundAndSanitizeSlide enforces this
    const grounded = groundAndSanitizeSlide(rawChart, textWithoutNumbers);
    assert.equal(grounded.layout, "bullets");
    assert.doesNotThrow(() => SlideSchema.parse(grounded));
  });

  it("converts chart to stats or bullets when source has fewer than 3 real data points", () => {
    const textWithTwoNumbers = "Total net revenue reached $20.4M, representing 21.0% growth.";

    const rawChart = {
      layout: "chart",
      title: "Revenue Overview",
      notes: "Speaker notes",
      content: {
        chartType: "bar",
        categories: ["Total Net Revenue", "Year-over-Year Growth"],
        series: [{ name: "Metric", values: [20.4, 21.0] }],
      },
    };

    const sanitized = sanitizeSlidePayload(rawChart, false, false, undefined, undefined, textWithTwoNumbers);
    // Fewer than 3 values: cannot remain a chart. Since 2 grounded points exist, converts to stats or bullets
    assert.notEqual(sanitized.layout, "chart", "Chart with < 3 data points must not remain a chart");
    assert.ok(sanitized.layout === "stats" || sanitized.layout === "bullets");
    assert.doesNotThrow(() => SlideSchema.parse(sanitized));

    const grounded = groundAndSanitizeSlide(rawChart, textWithTwoNumbers);
    assert.notEqual(grounded.layout, "chart");
    assert.doesNotThrow(() => SlideSchema.parse(grounded));
  });

  it("converts chart to bullets when plotted numbers do not appear in source text", () => {
    const rawChartWithInventedNumbers = {
      layout: "chart",
      title: "Invented Metric Chart",
      notes: "Speaker notes",
      content: {
        chartType: "bar",
        categories: ["Metric A", "Metric B", "Metric C"],
        series: [{ name: "Values", values: [100.5, 200.75, 300.2] }],
      },
    };

    const sanitized = sanitizeSlidePayload(rawChartWithInventedNumbers, false, false, undefined, undefined, sourceWithNumbers);
    assert.notEqual(sanitized.layout, "chart", "Invented numbers not in source must reject chart layout");
    assert.equal(sanitized.layout, "bullets");
    assert.doesNotThrow(() => SlideSchema.parse(sanitized));
  });

  it("never pads series with placeholder values of 10", () => {
    const rawEmptyChart = {
      layout: "chart",
      title: "Empty Series Chart",
      notes: "Speaker notes",
      content: {
        chartType: "bar",
        categories: ["Category 1", "Category 2", "Category 3"],
        series: [],
      },
    };

    const sanitized = sanitizeSlidePayload(rawEmptyChart);
    assert.notEqual(sanitized.layout, "chart", "Chart without series values must not remain a chart");
    assert.equal(sanitized.layout, "bullets");
    // Ensure no invented '10' values exist anywhere
    const jsonStr = JSON.stringify(sanitized);
    assert.equal(jsonStr.includes("10"), false, "Must never pad placeholder 10 values");
    assert.doesNotThrow(() => SlideSchema.parse(sanitized));
  });

  it("rejects flat series like [10, 10, 10, 10] or series with fewer than 3 distinct values", () => {
    const flatChart = {
      layout: "chart",
      title: "Flat Revenue Growth",
      notes: "Speaker notes",
      content: {
        chartType: "line",
        categories: ["Q1", "Q2", "Q3", "Q4"],
        series: [{ name: "Revenue", values: [10, 10, 10, 10] }],
      },
    };

    const sourceWithTen = "We maintained $10M baseline throughout the year.";
    const sanitized = sanitizeSlidePayload(flatChart, false, false, undefined, undefined, sourceWithTen);
    assert.equal(sanitized.layout, "bullets", "Flat series [10, 10, 10, 10] must be rejected");

    const twoDistinctValuesChart = {
      layout: "chart",
      title: "Binary Metric Trend",
      notes: "Speaker notes",
      content: {
        chartType: "bar",
        categories: ["A", "B", "C", "D"],
        series: [{ name: "Metric", values: [20.4, 20.4, 21.0, 21.0] }],
      },
    };
    const sanitizedTwo = sanitizeSlidePayload(twoDistinctValuesChart, false, false, undefined, undefined, sourceWithNumbers);
    assert.equal(sanitizedTwo.layout, "bullets", "Series with only 2 distinct values must be rejected");
  });

  it("rejects numbers that appear only in page markers, dates, years, or list indices", () => {
    const markerAndYearSource =
      "--- [Page 18] --- In 2024, our team had 4 initiatives. 1. Growth 2. Quality 3. Security. See page 19.";

    assert.equal(isNumberInSource(18, markerAndYearSource), false, "Page marker 18 must be ignored");
    assert.equal(isNumberInSource(19, markerAndYearSource), false, "Page reference 19 must be ignored");
    assert.equal(isNumberInSource(2024, markerAndYearSource), false, "Calendar year 2024 must be ignored");
    assert.equal(isNumberInSource(4, markerAndYearSource), false, "Bare integer < 32 without currency/unit must be ignored");

    const chartWithMarkerNumbers = {
      layout: "chart",
      title: "Page Number Plotted Chart",
      notes: "Speaker notes",
      content: {
        chartType: "bar",
        categories: ["Phase 1", "Phase 2", "Phase 3"],
        series: [{ name: "Values", values: [18, 19, 2024] }],
      },
    };

    const sanitized = sanitizeSlidePayload(chartWithMarkerNumbers, false, false, undefined, undefined, markerAndYearSource);
    assert.equal(sanitized.layout, "bullets", "Chart plotting page markers or years must be rejected");
  });

  it("accepts real figures with magnitude formatting ($20.4M, 21%, 48,000, ₹28.7Cr, 2.5bn)", () => {
    const complexSource =
      "Total ARR reached $20.4M with 21% net expansion. Active customer base grew to 48,000. India operations contributed ₹28.7Cr, and global pipeline reached 2.5bn.";

    assert.equal(isNumberInSource(20.4, complexSource), true, "$20.4M matches 20.4");
    assert.equal(isNumberInSource(20400000, complexSource), true, "$20.4M matches 20,400,000");
    assert.equal(isNumberInSource(21, complexSource), true, "21% matches 21");
    assert.equal(isNumberInSource(0.21, complexSource), true, "21% matches 0.21");
    assert.equal(isNumberInSource(48000, complexSource), true, "48,000 matches 48000");
    assert.equal(isNumberInSource(48, complexSource), true, "48,000 matches 48 (in thousands)");
    assert.equal(isNumberInSource(28.7, complexSource), true, "₹28.7Cr matches 28.7");
    assert.equal(isNumberInSource(2.5, complexSource), true, "2.5bn matches 2.5");
    assert.equal(isNumberInSource(2500000000, complexSource), true, "2.5bn matches 2,500,000,000");
  });

  it("handles mixed valid and invalid series (rejects chart if any value is ungrounded)", () => {
    const mixedChart = {
      layout: "chart",
      title: "Mixed Grounding Chart",
      notes: "Speaker notes",
      content: {
        chartType: "bar",
        categories: ["ARR", "YoY Growth", "Invented Metric"],
        series: [{ name: "Metrics", values: [20.4, 21.0, 999.5] }],
      },
    };

    const sanitized = sanitizeSlidePayload(mixedChart, false, false, undefined, undefined, sourceWithNumbers);
    assert.notEqual(sanitized.layout, "chart", "Chart with even 1 ungrounded value must not remain a chart");
    assert.ok(sanitized.layout === "bullets" || sanitized.layout === "stats");
  });

  it("handles Devanagari numerals in source text", () => {
    const hindiSource =
      "कंपनी का कुल ARR $२०.४M तक पहुंच गया, जो २१% की वार्षिक वृद्धि दर्शाता है। भारत में कुल राजस्व ₹२८.७Cr दर्ज किया गया।";

    assert.equal(isNumberInSource(20.4, hindiSource), true, "Devanagari २०.४ should match 20.4");
    assert.equal(isNumberInSource(21, hindiSource), true, "Devanagari २१ should match 21");
    assert.equal(isNumberInSource(28.7, hindiSource), true, "Devanagari २८.७ should match 28.7");

    const chartSlide = {
      layout: "chart",
      title: "वित्तीय प्रदर्शन (Financial Performance)",
      notes: "Speaker notes",
      content: {
        chartType: "bar",
        categories: ["ARR", "वृद्धि", "राजस्व"],
        series: [{ name: "Metrics", values: [20.4, 21.0, 28.7] }],
      },
    };

    const sanitized = sanitizeSlidePayload(chartSlide, false, false, undefined, undefined, hindiSource);
    assert.equal(sanitized.layout, "chart", "Chart grounded by Devanagari source numbers must remain a chart");
  });

  it("ensures stats grounding ignores page markers and years", () => {
    const sourceWithPageAndYear = "--- [Page 18] --- In 2024, the product saw major upgrades.";
    const statsSlideWithMarker = {
      layout: "stats",
      title: "Company Timeline",
      content: {
        stats: [
          { value: "18", label: "Page Citation" },
          { value: "2024", label: "Fiscal Year" },
        ],
      },
    };

    // When checking grounding with isNumberInSource, 18 and 2024 should fail
    assert.equal(isNumberInSource(18, sourceWithPageAndYear), false);
    assert.equal(isNumberInSource(2024, sourceWithPageAndYear), false);
  });
});

describe("computeDeterministicSectionPageRanges", () => {
  const samplePdfText = `
--- [Page 1] ---
Executive Overview and strategic company vision.

--- [Page 2] ---
Product Roadmap and architecture details.

--- [Page 3] ---
Financial Performance and quarterly ARR expansion.
`;

  it("matches section keywords to exact source page markers (matched sections)", () => {
    const sections = [
      { title: "Strategic Vision", points: ["Executive Overview"] },
      { title: "Product Roadmap", points: ["Architecture details"] },
      { title: "Financial Performance", points: ["Quarterly ARR"] },
    ];

    const computed = computeDeterministicSectionPageRanges(sections, samplePdfText, 3);
    assert.deepEqual(computed[0].pageRange, { start: 1, end: 1 });
    assert.equal(computed[0].pageRangeApprox, false);
    assert.deepEqual(computed[1].pageRange, { start: 2, end: 2 });
    assert.equal(computed[1].pageRangeApprox, false);
    assert.deepEqual(computed[2].pageRange, { start: 3, end: 3 });
    assert.equal(computed[2].pageRangeApprox, false);
  });

  it("handles partially matched sections where only a subset of tokens match", () => {
    // 5 distinctive tokens ("product", "evolution", "architecture", "deep", "dive"): 2 hits meets threshold (30% = 2, required = 2)
    const qualifyingSection = [
      {
        title: "Product Evolution",
        points: ["Architecture deep dive"],
      },
    ];

    const computedQualifying = computeDeterministicSectionPageRanges(qualifyingSection, samplePdfText, 3);
    assert.deepEqual(computedQualifying[0].pageRange, { start: 2, end: 2 });
    assert.equal(computedQualifying[0].pageRangeApprox, false, "2 hits out of 5 distinctive tokens meets 30% threshold");

    // 12 distinctive tokens: 2 hits does NOT meet 30% threshold (ceil(12 * 0.3) = 4, required = 4)
    const nonQualifyingSection = [
      {
        title: "Platform Scalability and Future Evolution",
        points: ["Product architecture and technical deep dive", "Global cloud infrastructure"],
      },
    ];

    const computedNonQualifying = computeDeterministicSectionPageRanges(nonQualifyingSection, samplePdfText, 3);
    assert.equal(computedNonQualifying[0].pageRangeApprox, true, "2 hits out of 12 distinctive tokens stays approximate");
  });

  it("assigns proportional page ranges and marks pageRangeApprox: true for unmatched sections", () => {
    const sections = [
      { title: "Section Alpha", points: ["Completely unrelated topic", "No matching terms"] },
      { title: "Section Beta", points: ["Unrelated concept", "Another missing phrase"] },
      { title: "Section Gamma", points: ["Zero overlap", "External subject"] },
    ];

    const computed = computeDeterministicSectionPageRanges(sections, samplePdfText, 6);
    assert.ok(computed[0].pageRange!.start >= 1);
    assert.ok(computed[2].pageRange!.end <= 6);
    assert.ok(computed[0].pageRange!.start <= computed[1].pageRange!.start);
    assert.ok(computed[1].pageRange!.start <= computed[2].pageRange!.start);

    // All unmatched sections must have pageRangeApprox: true
    assert.equal(computed[0].pageRangeApprox, true);
    assert.equal(computed[1].pageRangeApprox, true);
    assert.equal(computed[2].pageRangeApprox, true);
  });

  it("suppresses excerpt when pageRangeApprox is true, but extracts text for matched sections", () => {
    const matchedSection = {
      title: "Strategic Vision",
      pageRange: { start: 1, end: 1 },
      pageRangeApprox: false,
    };
    const matchedExcerpt = getSourceExcerptForSection(
      samplePdfText,
      matchedSection.pageRange,
      4_000,
      matchedSection.pageRangeApprox
    );
    assert.ok(matchedExcerpt && matchedExcerpt.includes("Executive Overview"));

    const unmatchedSection = {
      title: "Section Alpha",
      pageRange: { start: 1, end: 2 },
      pageRangeApprox: true,
    };
    const suppressedExcerpt = getSourceExcerptForSection(
      samplePdfText,
      unmatchedSection.pageRange,
      4_000,
      unmatchedSection.pageRangeApprox
    );
    assert.equal(suppressedExcerpt, undefined, "Approximate section must NOT receive proportional guess excerpt");
  });

  it("rejects pages matching only a single common word or stopword and marks them approximate", () => {
    // Single common words like "overview" or "details" appear on pages 1 and 2, but must NOT match
    const commonWordSection = [
      { title: "Overview", points: ["More details about this"] },
    ];
    const computed = computeDeterministicSectionPageRanges(commonWordSection, samplePdfText, 3);
    assert.equal(computed[0].pageRangeApprox, true, "Stopwords and common words must not trigger page matches");
  });

  it("requires at least 2 distinctive tokens or 40% before matching pages", () => {
    // A single distinctive term like "vision" (1 token total) cannot meet the threshold of 2
    const singleTermSection = [
      { title: "Vision", points: [] },
    ];
    const computed = computeDeterministicSectionPageRanges(singleTermSection, samplePdfText, 3);
    assert.equal(computed[0].pageRangeApprox, true, "Single token must stay approximate");

    // Multiple distinctive terms like "quarterly" and "expansion" on page 3 clearly identify the page
    const distinctiveSection = [
      { title: "Financial Expansion", points: ["Quarterly ARR acceleration"] },
    ];
    const computedDistinctive = computeDeterministicSectionPageRanges(distinctiveSection, samplePdfText, 3);
    assert.deepEqual(computedDistinctive[0].pageRange, { start: 3, end: 3 });
    assert.equal(computedDistinctive[0].pageRangeApprox, false, "Distinctive terms meeting threshold must match");
  });

  it("extracts section-specific excerpt for unpaged documents (DOCX, pasted text)", () => {
    const unpagedDoc = `
Executive Summary
We are pleased to present the annual strategy overview.

Infrastructure and Architecture
Kubernetes cluster deployment and microservices architecture. High availability across multi-region cloud services.

Financial Performance
Annual revenue grew by 48% to 20.4 million dollars with 21 percent operating margin.
`;

    const excerpt = getSectionExcerptForUnpagedDocument(
      unpagedDoc,
      "Infrastructure and Architecture",
      ["Kubernetes cluster deployment", "Microservices architecture"]
    );
    assert.ok(excerpt && excerpt.includes("Kubernetes cluster deployment"));
    assert.ok(excerpt && excerpt.includes("microservices architecture"));
    assert.equal(excerpt.includes("annual strategy overview"), false);
  });

  it("extracts relevant cached chunk notes by keyword overlap when page range is approximate", () => {
    const mockChunkNotes = [
      {
        chunkIndex: 0,
        startPage: 1,
        endPage: 5,
        notes: "Executive leadership notes and mission statement.",
        keyPoints: ["Founding story", "Market size"],
        dataPoints: ["$10B TAM"],
      },
      {
        chunkIndex: 1,
        startPage: 6,
        endPage: 10,
        notes: "Detailed financial performance and ARR growth metrics.",
        keyPoints: ["ARR exceeded 20.4M", "Net retention 135%"],
        dataPoints: ["$20.4M ARR", "135% NRR"],
      },
    ];

    const notesExcerpt = getRelevantChunkNotesExcerpt(
      mockChunkNotes as any,
      "Financial Performance",
      ["ARR expansion", "Net retention"]
    );
    assert.ok(notesExcerpt && notesExcerpt.includes("$20.4M ARR"));
    assert.ok(notesExcerpt && notesExcerpt.includes("Net retention 135%"));
  });

  it("returns undefined pageRange when sourcePageCount is missing (DOCX or text)", () => {
    const sections = [{ title: "Section 1", points: ["Point A"] }];
    const computed = computeDeterministicSectionPageRanges(sections, samplePdfText, undefined);
    assert.equal(computed[0].pageRange, undefined);
    assert.equal(computed[0].pageRangeApprox, undefined);
  });
});

describe("formatSourcePage and validateAndSanitizeSourcePage", () => {
  it("formats single page numbers and strings properly", () => {
    assert.equal(formatSourcePage(18, 50), "18");
    assert.equal(formatSourcePage("18", 50), "18");
    assert.equal(formatSourcePage("p. 18", 50), "18");
    assert.equal(formatSourcePage("Page 18", 50), "18");
  });

  it("formats page ranges properly", () => {
    assert.equal(formatSourcePage({ start: 18, end: 20 }, 50), "18-20");
    assert.equal(formatSourcePage({ start: 18, end: 18 }, 50), "18");
    assert.equal(formatSourcePage("18-20", 50), "18-20");
    assert.equal(formatSourcePage("pages 18-20", 50), "18-20");
    assert.equal(formatSourcePage("pp. 18–20", 50), "18-20");
  });

  it("clamps or rejects pages exceeding maxPages", () => {
    assert.equal(formatSourcePage(55, 50), undefined, "Out-of-bounds start page should return undefined");
    assert.equal(formatSourcePage("60-65", 50), undefined, "Out-of-bounds range should return undefined");
    assert.equal(formatSourcePage({ start: 48, end: 55 }, 50), "48-50", "End page exceeding maxPages should clamp");
  });

  it("rejects invalid page inputs", () => {
    assert.equal(formatSourcePage(0, 50), undefined);
    assert.equal(formatSourcePage(-5, 50), undefined);
    assert.equal(formatSourcePage("random string", 50), undefined);
    assert.equal(formatSourcePage(null, 50), undefined);
    assert.equal(formatSourcePage(undefined, 50), undefined);
  });

  it("validateAndSanitizeSourcePage returns undefined when sourcePageCount is missing or < 1", () => {
    assert.equal(validateAndSanitizeSourcePage(18, undefined), undefined);
    assert.equal(validateAndSanitizeSourcePage(18, 0), undefined);
    assert.equal(validateAndSanitizeSourcePage("18-20", 0), undefined);
    assert.equal(validateAndSanitizeSourcePage(18, 25), "18");
    assert.equal(validateAndSanitizeSourcePage("18-20", 25), "18-20");
  });
});

describe("buildSourceCitation", () => {
  it("builds citation for PDF with page range", () => {
    const citation = buildSourceCitation("Annual_Report.pdf", "18-20", "Financial Performance");
    assert.equal(citation, "Source: Annual_Report.pdf, pages 18-20");
  });

  it("builds citation for PDF with single page", () => {
    const citation = buildSourceCitation("Annual_Report.pdf", 18, "Financial Performance");
    assert.equal(citation, "Source: Annual_Report.pdf, page 18");
  });

  it("keeps approximate page ranges out of the citation and cites section only", () => {
    const citationRange = buildSourceCitation("Annual_Report.pdf", "18-20 (approx.)", "Financial Performance");
    assert.equal(citationRange, "Source: Annual_Report.pdf, section: Financial Performance");

    const citationFlag = buildSourceCitation("Annual_Report.pdf", "18-20", "Financial Performance", true);
    assert.equal(citationFlag, "Source: Annual_Report.pdf, section: Financial Performance");

    const citationSingle = buildSourceCitation("Annual_Report.pdf", 18, undefined, true);
    assert.equal(citationSingle, "Source: Annual_Report.pdf");
  });

  it("builds citation for DOCX with section name when page is unavailable", () => {
    const citation = buildSourceCitation("Product_Roadmap.docx", undefined, "Executive Overview");
    assert.equal(citation, "Source: Product_Roadmap.docx, section: Executive Overview");
  });

  it("builds citation for pasted text with section", () => {
    const citation = buildSourceCitation("", undefined, "Market Dynamics");
    assert.equal(citation, "Source: pasted text, section: Market Dynamics");
  });

  it("builds citation fallback for pasted text with no section or page", () => {
    const citation = buildSourceCitation("", undefined, undefined);
    assert.equal(citation, "Source: pasted text");
  });
});

describe("convertChartToFallbackLayout", () => {
  it("never outputs apology or placeholder text on fallback", () => {
    const emptyChartSlide = {
      layout: "chart",
      title: "Quarterly Performance Review",
      notes: "Discussion points for the board",
      content: {
        chartType: "bar",
        categories: [],
        series: [],
      },
    };

    const fallback = convertChartToFallbackLayout(emptyChartSlide, undefined, [
      "Outline bullet point 1",
      "Outline bullet point 2",
    ]);

    assert.equal(fallback.layout, "bullets");
    const jsonStr = JSON.stringify(fallback);
    assert.equal(jsonStr.includes("Data metrics unavailable"), false);
    assert.equal(jsonStr.includes("strategic analysis"), false);
    const contentAny = fallback.content as any;
    assert.ok(contentAny.bullets.length >= 3, "Must produce at least 3 bullets for schema validity");
    assert.equal(contentAny.bullets[0], "Outline bullet point 1");
    assert.equal(contentAny.bullets[1], "Outline bullet point 2");
  });

  it("uses slide title when no bullets, caption, notes or talking points exist, never apology text", () => {
    const emptyChartSlide = {
      layout: "chart",
      title: "Revenue Operations",
      content: {
        chartType: "bar",
        categories: [],
        series: [],
      },
    };

    const fallback = convertChartToFallbackLayout(emptyChartSlide);
    assert.equal(fallback.layout, "bullets");
    const contentAny = fallback.content as any;
    assert.ok(contentAny.bullets.length >= 2);
    assert.ok(contentAny.bullets.every((b: string) => b.includes("Revenue Operations")));
    assert.equal(JSON.stringify(fallback).includes("Data metrics unavailable"), false);
  });
});

describe("F1: Unicode tokenization and Hindi support", () => {
  const hindiPdfText = `
--- [Page 1] ---
प्रस्तुति का परिचय और मुख्य उद्देश्य। डिजिटल परिवर्तन और संगठन की दृष्टि।

--- [Page 2] ---
तकनीकी वास्तुकला और उत्पाद विकास योजना। आधुनिक क्लाउड अवसंरचना।

--- [Page 3] ---
वित्तीय प्रदर्शन और वार्षिक आय वृद्धि। कुल लाभ और शुद्ध राजस्व में विस्तार।
`;

  it("matches a Hindi section to the correct Hindi pages", () => {
    const sections = [
      {
        title: "वित्तीय प्रदर्शन",
        points: ["वार्षिक आय वृद्धि", "शुद्ध राजस्व विस्तार"],
      },
    ];
    const computed = computeDeterministicSectionPageRanges(sections, hindiPdfText, 3);
    assert.deepEqual(computed[0].pageRange, { start: 3, end: 3 });
    assert.equal(computed[0].pageRangeApprox, false, "Hindi distinctive tokens must match Page 3");
  });

  it("keeps a Hindi stopword-only section approximate", () => {
    const sections = [
      {
        title: "और का के",
        points: ["में से पर", "यह वह भी"],
      },
    ];
    const computed = computeDeterministicSectionPageRanges(sections, hindiPdfText, 3);
    assert.equal(computed[0].pageRangeApprox, true, "Stopword-only Hindi section must stay approximate");
  });

  it("matches mixed Hindi/English text properly", () => {
    const mixedPdfText = `
--- [Page 1] ---
Company overview and leadership team.

--- [Page 2] ---
Cloud अवसंरचना और Kubernetes deployment योजना। Microservices वास्तुकला विवरण।
`;
    const sections = [
      {
        title: "Cloud अवसंरचना",
        points: ["Kubernetes deployment", "Microservices वास्तुकला"],
      },
    ];
    const computed = computeDeterministicSectionPageRanges(sections, mixedPdfText, 2);
    assert.deepEqual(computed[0].pageRange, { start: 2, end: 2 });
    assert.equal(computed[0].pageRangeApprox, false, "Mixed Hindi/English terms must match Page 2");
  });

  it("extracts section excerpt for unpaged DOCX-style document with Hindi paragraphs", () => {
    const hindiDocxText = `
परिचय और सामान्य अवलोकन। कंपनी के मुख्य मिशन का विवरण।

उत्पाद वास्तुकला और तकनीकी योजना। आधुनिक क्लाउड अवसंरचना और सुरक्षा मानक लागू करना।

वित्तीय परिणाम और लाभप्रदता। परिचालन लाभ में निरंतर सुधार।
`;
    const excerpt = getSectionExcerptForUnpagedDocument(
      hindiDocxText,
      "उत्पाद वास्तुकला",
      ["क्लाउड अवसंरचना", "सुरक्षा मानक"]
    );
    assert.ok(excerpt && excerpt.includes("उत्पाद वास्तुकला और तकनीकी योजना"));
    assert.ok(excerpt && excerpt.includes("सुरक्षा मानक"));
    assert.equal(excerpt.includes("परिचय और सामान्य अवलोकन"), false);
  });
});

describe("F2: Matching strictness (whole-word boundary and 30% cap at 5 tokens)", () => {
  it("keeps two stray words on a page with a 25-token section approximate", () => {
    const twentyFiveTokens = [
      "quantum", "cryptography", "distributed", "consensus", "byzantine",
      "fault", "tolerance", "zero", "knowledge", "snark",
      "rollup", "throughput", "latency", "benchmark", "sharding",
      "validator", "staking", "slashing", "governance", "telemetry",
      "observability", "immutable", "ledger", "asymmetric", "encryption",
    ];
    assert.equal(twentyFiveTokens.length, 25);

    const pdfWithTwoStrayWords = `
--- [Page 1] ---
Brief note mentioning quantum and cryptography in passing.

--- [Page 2] ---
Other general topics and operational details without any related concepts.
`;

    const section = [
      {
        title: "Advanced Cryptographic Infrastructure",
        points: twentyFiveTokens,
      },
    ];

    const computed = computeDeterministicSectionPageRanges(section, pdfWithTwoStrayWords, 2);
    assert.equal(computed[0].pageRangeApprox, true, "2 stray words for 25-token section must stay approximate");
  });
});

describe("F3: Grounding source (deck.sourceText vs chunk notes vs deleted sourceText)", () => {
  const verbatimSourceText = `
Executive summary. In FY25, total revenue reached $20.4M, representing 48% year-over-year ARR growth.
Operating margin expanded to 21%, while net revenue retention held steady at 135%.
`;

  it("grounds stats and chart numbers against original deck.sourceText even when model was given chunk notes", () => {
    const validChartSlide = {
      layout: "chart",
      title: "Financial Trajectory",
      notes: "Citing verified figures",
      content: {
        chartType: "bar",
        categories: ["Revenue", "Growth", "Margin"],
        series: [{ name: "FY25", values: [20.4, 48, 21] }],
      },
    };

    const groundedChart = groundAndSanitizeSlide(validChartSlide, verbatimSourceText, [
      "FY25 performance",
    ]);
    assert.equal(groundedChart.layout, "chart");

    const hallucinatedChartSlide = {
      layout: "chart",
      title: "Financial Trajectory",
      notes: "From notes",
      content: {
        chartType: "bar",
        categories: ["Revenue", "Growth", "Margin"],
        series: [{ name: "FY25", values: [99, 75, 55] }],
      },
    };

    const rejectedChart = groundAndSanitizeSlide(hallucinatedChartSlide, verbatimSourceText, [
      "FY25 performance",
    ]);
    assert.equal(rejectedChart.layout, "bullets", "Chart with numbers not in sourceText must fall back to bullets");

    const validStatsSlide = {
      layout: "stats",
      title: "Key Metrics",
      content: {
        stats: [
          { value: "$20.4M", label: "ARR" },
          { value: "48%", label: "Growth" },
        ],
      },
    };
    const groundedStats = groundAndSanitizeSlide(validStatsSlide, verbatimSourceText);
    assert.equal(groundedStats.layout, "stats");

    const invalidStatsSlide = {
      layout: "stats",
      title: "Key Metrics",
      content: {
        stats: [
          { value: "99%", label: "Satisfaction" },
          { value: "88%", label: "Adoption" },
        ],
      },
    };
    const rejectedStats = groundAndSanitizeSlide(invalidStatsSlide, verbatimSourceText);
    assert.equal(rejectedStats.layout, "bullets", "Stats with ungrounded numbers must fall back to bullets");
  });

  it("falls back to bullets for both chart and stats when deck.sourceText is deleted/missing", () => {
    const chartSlide = {
      layout: "chart",
      title: "Quarterly Trends",
      content: {
        chartType: "line",
        categories: ["Q1", "Q2", "Q3"],
        series: [{ name: "Metric", values: [100, 150, 200] }],
      },
    };

    const statsSlide = {
      layout: "stats",
      title: "Performance",
      content: {
        stats: [
          { value: "150", label: "Volume" },
          { value: "200", label: "Capacity" },
        ],
      },
    };

    const chartFallbackEmpty = groundAndSanitizeSlide(chartSlide, "");
    assert.equal(chartFallbackEmpty.layout, "bullets", "Chart must fall back to bullets when sourceText is empty");

    const chartFallbackUndefined = groundAndSanitizeSlide(chartSlide, undefined);
    assert.equal(chartFallbackUndefined.layout, "bullets", "Chart must fall back to bullets when sourceText is undefined");

    const statsFallbackEmpty = groundAndSanitizeSlide(statsSlide, "");
    assert.equal(statsFallbackEmpty.layout, "bullets", "Stats must fall back to bullets when sourceText is empty");

    const statsFallbackUndefined = groundAndSanitizeSlide(statsSlide, undefined);
    assert.equal(statsFallbackUndefined.layout, "bullets", "Stats must fall back to bullets when sourceText is undefined");
  });
});

describe("G1: Chart category grounding with preserved years/quarters", () => {
  const sourceWithYearsAndValues = `
--- [Page 18] ---
Historical Revenue Growth:
In 2022, annual revenue was $120M.
In 2023, annual revenue increased to $180M.
In 2024, annual revenue reached $240M.
`;

  it("accepts a chart with categories 2022, 2023, 2024 and values found in the source", () => {
    const chartSlide = {
      layout: "chart",
      title: "Three-Year Revenue Trajectory",
      content: {
        chartType: "bar",
        categories: ["2022", "2023", "2024"],
        series: [{ name: "Revenue", values: [120, 180, 240] }],
      },
    };

    const grounded = validateAndGroundChartSlide(chartSlide, sourceWithYearsAndValues);
    assert.equal(grounded.layout, "chart", "Chart with grounded year categories and real values must be accepted");
    assert.deepEqual(grounded.content.categories, ["2022", "2023", "2024"]);
    assert.deepEqual(grounded.content.series[0].values, [120, 180, 240]);
  });

  it("accepts year and quarter labels like FY24 and Q3 when present in source", () => {
    const quarterSource = `
Operational Results:
In Q1, gross profit was $45M.
In Q2, gross profit was $60M.
In Q3, gross profit reached $85M.
For FY24, total projection was $300M.
`;
    const chartSlide = {
      layout: "chart",
      title: "Quarterly Performance",
      content: {
        chartType: "line",
        categories: ["Q1", "Q2", "Q3"],
        series: [{ name: "Gross Profit", values: [45, 60, 85] }],
      },
    };
    const grounded = validateAndGroundChartSlide(chartSlide, quarterSource);
    assert.equal(grounded.layout, "chart", "Chart with Q1, Q2, Q3 categories must be accepted");
  });

  it("rejects the same chart with values that only match page numbers", () => {
    const chartWithPageNumberValues = {
      layout: "chart",
      title: "Three-Year Revenue Trajectory",
      content: {
        chartType: "bar",
        categories: ["2022", "2023", "2024"],
        series: [{ name: "Revenue", values: [18, 19, 20] }], // 18 is from page marker "--- [Page 18] ---"
      },
    };

    const grounded = validateAndGroundChartSlide(chartWithPageNumberValues, sourceWithYearsAndValues);
    assert.equal(grounded.layout, "bullets", "Chart plotting page numbers must be rejected");
  });

  it("rejects categories not present in the source at all", () => {
    const chartWithMissingCategories = {
      layout: "chart",
      title: "Future Projections",
      content: {
        chartType: "bar",
        categories: ["2028", "2029", "2030"], // Not in source
        series: [{ name: "Revenue", values: [120, 180, 240] }],
      },
    };

    const grounded = validateAndGroundChartSlide(chartWithMissingCategories, sourceWithYearsAndValues);
    assert.equal(grounded.layout, "bullets", "Chart with categories not present in source must be rejected");
  });
});

describe("G2: Light English normalization in token matcher", () => {
  it("stems trailing s, es, ing, ed, ly for tokens of 5+ letters", () => {
    assert.equal(getLightEnglishStem("customers"), "customer");
    assert.equal(getLightEnglishStem("processes"), "process");
    assert.equal(getLightEnglishStem("starting"), "start");
    assert.equal(getLightEnglishStem("started"), "start");
    assert.equal(getLightEnglishStem("rapidly"), "rapid");
  });

  it("does not stem tokens under 5 letters", () => {
    assert.equal(getLightEnglishStem("grow"), undefined);
    assert.equal(getLightEnglishStem("cats"), undefined);
    assert.equal(getLightEnglishStem("king"), undefined);
    assert.equal(getLightEnglishStem("bed"), undefined);
  });

  it("does not wrongly match 'growth' to 'grow' under the chosen rule (trailing 'th' is preserved)", () => {
    // Document chosen rule: Suffixes stripped are strictly s, es, ing, ed, ly.
    // 'growth' ends in 'th', so it remains 'growth'.
    // 'grow' is 4 letters (< 5), so it remains 'grow'.
    assert.equal(getLightEnglishStem("growth"), undefined);
    assert.equal(getLightEnglishStem("grow"), undefined);

    const tokenSet = new Set(["grow"]);
    assert.equal(matchTokenWithStem("growth", tokenSet), false, "'growth' must not match 'grow'");
  });

  it("does not add stemming for Devanagari", () => {
    assert.equal(getLightEnglishStem("ग्राहकों"), undefined);
    assert.equal(getLightEnglishStem("नमस्ते"), undefined);
  });

  it("matches 'customers' with 'customer' in page/section token matching on both sides", () => {
    const pdfWithCustomer = `
--- [Page 1] ---
Executive Summary
--- [Page 2] ---
Our primary customer segment showed excellent retention and engagement metrics.
--- [Page 3] ---
Conclusion
`;
    // Section uses "customers" (plural)
    const sectionWithCustomers = [
      {
        title: "Customers Retention Segment",
        points: ["Key customer metrics", "Engagement trends"],
      },
    ];

    const computed = computeDeterministicSectionPageRanges(sectionWithCustomers, pdfWithCustomer, 3);
    assert.equal(computed[0].pageRangeApprox, false, "Section with 'customers' must match page with 'customer'");
    assert.equal(computed[0].pageRange?.start, 2);
    assert.equal(computed[0].pageRange?.end, 2);
  });
});

describe("G3: [DeterministicPageRanges] match-rate log includes page count and sections count", () => {
  it("logs [DeterministicPageRanges] with page count and number of sections with no content", () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => {
      logs.push(args.join(" "));
      origLog(...args);
    };

    try {
      const pdfText = `
--- [Page 1] ---
Market Dynamics and Industry Backdrop
--- [Page 2] ---
Product Roadmap and Feature Architecture
`;
      const sections = [
        { title: "Market Dynamics", points: ["Industry backdrop"] },
        { title: "Product Roadmap", points: ["Feature architecture"] },
      ];

      computeDeterministicSectionPageRanges(sections, pdfText, 2);

      const targetLog = logs.find((l) => l.includes("[DeterministicPageRanges]"));
      assert.ok(targetLog, "Must emit [DeterministicPageRanges] log");
      assert.ok(targetLog.includes("across 2 pages (2 sections)"), `Log must include page count and section count: ${targetLog}`);
      assert.ok(!targetLog.includes("Market Dynamics"), "Log must not contain section or document content");
    } finally {
      console.log = origLog;
    }
  });
});

describe("G4: Slide regeneration note when source text is deleted", () => {
  it("converts stats and chart slides to fallback layout and identifies missing verified numbers", () => {
    const chartSlide = {
      layout: "chart",
      title: "Quarterly Trends",
      content: {
        chartType: "bar",
        categories: ["2022", "2023", "2024"],
        series: [{ name: "Metric", values: [100, 150, 200] }],
      },
    };

    const statsSlide = {
      layout: "stats",
      title: "Performance",
      content: {
        stats: [
          { value: "$20.4M", label: "ARR" },
          { value: "48,000", label: "Users" },
        ],
      },
    };

    // When sourceText is deleted (undefined or empty)
    const groundedChart = groundAndSanitizeSlide(chartSlide, undefined);
    assert.equal(groundedChart.layout, "bullets", "Chart slide must fall back to bullets when sourceText is deleted");

    const groundedStats = groundAndSanitizeSlide(statsSlide, undefined);
    assert.equal(groundedStats.layout, "bullets", "Stats slide must fall back to bullets when sourceText is deleted");
  });
});

describe("I7: Grounding actively modifies slide on ungrounded numbers", () => {
  it("removes ungrounded numbers from bullets and titles or falls back when stats are ungrounded", () => {
    const sourceText = "Annual report: We generated $10M revenue and served 500 customers.";

    // 1. Bullet and title with ungrounded numbers
    const slideWithNumbers = {
      layout: "bullets",
      title: "Growth in 2024 was 888888x", // 888888x is ungrounded
      content: {
        bullets: [
          "Generated $10M revenue across global markets", // $10M is grounded
          "Fabricated metric claimed at 999999% without source backing", // 999999% is ungrounded
        ],
      },
      notes: "Audited numbers",
    };

    const grounded = groundAndSanitizeSlide(slideWithNumbers, sourceText);

    // Assert ungrounded number in title is removed
    assert.ok(!grounded.title.includes("888888"), "Ungrounded number in title must be removed");

    // Assert grounded number in bullet 1 is preserved
    assert.ok(grounded.content.bullets[0].includes("$10M"), "Grounded number in bullet must be preserved");

    // Assert ungrounded number in bullet 2 is stripped
    assert.ok(!grounded.content.bullets[1].includes("999999"), "Ungrounded number in bullet must be removed");
    assert.ok(grounded.content.bullets[1].includes("Fabricated metric claimed at without source backing"), "Remaining non-numeric text must be preserved");

    // 2. Stats slide where stats contain ungrounded numbers falls back to non-numeric version
    const statsSlide = {
      layout: "stats",
      title: "Performance",
      content: {
        stats: [
          { value: "999999", label: "Fake Metric" },
          { value: "888888", label: "Another Fake Metric" },
        ],
      },
    };

    const groundedStats = groundAndSanitizeSlide(statsSlide, sourceText);
    assert.equal(groundedStats.layout, "bullets", "Stats slide with ungrounded stats must fall back to non-numeric bullets layout");
    assert.ok(!JSON.stringify(groundedStats).includes("999999"), "Ungrounded stat value must not appear in output");
  });

  it("strips ungrounded numbers in two_column, process step desc, and title subtitle", () => {
    const sourceText = "Our company achieved $50M revenue and 100 enterprise clients in 2024.";

    // 1. Two-column layout
    const twoColSlide = {
      layout: "two_column",
      title: "Comparison",
      content: {
        left: {
          heading: "Grounded Column",
          bullets: ["Achieved $50M revenue", "Fabricated 777777 ungrounded"],
        },
        right: {
          heading: "Another Column",
          bullets: ["100 enterprise clients", "Fake 444444 ungrounded number"],
        },
      },
    };
    const groundedTwoCol = groundAndSanitizeSlide(twoColSlide, sourceText);
    assert.ok(groundedTwoCol.content.left.bullets[0].includes("$50M"));
    assert.ok(!groundedTwoCol.content.left.bullets[1].includes("777777"));
    assert.ok(groundedTwoCol.content.right.bullets[0].includes("100"));
    assert.ok(!groundedTwoCol.content.right.bullets[1].includes("444444"));

    // 2. Process layout with step.desc
    const processSlide = {
      layout: "process",
      title: "Implementation",
      content: {
        steps: [
          { label: "Phase 1", desc: "Targeting $50M revenue milestone" },
          { label: "Phase 2", desc: "Bogus target of 999999 units produced" },
        ],
      },
    };
    const groundedProcess = groundAndSanitizeSlide(processSlide, sourceText);
    assert.ok(groundedProcess.content.steps[0].desc.includes("$50M"));
    assert.ok(!groundedProcess.content.steps[1].desc.includes("999999"));

    // 3. Title layout with subtitle
    const titleSlide = {
      layout: "title",
      title: "Report with 333333 Ungrounded",
      content: {
        subtitle: "Enterprise results with 888888 ungrounded and 100 enterprise clients",
      },
    };
    const groundedTitle = groundAndSanitizeSlide(titleSlide, sourceText);
    assert.ok(!groundedTitle.title.includes("333333"));
    assert.ok(!groundedTitle.content.subtitle.includes("888888"));
    assert.ok(groundedTitle.content.subtitle.includes("100"));
  });
});





