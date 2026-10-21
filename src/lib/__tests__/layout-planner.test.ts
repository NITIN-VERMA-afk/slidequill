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

  it("allows 6+ slide deck with zero stats/chart slides when no numbers are available (no forced stats/chart rule)", () => {
    const noStats: SlideLayoutType[] = [
      "title",
      "process",
      "image",
      "two_column",
      "quote",
      "closing",
    ];
    const res = validateLayoutPlan(noStats);
    assert.equal(res.valid, true);
    assert.equal(res.violations.length, 0);
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
    assert.ok(validation.visualCount >= 1);
  });
});

describe("A2: Layout Planner Grounded Numeric Requirements", () => {
  const threeNumbersExcerpt =
    "--- [Page 18] --- In 2024, our revenue was $120M, EBITDA reached $45M, and margins expanded to 35%.";
  const twoNumbersExcerpt =
    "--- [Page 19] --- Total ARR reached $20.4M, representing 21% YoY expansion across regions.";
  const oneNumberExcerpt =
    "--- [Page 20] --- Total active users reached 48,000 across North America.";
  const pageMarkerOnlyExcerpt =
    "--- [Page 18] --- In 2024, our team had 4 priorities. 1. Growth 2. Quality 3. Security. See page 19.";
  const emptyExcerpt = "";

  it("assigns 'chart' only when excerpt has at least 3 grounded numeric values", () => {
    const outline: OutlineSection[] = [
      { id: "s1", title: "Overview", points: [] },
      { id: "s2", title: "Revenue Trends", points: ["Financial growth trajectory"] },
      { id: "s3", title: "Conclusion", points: [] },
    ];

    // Excerpt with 3 real values ($120M, $45M, 35%)
    const excerptsWithThree = [undefined, threeNumbersExcerpt, undefined];
    const planThree = buildDeterministicLayoutPlan(outline, ["title", "chart", "closing"], excerptsWithThree);
    assert.equal(planThree[1], "chart", "Must assign 'chart' when excerpt has >= 3 grounded numbers");

    // Excerpt with only 2 real values ($20.4M, 21%)
    const excerptsWithTwo = [undefined, twoNumbersExcerpt, undefined];
    const planTwo = buildDeterministicLayoutPlan(outline, ["title", "chart", "closing"], excerptsWithTwo);
    assert.notEqual(planTwo[1], "chart", "Must NOT assign 'chart' when excerpt has < 3 numbers");
    assert.equal(planTwo[1], "stats", "Falls back to 'stats' when excerpt has 2 numbers");

    // Excerpt with only 1 real value (48,000)
    const excerptsWithOne = [undefined, oneNumberExcerpt, undefined];
    const planOne = buildDeterministicLayoutPlan(outline, ["title", "chart", "closing"], excerptsWithOne);
    assert.notEqual(planOne[1], "chart", "Must NOT assign 'chart' when excerpt has < 3 numbers");
    assert.notEqual(planOne[1], "stats", "Must NOT assign 'stats' when excerpt has < 2 numbers");
    assert.equal(planOne[1], "bullets");
  });

  it("assigns 'stats' only when excerpt has at least 2 grounded numeric values", () => {
    const outline: OutlineSection[] = [
      { id: "s1", title: "Title", points: [] },
      { id: "s2", title: "Key Metrics", points: ["Core business stats"] },
      { id: "s3", title: "Closing", points: [] },
    ];

    // Excerpt with 2 numbers ($20.4M, 21%)
    const excerptsWithTwo = [undefined, twoNumbersExcerpt, undefined];
    const planTwo = buildDeterministicLayoutPlan(outline, ["title", "stats", "closing"], excerptsWithTwo);
    assert.equal(planTwo[1], "stats", "Must assign 'stats' when excerpt has >= 2 numbers");

    // Excerpt with 1 number (48,000)
    const excerptsWithOne = [undefined, oneNumberExcerpt, undefined];
    const planOne = buildDeterministicLayoutPlan(outline, ["title", "stats", "closing"], excerptsWithOne);
    assert.notEqual(planOne[1], "stats", "Must NOT assign 'stats' when excerpt has < 2 numbers");
    assert.equal(planOne[1], "bullets");
  });

  it("never assigns 'chart' or 'stats' to a section with no usable excerpt", () => {
    const outline: OutlineSection[] = [
      { id: "s1", title: "Title", points: [] },
      { id: "s2", title: "Financial Highlights", points: ["Revenue and metrics"] },
      { id: "s3", title: "Performance Overview", points: ["Quarterly metrics and stats"] },
      { id: "s4", title: "Closing", points: [] },
    ];

    // Both sections have no usable excerpt
    const emptyExcerpts = [undefined, emptyExcerpt, undefined, undefined];
    const plan = buildDeterministicLayoutPlan(
      outline,
      ["title", "chart", "stats", "closing"],
      emptyExcerpts
    );

    assert.notEqual(plan[1], "chart", "Must not assign 'chart' to section without usable excerpt");
    assert.notEqual(plan[1], "stats", "Must not assign 'stats' to section without usable excerpt");
    assert.notEqual(plan[2], "chart", "Must not assign 'chart' to section without usable excerpt");
    assert.notEqual(plan[2], "stats", "Must not assign 'stats' to section without usable excerpt");
  });

  it("ignores page markers, calendar years, dates, and bare integers < 32", () => {
    const outline: OutlineSection[] = [
      { id: "s1", title: "Title", points: [] },
      { id: "s2", title: "Annual Summary", points: ["Strategic takeaways"] },
      { id: "s3", title: "Closing", points: [] },
    ];

    // Excerpt has only page markers (18, 19), year (2024), and bare integer 4
    const excerptsWithMarkersOnly = [undefined, pageMarkerOnlyExcerpt, undefined];
    const plan = buildDeterministicLayoutPlan(
      outline,
      ["title", "stats", "closing"],
      excerptsWithMarkersOnly
    );

    assert.notEqual(plan[1], "stats", "Must NOT assign 'stats' when numbers are only page numbers or calendar years");
    assert.notEqual(plan[1], "chart", "Must NOT assign 'chart' when numbers are only page numbers or calendar years");
    assert.equal(plan[1], "bullets");
  });

  it("validateLayoutPlan rejects plans that assign chart/stats to sections with insufficient numbers", () => {
    const plan: SlideLayoutType[] = ["title", "chart", "stats", "closing"];
    const excerpts = [
      undefined,
      twoNumbersExcerpt, // chart needs 3, only has 2
      oneNumberExcerpt,  // stats needs 2, only has 1
      undefined,
    ];

    const validation = validateLayoutPlan(plan, excerpts);
    assert.equal(validation.valid, false);
    assert.ok(validation.violations.some((v) => v.includes("chart") && v.includes("minimum 3 required")));
    assert.ok(validation.violations.some((v) => v.includes("stats") && v.includes("minimum 2 required")));
  });
});

