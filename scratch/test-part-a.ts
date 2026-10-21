import fs from "fs";
import jszip from "jszip";
import { buildPptx } from "../src/lib/export/pptx";
import type { SlideData } from "../src/lib/slides-schema";

async function main() {
  const slides: SlideData[] = [
    {
      id: "slide-1",
      layout: "bullets",
      title: "Revenue Acceleration Range Test",
      notes: "Speaker talking points for slide 1.",
      sourceSection: "Financial Performance",
      sourcePage: "18-20",
      content: {
        bullets: ["Revenue grew across Q1-Q3", "Margins expanded to 28%"],
      },
    },
    {
      id: "slide-2",
      layout: "stats",
      title: "Key Single Page Metric",
      notes: "Speaker talking points for slide 2.",
      sourceSection: "Balance Sheet",
      sourcePage: 18,
      content: {
        stats: [
          { value: "$20.4M", label: "Annual Run Rate" },
          { value: "48,000", label: "Active Customers" },
        ],
      },
    },
  ];

  const buffer = await buildPptx(
    "Source Citation Verification Deck",
    slides,
    "minimal",
    false,
    "Uploaded_Report.pdf"
  );

  const zip = await jszip.loadAsync(buffer);
  const noteFiles = Object.keys(zip.files).filter((k) =>
    k.startsWith("ppt/notesSlides/notesSlide")
  );

  console.log("Found notes slide files:", noteFiles);

  for (const file of noteFiles.sort()) {
    const xml = await zip.files[file].async("string");
    console.log(`\n=== XML for ${file} ===`);
    console.log(xml);
    const textMatches = [...xml.matchAll(/<a:t>([^<]+)<\/a:t>/g)].map((m) => m[1]);
    console.log(`Extracted text lines for ${file}:`, textMatches);
  }
}

main().catch(console.error);
