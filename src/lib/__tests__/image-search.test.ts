import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CURATED_FALLBACKS,
  getFallbackForKeyword,
  trackUnsplashDownload,
  searchStockImage,
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

describe("searchStockImage fallback resilience", () => {
  it("returns curated fallback with complete attribution when API keys are not provided", async () => {
    const res = await searchStockImage("analytics dashboard");
    assert.ok(res.url.startsWith("https://images.unsplash.com/"));
    assert.ok(res.photographer.length > 0);
    assert.ok(res.source);
  });
});
