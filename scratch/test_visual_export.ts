import fs from "fs";
import path from "path";
import { buildPptx } from "../src/lib/export/pptx";
import type { SlideData } from "../src/lib/slides-schema";

async function main() {
  const slides: SlideData[] = [
    {
      id: "slide-1",
      layout: "title",
      title: "The Future of AI Architecture",
      sourcePage: 1,
      content: {
        subtitle: "Autonomous Agents & Scalable Systems",
        imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
        imagePlacement: "background",
        photographer: "Alex Knight",
      },
      notes: "Speaker notes for title slide.",
    },
    {
      id: "slide-2",
      layout: "bullets",
      title: "Key Architecture Pillars",
      sourcePage: 4,
      content: {
        imageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80",
        photographer: "NASA",
        bullets: [
          "Distributed memory pipelines handle multi-context compaction smoothly without latency spikes.",
          "Self-healing tool execution catches lint errors and syntax bugs proactively.",
          "Deterministic verification ensures PPTX export matches web preview layout exactly.",
          "Container-query based responsive viewports scale fonts dynamically across resolutions.",
          "This 5th bullet should be capped and omitted beside image in both preview and export.",
        ],
      },
      notes: "Key architecture pillars and runtime execution overview.",
    },
    {
      id: "slide-3",
      layout: "quote",
      title: "Design Philosophy",
      sourcePage: 7,
      content: {
        quote: "Simplicity is prerequisite for reliability. Complex visual engines must maintain strict parity across web DOM and exported presentations.",
        attribution: "Edsger W. Dijkstra",
        imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
        imagePlacement: "background",
        photographer: "Sean Oulashin",
      },
      notes: "Core engineering philosophy and design principles.",
    },
    {
      id: "slide-4",
      layout: "image",
      title: "Deep Dive Analysis",
      sourcePage: 12,
      content: {
        variant: "split",
        heading: "Next-Generation Inference Engine",
        imageKeyword: "ai inference server",
        imageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80",
        photographer: "Markus Spiske",
        bullets: [
          "Sub-100ms time-to-first-token throughput.",
          "Zero cold-start container orchestration.",
          "Native COM-driven presentation validation.",
        ],
        caption: "Figure 4.1: Architecture benchmark overview across global regions.",
      },
      notes: "Detailed performance telemetry on the inference engine.",
    },
    {
      id: "slide-5",
      layout: "closing",
      title: "Conclusion & Next Steps",
      sourcePage: 18,
      content: {
        headline: "Ready to Transform Presentations?",
        cta: "Deploy Today",
        imageUrl: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80",
        imagePlacement: "background",
        photographer: "Benjamin Davies",
      },
      notes: "Closing summary and call to action.",
    },
  ];

  const outDir = path.resolve("./exports/test_visual_bundle");
  fs.mkdirSync(outDir, { recursive: true });

  console.log("Generating PPTX buffer for modern theme...");
  const pptxBuf = await buildPptx("AI Architecture", slides, "modern", true);
  const pptxPath = path.join(outDir, "visual_bundle_test.pptx");
  fs.writeFileSync(pptxPath, pptxBuf);
  console.log(`Saved PPTX to ${pptxPath} (${pptxBuf.length} bytes)`);
}

main().catch(console.error);
