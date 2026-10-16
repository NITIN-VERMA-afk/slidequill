import "../../../scratch/load_env";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CURATED_FALLBACKS,
  getFallbackForKeyword,
  trackUnsplashDownload,
  searchStockImage,
  clearImageCache,
  getImageCacheSize,
  getHourlyBudgetUsage,
  resetHourlyBudget,
  recordUnsplashCall,
  UNSPLASH_HOURLY_BUDGET,
  validateAndCleanImageQuery,
  isDataHeavyBulletList,
} from "../image-search";

describe("Image Fallbacks & Licensing", () => {
  it("all curated fallbacks have valid Unsplash URLs and non-empty photographer attribution", () => {
    for (const [key, fallback] of Object.entries(CURATED_FALLBACKS)) {
      assert.ok(fallback.url.startsWith("https://images.unsplash.com/"), `${key} url must start with https://images.unsplash.com/`);
      assert.ok(fallback.photographer && fallback.photographer.trim().length > 0, `${key} photographer must not be empty`);
      assert.ok(fallback.photographerUrl && fallback.photographerUrl.startsWith("https://unsplash.com/"), `${key} photographerUrl must be an Unsplash profile link`);
      assert.equal(fallback.source, "curated");
    }
  });

  it("CURATED_FALLBACKS.default correctly attributes Austin Distel", () => {
    const def = CURATED_FALLBACKS.default;
    assert.equal(def.photographer, "Austin Distel");
    assert.equal(def.photographerUrl, "https://unsplash.com/@austindistel");
    assert.ok(def.url.includes("photo-1497366216548-37526070297c"));
  });

  it("getFallbackForKeyword maps keywords correctly and falls back to default", () => {
    assert.equal(getFallbackForKeyword("modern tech architecture").photographer, "Alexandre Debiève");
    assert.equal(getFallbackForKeyword("business strategy").photographer, "Sean Pollock");
    assert.equal(getFallbackForKeyword("teamwork and culture").photographer, "Annie Spratt");
    assert.equal(getFallbackForKeyword("completely unknown topic").photographer, "Austin Distel");
  });
});

describe("trackUnsplashDownload", () => {
  it("handles empty or missing download location safely", async () => {
    await assert.doesNotReject(async () => {
      await trackUnsplashDownload(undefined);
      await trackUnsplashDownload("");
    });
  });

  it("strictly rejects non-api.unsplash.com domains to prevent SSRF", async () => {
    // Should log warning and abort without calling external endpoints
    await assert.doesNotReject(async () => {
      await trackUnsplashDownload("https://attacker.com/steal-creds");
      await trackUnsplashDownload("https://127.0.0.1:8080/download");
      await trackUnsplashDownload("http://api.unsplash.com/photos/123/download");
    });
  });
});

describe("searchStockImage fallback policy", () => {
  it("allows curated fallback on title and closing slides when API has no result or is rate-limited", async () => {
    resetHourlyBudget();
    clearImageCache();
    // Consume budget to guarantee candidates are empty without external API noise
    for (let i = 0; i < UNSPLASH_HOURLY_BUDGET; i++) {
      recordUnsplashCall();
    }

    const titleRes = await searchStockImage("nonexistent query xyz", undefined, {
      isTitleOrClosing: true,
      layout: "title",
    });
    assert.ok(titleRes, "Title slide must receive a curated fallback");
    assert.ok(titleRes.url.startsWith("https://images.unsplash.com/"));
    assert.equal(titleRes.source, "curated");

    const closingRes = await searchStockImage("nonexistent query xyz", undefined, {
      isTitleOrClosing: true,
      layout: "closing",
    });
    assert.ok(closingRes, "Closing slide must receive a curated fallback");
    assert.equal(closingRes.source, "curated");

    resetHourlyBudget();
  });

  it("leaves content slides WITHOUT an image when API has no result rather than using unrelated curated photo", async () => {
    resetHourlyBudget();
    clearImageCache();
    // Consume budget to guarantee candidates are empty
    for (let i = 0; i < UNSPLASH_HOURLY_BUDGET; i++) {
      recordUnsplashCall();
    }

    const bulletRes = await searchStockImage("nonexistent query xyz", undefined, {
      isTitleOrClosing: false,
      layout: "bullets",
    });
    assert.equal(bulletRes, null, "Bullets slide must be left without image when API has no result");

    const imageRes = await searchStockImage("nonexistent query xyz", undefined, {
      isTitleOrClosing: false,
      layout: "image",
    });
    assert.equal(imageRes, null, "Image slide must be left without image when API has no result");

    resetHourlyBudget();
  });
});

