import { describe, it } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { buildPptx } from "../export/pptx";
import type { SlideData } from "../slides-schema";

const testSlides: SlideData[] = [
  {
    id: "s1",
    layout: "stats",
    title: "Quarterly Growth Stats",
    notes: "Executive stats notes",
    content: {
      stats: [
        { value: "99.9%", label: "Uptime SLA", icon: "Shield" },
        { value: "4.5x", label: "ARR Multiple", icon: "Zap" },
      ],
    },
  },
  {
    id: "s2",
    layout: "two_column",
    title: "Operational Pillars",
    notes: "Two column notes",
    content: {
      left: {
        heading: "Engineering",
        bullets: ["Automated testing pipelines", "Zero-downtime releases"],
      },
      right: {
        heading: "Security",
        bullets: ["SOC2 Type II compliance", "Continuous threat modeling"],
      },
    },
  },
];

describe("PPTX Corner Radius & Geometry Export", () => {
  it("exports corporate theme (cornerRadius: 0) using rect geometry (no roundRect for cards)", async () => {
    const buffer = await buildPptx("Corporate Test Deck", testSlides, "corporate", false);
    assert.ok(buffer && buffer.length > 0, "Buffer should be generated");
    assert.equal(buffer[0], 0x50, "Magic byte P");
    assert.equal(buffer[1], 0x4b, "Magic byte K");

    const zip = await JSZip.loadAsync(buffer);
    const slide1Xml = await zip.file("ppt/slides/slide1.xml")?.async("string");
    const slide2Xml = await zip.file("ppt/slides/slide2.xml")?.async("string");

    assert.ok(slide1Xml, "Slide 1 XML exists");
    assert.ok(slide2Xml, "Slide 2 XML exists");

    // In corporate (cornerRadius: 0), cards and accents are rect
    assert.ok(slide1Xml.includes('prst="rect"'), "Slide 1 should contain rect geometry");
    assert.ok(slide2Xml.includes('prst="rect"'), "Slide 2 should contain rect geometry");

    // Must NOT contain roundRect cards
    assert.ok(!slide1Xml.includes('prst="roundRect"'), "Corporate slide 1 must not contain roundRect");
    assert.ok(!slide2Xml.includes('prst="roundRect"'), "Corporate slide 2 must not contain roundRect");
  });

  it("exports creative theme (cornerRadius: 3) using roundRect with adjusted radius", async () => {
    const buffer = await buildPptx("Creative Test Deck", testSlides, "creative", false);
    assert.ok(buffer && buffer.length > 0, "Buffer should be generated");

    const zip = await JSZip.loadAsync(buffer);
    const slide1Xml = await zip.file("ppt/slides/slide1.xml")?.async("string");
    const slide2Xml = await zip.file("ppt/slides/slide2.xml")?.async("string");

    assert.ok(slide1Xml, "Slide 1 XML exists");
    assert.ok(slide2Xml, "Slide 2 XML exists");

    // In creative (cornerRadius: 3 > 0), cards and accents are roundRect
    assert.ok(slide1Xml.includes('prst="roundRect"'), "Creative slide 1 should contain roundRect geometry");
    assert.ok(slide2Xml.includes('prst="roundRect"'), "Creative slide 2 should contain roundRect geometry");
    assert.ok(slide1Xml.includes('<a:gd name="adj"'), "Slide 1 should specify adj corner radius value");
  });

  it("exports modern theme (cornerRadius: 1) using roundRect with small adjusted radius", async () => {
    const buffer = await buildPptx("Modern Test Deck", testSlides, "modern", false);
    const zip = await JSZip.loadAsync(buffer);
    const slide1Xml = await zip.file("ppt/slides/slide1.xml")?.async("string");

    assert.ok(slide1Xml, "Slide 1 XML exists");
    assert.ok(slide1Xml.includes('prst="roundRect"'), "Modern slide 1 should contain roundRect geometry");
  });

  it("merges card background shapes and text into unified shapes in stats and two_column", async () => {
    const buffer = await buildPptx("Merged Cards Deck", testSlides, "modern", false);
    const zip = await JSZip.loadAsync(buffer);
    const slide1Xml = await zip.file("ppt/slides/slide1.xml")?.async("string");
    const slide2Xml = await zip.file("ppt/slides/slide2.xml")?.async("string");

    assert.ok(slide1Xml, "Slide 1 XML exists");
    assert.ok(slide2Xml, "Slide 2 XML exists");

    // Title (1) + 2 merged stat cards (2) = 3 shapes (previously 7 overlapping shapes)
    const slide1Shapes = slide1Xml.match(/<p:sp>/g) || [];
    assert.equal(slide1Shapes.length, 3, "Slide 1 should have 3 shapes total (1 title + 2 merged stat cards)");

    // Title (1) + 2 merged column cards (2) = 3 shapes (previously 7 overlapping shapes)
    const slide2Shapes = slide2Xml.match(/<p:sp>/g) || [];
    assert.equal(slide2Shapes.length, 3, "Slide 2 should have 3 shapes total (1 title + 2 merged column cards)");

    // Ensure content is intact within merged shapes
    assert.ok(slide1Xml.includes("99.9%"), "Slide 1 contains stat value");
    assert.ok(slide1Xml.includes("Uptime SLA"), "Slide 1 contains stat label");
    assert.ok(slide2Xml.includes("Engineering"), "Slide 2 contains left heading");
    assert.ok(slide2Xml.includes("Automated testing pipelines"), "Slide 2 contains left bullets");
    assert.ok(slide2Xml.includes("Security"), "Slide 2 contains right heading");
  });
});

