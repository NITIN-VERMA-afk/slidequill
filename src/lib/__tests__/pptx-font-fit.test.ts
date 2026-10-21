import { describe, it } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { buildPptx } from "../export/pptx";
import { getTheme } from "../themes";
import type { SlideData } from "../slides-schema";

const testSlides: SlideData[] = [
  {
    id: "s1",
    layout: "bullets",
    title: "A Somewhat Long Slide Title Designed To Test Font Size Fitting Behavior Gracefully",
    notes: "Notes",
    content: {
      bullets: [
        "First bullet point with extensive detail explaining operational parameters and strategic objectives.",
        "Second bullet point highlighting multi-quarter performance metrics across diverse business divisions.",
        "Third bullet point summarizing cross-functional efficiencies and continuous infrastructure monitoring.",
      ],
    },
  },
  {
    id: "s2",
    layout: "quote",
    title: "Executive Quote",
    notes: "Quote notes",
    content: {
      quote: "Quality means doing it right when no one is looking, especially across scalable cloud architectures.",
      attribution: "Engineering Leadership",
    },
  },
];

describe("PPTX Font Fitting & Elegant Theme Font", () => {
  it("Elegant theme uses Georgia heading font instead of unsupported Palatino Linotype", () => {
    const elegant = getTheme("elegant");
    assert.equal(elegant.headingFont.name, "Georgia");
    assert.equal(elegant.bodyFont.name, "Georgia");
  });

  it("exports PPTX using computed fitted font sizes and generates valid XML", async () => {
    const buffer = await buildPptx("Font Fit Test Deck", testSlides, "elegant", false);
    assert.ok(buffer && buffer.length > 0, "Buffer generated");

    const zip = await JSZip.loadAsync(buffer);
    const slide1Xml = await zip.file("ppt/slides/slide1.xml")?.async("string");
    const slide2Xml = await zip.file("ppt/slides/slide2.xml")?.async("string");

    assert.ok(slide1Xml, "Slide 1 XML exists");
    assert.ok(slide2Xml, "Slide 2 XML exists");

    // Both slides should have fontFace specified as Georgia
    assert.ok(slide1Xml.includes('typeface="Georgia"'), "Slide 1 uses Georgia typeface");
    assert.ok(slide2Xml.includes('typeface="Georgia"'), "Slide 2 uses Georgia typeface");

    // Bullet text and quote text exist in output
    assert.ok(slide1Xml.includes("First bullet point"), "Slide 1 contains bullet text");
    assert.ok(slide2Xml.includes("Quality means doing it right"), "Slide 2 contains quote text");
  });
});