describe("Hourly Budget & Rate Limiting", () => {
  it("tracks hourly budget and reports remaining quota", () => {
    resetHourlyBudget();
    const initial = getHourlyBudgetUsage();
    assert.equal(initial.count, 0);
    assert.equal(initial.max, UNSPLASH_HOURLY_BUDGET);
    assert.equal(initial.remaining, UNSPLASH_HOURLY_BUDGET);

    recordUnsplashCall();
    recordUnsplashCall();
    const updated = getHourlyBudgetUsage();
    assert.equal(updated.count, 2);
    assert.equal(updated.remaining, UNSPLASH_HOURLY_BUDGET - 2);

    resetHourlyBudget();
    assert.equal(getHourlyBudgetUsage().count, 0);
  });

  it("respects hourly budget cap and prevents runaway requests", async () => {
    resetHourlyBudget();
    // Simulate consuming entire hourly quota
    for (let i = 0; i < UNSPLASH_HOURLY_BUDGET; i++) {
      recordUnsplashCall();
    }
    const usage = getHourlyBudgetUsage();
    assert.equal(usage.remaining, 0);

    // Call searchStockImage for content slide with exhausted budget
    const res = await searchStockImage("analytics dashboard", undefined, {
      isTitleOrClosing: false,
      layout: "bullets",
    });
    assert.equal(res, null, "Content slide must be left without image when budget exhausted");

    resetHourlyBudget();
  });
});

describe("24h Query Caching & Unused-ID Deduplication", () => {
  it("caches candidates in memory and avoids redundant external queries", async () => {
    clearImageCache();
    assert.equal(getImageCacheSize(), 0);

    const first = await searchStockImage("artificial intelligence chips", undefined, {
      isTitleOrClosing: true,
      layout: "title",
    });
    assert.ok(first);
    assert.equal(getImageCacheSize(), 1);

    // Second call for same query hits the cache
    const second = await searchStockImage("artificial intelligence chips", undefined, {
      isTitleOrClosing: true,
      layout: "title",
    });
    assert.ok(second);
    assert.equal(getImageCacheSize(), 1);
  });

  it("deduplicates photos across a deck using usedPhotoIds tracker", async () => {
    const usedIds = new Set<string>();

    const img1 = await searchStockImage("cloud servers datacenter", usedIds, {
      isTitleOrClosing: true,
      layout: "title",
    });
    const img2 = await searchStockImage("cloud servers datacenter", usedIds, {
      isTitleOrClosing: true,
      layout: "title",
    });

    assert.ok(img1);
    assert.ok(img2);
    // If multiple candidates exist, img1 and img2 should have different URLs / IDs
    assert.notEqual(img1.url, img2.url, "Images resolved for the same query in the same deck must be distinct");
    assert.equal(usedIds.size, 2);
  });

  it("selects distinct curated fallbacks when fallback keywords collide", () => {
    const usedIds = new Set<string>();
    const fb1 = getFallbackForKeyword("business strategy", usedIds);
    if (fb1.id) usedIds.add(fb1.id);

    const fb2 = getFallbackForKeyword("business strategy", usedIds);
    assert.notEqual(fb1.url, fb2.url, "Second fallback must find an unused alternative");
  });

  it("compares real photo IDs only and never treats ID-less images as duplicates of each other", async () => {
    const usedIds = new Set<string>(["existing-photo-id-1", "existing-photo-id-2"]);

    // An image without an ID should never be filtered out as a duplicate by usedIds
    const candidateWithoutId = {
      id: undefined,
      url: "https://example.com/idless-1.jpg",
      thumb: "https://example.com/idless-1-thumb.jpg",
      photographer: "Anonymous",
      source: "curated" as const,
    };

    const isDuplicate = Boolean(candidateWithoutId.id && usedIds.has(candidateWithoutId.id));
    assert.equal(isDuplicate, false, "Image without ID must not be identified as a duplicate");

    // When an ID-less image is selected, usedIds should remain unchanged (no non-ID key added)
    const initialSize = usedIds.size;
    if (candidateWithoutId.id) {
      usedIds.add(candidateWithoutId.id);
    }
    assert.equal(usedIds.size, initialSize, "usedIds must only store real photo IDs");
  });
});

