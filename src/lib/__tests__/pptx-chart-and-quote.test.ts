import { describe, it } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { buildPptx } from "../export/pptx";
import type { SlideData } from "../slides-schema";

describe("PPTX Native Chart & Quote Slide Parity", () => {
  it("I5: quote slide with undefined imagePlacement defaults to full-bleed background slide in PPTX", async () => {
    const quoteSlides: SlideData[] = [
      {
        id: "quote-1",
        layout: "quote",
        title: "Inspirational Philosophy",
        notes: "Executive quote",
        content: {
          quote: "Simplicity is the prerequisite for reliability.",
          attribution: "Edsger W. Dijkstra",
          imageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M9QzwAEjAwMDAwAFAkC74V9558AAAAASUVORK5CYII=",
          // imagePlacement is explicitly undefined!
          imagePlacement: undefined,
          photographer: "Photo Artist",
        },
      },
    ];

    const buffer = await buildPptx("Quote Test Deck", quoteSlides, "modern", false);
    assert.ok(buffer && buffer.length > 0, "Buffer should be generated");

    const zip = await JSZip.loadAsync(buffer);
    const slide1Xml = await zip.file("ppt/slides/slide1.xml")?.async("string");
    assert.ok(slide1Xml, "Slide 1 XML must exist");

    // Must render the full-bleed background dark rect (#0a0f1d) and quote text in white
    assert.ok(slide1Xml.toLowerCase().includes("0a0f1d"), "Slide must contain dark background fill 0a0f1d matching full-bleed preview");
    assert.ok(slide1Xml.includes("Simplicity is the prerequisite"), "Slide must contain quote text");
    assert.ok(slide1Xml.includes("Edsger W. Dijkstra"), "Slide must contain attribution");
  });

  it("I6: exports PPTX with native chart, unzips, and asserts ppt/charts/chart1.xml and embedded workbook exist", async () => {
    const chartSlides: SlideData[] = [
      {
        id: "chart-1",
        layout: "chart",
        title: "Quarterly Revenue Breakdown",
        notes: "Financial breakdown notes.",
        content: {
          chartType: "bar",
          categories: ["2021", "2022", "2023", "2024"],
          series: [
            { name: "Subscription", values: [120, 180, 260, 390] },
            { name: "Services", values: [40, 60, 85, 110] },
          ],
          caption: "Amounts in millions USD",
        },
      },
    ];

    const buffer = await buildPptx("Native Chart Test Deck", chartSlides, "modern", false);
    assert.ok(buffer && buffer.length > 0, "Buffer should be generated");
    assert.equal(buffer[0], 0x50, "PK zip header byte 0");
    assert.equal(buffer[1], 0x4b, "PK zip header byte 1");

    const zip = await JSZip.loadAsync(buffer);

    // 1. Assert ppt/charts/chart1.xml exists and contains OpenXML chart definitions
    const chart1Xml = await zip.file("ppt/charts/chart1.xml")?.async("string");
    assert.ok(chart1Xml, "ppt/charts/chart1.xml must exist in exported PPTX");
    assert.ok(
      chart1Xml.includes("chartSpace") || chart1Xml.includes("plotArea") || chart1Xml.includes("barChart"),
      "chart1.xml must contain native OpenXML chart elements"
    );

    // 2. Assert embedded Excel spreadsheet exists in ppt/embeddings/
    const allFileNames = Object.keys(zip.files);
    const embeddedFiles = allFileNames.filter((name) => name.startsWith("ppt/embeddings/"));

    assert.ok(
      embeddedFiles.length > 0,
      `PPTX must contain at least one embedded workbook in ppt/embeddings/, found: ${allFileNames.join(", ")}`
    );

    const hasExcelExtension = embeddedFiles.some(
      (f) => f.endsWith(".xlsx") || f.endsWith(".bin")
    );
    assert.ok(
      hasExcelExtension,
      `Embedded workbook must have .xlsx or .bin extension, found: ${embeddedFiles.join(", ")}`
    );
  });
});
