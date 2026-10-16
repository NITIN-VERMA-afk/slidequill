import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { resolveDeckImages } from "../src/app/api/decks/[id]/generate/route";
import type { SlideData } from "../src/lib/slides-schema";

async function main() {
  console.log("=== Testing Deck Photo Uniqueness & Deduplication ===");

  const slides: SlideData[] = [
    {
      id: "slide-1",
      layout: "title",
      title: "Renewable Energy Transition",
      notes: "Introduction to global renewable transition.",
      content: {
        subtitle: "Global clean grid transformation",
        imageQuery: "solar panels sunrise",
        imagePlacement: "background",
      },
    },
    {
      id: "slide-2",
      layout: "bullets",
      title: "Key Wind Capacity Additions",
      notes: "Overview of wind generation additions and offshore growth.",
      content: {
        bullets: [
          "Offshore capacity expanded by 34% YoY across North Sea installations.",
          "Next-generation turbine efficiency reached 62% capacity factor.",
        ],
        imageQuery: "wind turbine technician",
        imagePlacement: "right",
      },
    },
    {
      id: "slide-3",
      layout: "stats",
      title: "Global Investment Growth",
      notes: "Key economic investment milestones in clean technology.",
      content: {
        stats: [
          { value: "$1.8T", label: "Clean tech investment 2025" },
          { value: "48%", label: "Solar share of new power" },
        ],
      },
    },
    {
      id: "slide-4",
      layout: "image",
      title: "Substation Infrastructure",
      notes: "Distribution telemetry and substation enhancements.",
      content: {
        variant: "split",
        heading: "High Voltage Distribution",
        imageKeyword: "electric substation grid",
        imageQuery: "electric substation grid",
        caption: "Smart transformer telemetry monitoring.",
      },
    },
    {
      id: "slide-5",
      layout: "bullets",
      title: "Grid Battery Storage",
      notes: "Battery storage solutions and chemistry improvements.",
      content: {
        bullets: [
          "Lithium iron phosphate battery packs provide 4-hour grid firming.",
          "Thermal runaway suppression systems exceed safety baselines.",
        ],
        // Intentional identical query collision to test deduplication picking next candidate from the 10 results!
        imageQuery: "solar panels sunrise",
        imagePlacement: "right",
      },
    },
    {
      id: "slide-6",
      layout: "quote",
      title: "Clean Vision",
      notes: "Inspirational quote on energy progression.",
      content: {
        quote: "The stone age did not end for lack of stone, and the oil age will end long before the world runs out of oil.",
        attribution: "Sheikh Yamani",
        imageQuery: "modern clean hydroelectric dam",
        imagePlacement: "background",
      },
    },
    {
      id: "slide-7",
      layout: "closing",
      title: "Powering Tomorrow",
      notes: "Closing call to action for net zero commitment.",
      content: {
        headline: "Join the Net-Zero Mission",
        cta: "Explore Our Solutions",
        imageQuery: "green nature solar valley",
        imagePlacement: "background",
      },
    },
  ];

  console.log(`Resolving images for ${slides.length} slides (with deliberate query collision on slide 1 & 5)...`);
  const report = await resolveDeckImages(slides);

  console.log("\n--- RESOLVED SLIDE IMAGES BREAKDOWN ---");
  slides.forEach((slide, idx) => {
    const c = slide.content as any;
    if (c?.imageUrl) {
      console.log(
        `Slide ${idx + 1} [${slide.layout}]:\n  Query: "${c.imageQuery}"\n  Photo ID: ${c.photoId || "N/A"}\n  Photographer: ${c.photographer}\n  URL: ${c.imageUrl.substring(0, 75)}...\n`
      );
    } else {
      console.log(`Slide ${idx + 1} [${slide.layout}]: (No image - as expected for text/metric layouts)\n`);
    }
  });

  console.log("--- FINAL UNIQUENESS REPORT ---");
  console.log(`Total image slides: ${report.totalImages}`);
  console.log(`Unique photos:      ${report.uniqueImages}`);
  console.log(`Duplicate photos:   ${report.duplicateImages}`);
  console.log(`Uniqueness ratio:   ${(report.uniquenessRatio * 100).toFixed(1)}%`);

  if (report.duplicateImages === 0 && report.uniquenessRatio === 1.0) {
    console.log("\n SUCCESS: 100% Unique Photos. Zero duplicates detected across the presentation.");
  } else {
    console.error("\n FAILURE: Duplicate photos detected in deck!");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