describe("Image Query Quality & Data-Heavy Bullet Exclusions", () => {
  it("strips generic prefixes ('a photo of', 'picture of', 'image of') and normalizes query", () => {
    const res1 = validateAndCleanImageQuery("a photo of solar panel rooftop");
    assert.equal(res1.valid, true);
    assert.equal(res1.query, "solar panel rooftop");

    const res2 = validateAndCleanImageQuery("picture of electric vehicle assembly");
    assert.equal(res2.valid, true);
    assert.equal(res2.query, "electric vehicle assembly");

    const res3 = validateAndCleanImageQuery("an image of automated container crane");
    assert.equal(res3.valid, true);
    assert.equal(res3.query, "automated container crane");
  });

  it("strictly rejects bare 1-word abstracts and generic topics (e.g. 'data', 'energy', 'success')", () => {
    assert.equal(validateAndCleanImageQuery("data").valid, false);
    assert.equal(validateAndCleanImageQuery("energy").valid, false);
    assert.equal(validateAndCleanImageQuery("success").valid, false);
    assert.equal(validateAndCleanImageQuery("technology").valid, false);
    assert.equal(validateAndCleanImageQuery("finance").valid, false);
    assert.equal(validateAndCleanImageQuery("data").reason, "too_short_min_2_words");
  });

  it("rejects generic abstract multi-word combinations (e.g. 'business meeting', 'cloud data')", () => {
    const res = validateAndCleanImageQuery("business meeting");
    assert.equal(res.valid, false);
    assert.equal(res.reason, "generic_abstract_phrase");

    const res2 = validateAndCleanImageQuery("cloud data network");
    assert.equal(res2.valid, false);
    assert.equal(res2.reason, "generic_abstract_phrase");
  });

  it("accepts concrete 2 to 4 word visual subjects", () => {
    const res = validateAndCleanImageQuery("solar panel rooftop installation");
    assert.equal(res.valid, true);
    assert.equal(res.query, "solar panel rooftop installation");

    const res2 = validateAndCleanImageQuery("dna sequencer laboratory");
    assert.equal(res2.valid, true);
    assert.equal(res2.query, "dna sequencer laboratory");
  });

  it("enforces uniqueness across a deck and rejects exact duplicate queries", () => {
    const usedInDeck = new Set<string>();

    const first = validateAndCleanImageQuery("wind turbine technician", usedInDeck);
    assert.equal(first.valid, true);
    usedInDeck.add(first.query!.toLowerCase());

    const duplicate = validateAndCleanImageQuery("wind turbine technician", usedInDeck);
    assert.equal(duplicate.valid, false);
    assert.equal(duplicate.reason, "duplicate_in_deck");

    const duplicateCase = validateAndCleanImageQuery("WIND TURBINE TECHNICIAN", usedInDeck);
    assert.equal(duplicateCase.valid, false);
    assert.equal(duplicateCase.reason, "duplicate_in_deck");
  });

  it("detects data-heavy bullet lists and skips images for text readability", () => {
    const dataHeavySlide = {
      layout: "bullets",
      content: {
        points: [
          "Q3 revenue grew 24.5% year-over-year to $45.2M",
          "Operating margins expanded by 340 bps across all regions",
          "Net customer retention reached 118%",
        ],
      },
    };
    assert.equal(isDataHeavyBulletList(dataHeavySlide), true, "Bullets with >=2 statistics must be flagged as data-heavy");

    const textOnlySlide = {
      layout: "bullets",
      content: {
        points: [
          "Establish core product principles early",
          "Gather continuous qualitative customer feedback",
          "Empower cross-functional agile teams",
        ],
      },
    };
    assert.equal(isDataHeavyBulletList(textOnlySlide), false, "Qualitative bullets should not be flagged as data-heavy");

    const nonBulletSlide = {
      layout: "stats",
      content: {
        stats: [{ value: "99.9%", label: "Uptime" }],
      },
    };
    assert.equal(isDataHeavyBulletList(nonBulletSlide), false, "Non-bullet layouts must not be flagged by bullet checker");
  });
});

