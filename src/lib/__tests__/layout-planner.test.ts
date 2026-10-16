import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateLayoutPlan,
  buildDeterministicLayoutPlan,
  type SlideLayoutType,
} from "../layout-planner";
import type { OutlineSection } from "@/app/models/Deck";

describe("Deck-Level Layout Planner Diversity Rules (src/lib/layout-planner.ts)", () => {
  it("validates a compliant 10-slide layout plan", () => {
    const compliant: SlideLayoutType[] = [
      "title",
      "two_column",
      "bullets",
      "stats",
      "process",
      "image",
      "bullets",
      "chart",
      "quote",
      "closing",
    ];
    const res = validateLayoutPlan(compliant);
    assert.equal(res.valid, true);
    assert.equal(res.violations.length, 0);
    assert.equal(res.bulletRatio <= 0.40, true);
    assert.ok(res.statsCount >= 1);
    assert.ok(res.visualCount >= 1);
  });

  it("rejects plan with more than 40% bullets", () => {
    const tooManyBullets: SlideLayoutType[] = [
      "title",
      "bullets",
      "bullets",
      "process",
      "bullets",
      "bullets",
      "stats",
      "bullets",
      "two_column",
      "closing",
    ];
    const res = validateLayoutPlan(tooManyBullets);
    assert.equal(res.valid, false);
    assert.ok(res.violations.some((v) => v.includes("exceeds 40% maximum")));
  });

  it("rejects plan with 3 consecutive slides of the same layout", () => {
    const consecutive: SlideLayoutType[] = [
      "title",
      "stats",
      "two_column",
      "two_column",
      "two_column",
      "image",
      "closing",
    ];
    const res = validateLayoutPlan(consecutive);
    assert.equal(res.valid, false);
    assert.ok(res.violations.some((v) => v.includes("3 consecutive slides have the same layout")));
  });

  it("rejects plan where slide 1 is not title or last slide is not closing", () => {
    const badEnds: SlideLayoutType[] = ["bullets", "stats", "process", "bullets"];
    const res = validateLayoutPlan(badEnds);
    assert.equal(res.valid, false);
    assert.ok(res.violations.some((v) => v.includes("Slide 1 must be 'title'")));
    assert.ok(res.violations.some((v) => v.includes("Last slide must be 'closing'")));
  });

  it("rejects 6+ slide deck with zero stats/chart slides", () => {
    const noStats: SlideLayoutType[] = [
      "title",
      "process",
      "image",
      "two_column",
      "quote",
      "closing",
    ];
    const res = validateLayoutPlan(noStats);
    assert.equal(res.valid, false);
    assert.ok(res.violations.some((v) => v.includes("must include at least 1 'stats' or 'chart' slide")));
  });

  it("deterministic repair fixes invalid plans into fully compliant plans", () => {
    const outline: OutlineSection[] = Array.from({ length: 10 }, (_, i) => ({
      id: `sec-${i}`,
      title: `Section ${i + 1}`,
      points: ["Point 1", "Point 2"],
    }));

    // Start with an all-bullets invalid plan
    const allBullets: SlideLayoutType[] = Array(10).fill("bullets");
    const repaired = buildDeterministicLayoutPlan(outline, allBullets);

    const validation = validateLayoutPlan(repaired);
    assert.equal(validation.valid, true, `Repaired plan should be valid: ${validation.violations.join(", ")}`);
    assert.equal(repaired[0], "title");
    assert.equal(repaired[9], "closing");
    assert.ok(validation.bulletRatio <= 0.40);
    assert.ok(validation.statsCount >= 1);
    assert.ok(validation.visualCount >= 1);
  });
});
