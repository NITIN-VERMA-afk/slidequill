/**
 * scripts/test-export.ts
 *
 * Generates PPTX files for 10 challenging fixture decks to validate export fidelity,
 * native PowerPoint shapes, auto-fitting, continuation slides, and zero overflow.
 */

import fs from "node:fs";
import path from "node:path";
import { buildPptx } from "../src/lib/export/pptx";
import type { SlideData } from "../src/lib/slides-schema";

const EXPORT_DIR = process.env.EXPORT_DIR || path.resolve(process.cwd(), "exports");
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

interface FixtureDeck {
  name: string;
  title: string;
  theme: string;
  slides: SlideData[];
}

const fixtures: FixtureDeck[] = [
  // 1. Short minimal deck
  {
    name: "01_minimal_pitch",
    title: "Executive Overview",
    theme: "modern",
    slides: [
      {
        id: "s1",
        layout: "title",
        title: "Executive Overview 2026",
        notes: "Welcome everyone to today's executive summary.",
        content: { subtitle: "Strategic Highlights & Objectives" },
      },
      {
        id: "s2",
        layout: "bullets",
        title: "Core Strategic Priorities",
        notes: "These are the three foundational pillars.",
        content: {
          bullets: [
            "Accelerate platform customer onboarding velocity",
            "Expand partner ecosystem into EMEA region",
            "Optimize infrastructure operational unit economics",
          ],
        },
      },
      {
        id: "s3",
        layout: "closing",
        title: "Thank You",
        notes: "Open the floor for questions.",
        content: {
          headline: "Building Tomorrow Together",
          cta: "Contact Enterprise Sales",
        },
      },
    ],
  },

  // 2. Text-heavy bullets with maximum words and characters
  {
    name: "02_text_heavy_bullets",
    title: "Deep Dive Architecture",
    theme: "corporate",
    slides: [
      {
        id: "s1",
        layout: "title",
        title: "Microservices Architecture Breakdown",
        notes: "Technical deep dive.",
        content: { subtitle: "System Decoupling and Resiliency Engineering" },
      },
      {
        id: "s2",
        layout: "bullets",
        title: "Critical Infrastructure Constraints",
        notes: "Discuss latency limits and distributed transaction isolation.",
        content: {
          bullets: [
            "Synchronous REST communication patterns induce high cascading latency across services",
            "Distributed saga orchestration must maintain strict eventual consistency boundaries",
            "Database connection pools require elastic autoscaling policies under peak load",
            "Zero-trust credential token propagation across boundary ingress API gateways",
            "Global multi-region replication requires automated failover and telemetry probes",
            "Asynchronous message delivery dead-letter queues need automated alert routing",
          ],
        },
      },
    ],
  },

  // 3. Max title lengths (wrapping to 3 lines)
  {
    name: "03_max_titles",
    title: "Extended Titles Test",
    theme: "creative",
    slides: [
      {
        id: "s1",
        layout: "title",
        title: "Comprehensive Strategic Analysis of Global Enterprise Distribution Logistics Networks",
        notes: "Long title test on cover.",
        content: { subtitle: "Quarterly Operational Review and Future Guidance" },
      },
      {
        id: "s2",
        layout: "bullets",
        title: "Multi-Region Inventory Optimization Reduced Overhead Expenses By Twenty Four Percent",
        notes: "Testing 8-word 65-char max title auto-fit in header.",
        content: {
          bullets: [
            "Automated demand forecasting across sixty fulfillment locations",
            "Consolidated freight carrier contracts for volume tier discounts",
            "Dynamic warehouse re-routing during severe regional disruptions",
          ],
        },
      },
    ],
  },

  // 4. Stats-heavy with long values and labels
  {
    name: "04_stats_heavy",
    title: "Financial Performance Metrics",
    theme: "modern",
    slides: [
      {
        id: "s1",
        layout: "stats",
        title: "Outstanding Fiscal Performance",
        notes: "Highlight our ARR growth and net retention.",
        content: {
          stats: [
            { value: "$12,500,000", label: "Annual Recurring Revenue" },
            { value: "+148.5%", label: "Year Over Year Net Expansion" },
            { value: "99.995%", label: "Platform SLA Uptime Delivery" },
            { value: "1,250,000+", label: "Active Verified Platform Users" },
          ],
        },
      },
    ],
  },

  // 5. 5-Step Process with full descriptions
  {
    name: "05_process_5step",
    title: "Deployment Workflow Lifecycle",
    theme: "dark",
    slides: [
      {
        id: "s1",
        layout: "process",
        title: "Continuous Release Pipeline",
        notes: "Walk through each deployment phase.",
        content: {
          steps: [
            { label: "Source Code", desc: "Push commit to protected staging repository" },
            { label: "Automated Build", desc: "Execute hermetic container compilation" },
            { label: "Security Scan", desc: "Run static analysis vulnerability scanning" },
            { label: "Canary Deploy", desc: "Route five percent user traffic to cluster" },
            { label: "Full Rollout", desc: "Promote verified release build globally" },
          ],
        },
      },
    ],
  },

  // 6. Two-Column max density
  {
    name: "06_twocolumn_max",
    title: "On-Premises vs Cloud Comparison",
    theme: "elegant",
    slides: [
      {
        id: "s1",
        layout: "two_column",
        title: "Deployment Model Tradeoffs",
        notes: "Compare infrastructure agility against control requirements.",
        content: {
          left: {
            heading: "Legacy On-Premises",
            bullets: [
              "Capital expenditure upfront for servers",
              "Manual hardware maintenance cycles",
              "Strict sovereign air-gapped isolation",
              "Limited elastic capacity headroom",
            ],
          },
          right: {
            heading: "Modern Hybrid Cloud",
            bullets: [
              "Operational expenditure based on usage",
              "Automated managed backup snapshots",
              "Rapid global regional expansion",
              "Dynamic container autoscaling pools",
            ],
          },
        },
      },
    ],
  },

  // 7. Quote-heavy with 30 words
  {
    name: "07_quote_heavy",
    title: "Customer Testimonial Spotlight",
    theme: "creative",
    slides: [
      {
        id: "s1",
        layout: "quote",
        title: "Executive Endorsement",
        notes: "Quote from Fortune 500 CTO.",
        content: {
          quote:
            "Slidequill completely transformed how our enterprise consulting division prepares client presentations, slashing turnaround time by seventy percent while producing native PowerPoint decks our partners can immediately customize and present.",
          attribution: "Sarah Jenkins, VP of Consulting, Apex Global",
        },
      },
    ],
  },

  // 8. Comparison 3-column
  {
    name: "08_comparison_3col",
    title: "Service Tier Breakdown",
    theme: "playful",
    slides: [
      {
        id: "s1",
        layout: "comparison",
        title: "Choose The Right Solution Tier",
        notes: "Compare features across starter, professional, and enterprise tiers.",
        content: {
          columns: [
            {
              heading: "Starter",
              bullets: ["Up to 5 decks monthly", "Standard export quality", "Community email support"],
            },
            {
              heading: "Professional",
              bullets: ["Unlimited presentations", "Custom brand color palettes", "Priority ticket support"],
            },
            {
              heading: "Enterprise",
              bullets: ["Dedicated account manager", "Custom PPTX corporate templates", "Single sign-on SAML"],
            },
          ],
        },
      },
    ],
  },

  // 9. Title styles (split, left, center)
  {
    name: "09_title_styles_test",
    title: "Design Styles Showcase",
    theme: "creative", // split title style
    slides: [
      {
        id: "s1",
        layout: "title",
        title: "Creative Studio Split Header",
        notes: "Split cover layout.",
        content: { subtitle: "Modern Dual-Container Visual Arrangement" },
      },
      {
        id: "s2",
        layout: "closing",
        title: "Next Steps",
        notes: "Closing slide.",
        content: { headline: "Start Transforming Presentations Today", cta: "Schedule Live Demo" },
      },
    ],
  },

  // 10. Comprehensive Multi-layout presentation
  {
    name: "10_full_deck_showcase",
    title: "Slidequill Product Overview",
    theme: "modern",
    slides: [
      {
        id: "s1",
        layout: "title",
        title: "Slidequill Product Vision",
        notes: "Introduction to Slidequill.",
        content: { subtitle: "Document in, Native Editable PPTX Out" },
      },
      {
        id: "s2",
        layout: "bullets",
        title: "Why AI Presentation Tools Stumble",
        notes: "Key market pain points.",
        content: {
          bullets: [
            "Exported files are locked images instead of native editable shapes",
            "Generated text overflows boundaries and looks amateurish",
            "Generic templates do not reflect company brand guidelines",
          ],
        },
      },
      {
        id: "s3",
        layout: "stats",
        title: "Demonstrated Productivity Impact",
        notes: "Real metrics from early user cohorts.",
        content: {
          stats: [
            { value: "3.5 hrs", label: "Saved per presentation deck" },
            { value: "100%", label: "Native editable shapes & text" },
            { value: "85%", label: "Users export and return" },
          ],
        },
      },
      {
        id: "s4",
        layout: "process",
        title: "How Slidequill Generates Decks",
        notes: "The document-to-deck pipeline.",
        content: {
          steps: [
            { label: "Document Input", desc: "Upload PDF or DOCX file" },
            { label: "Outline Synthesized", desc: "AI builds structured sections" },
            { label: "Content Fitted", desc: "Zod limits eliminate overflows" },
            { label: "Native Export", desc: "Download editable PowerPoint file" },
          ],
        },
      },
      {
        id: "s5",
        layout: "two_column",
        title: "Export Quality Comparison",
        notes: "Slidequill vs traditional AI deck generators.",
        content: {
          left: {
            heading: "Traditional AI Tools",
            bullets: [
              "Flattened bitmap image slides",
              "Fonts cannot be edited or tuned",
              "Brittle layout dimensions",
            ],
          },
          right: {
            heading: "Slidequill Platform",
            bullets: [
              "Real vector shapes & editable text",
              "System-safe normalized typography",
              "Native PowerPoint auto-fit scaling",
            ],
          },
        },
      },
      {
        id: "s6",
        layout: "quote",
        title: "Customer Endorsement",
        notes: "Praise from early customer.",
        content: {
          quote:
            "Slidequill is the first tool that creates decks my executive board actually accepts without needing hours of reformatting.",
          attribution: "Elena Rostova, Managing Director",
        },
      },
      {
        id: "s7",
        layout: "closing",
        title: "Get Started",
        notes: "Call to action.",
        content: {
          headline: "Create Your First Presentation Now",
          cta: "Try Slidequill Free",
        },
      },
    ],
  },

  // 11. Native Editable Charts (Bar, Line, Pie)
  {
    name: "11_native_charts",
    title: "Quarterly Performance & Growth Metrics",
    theme: "modern",
    slides: [
      {
        id: "s1",
        layout: "title",
        title: "Financial Analytics & Operational KPIs",
        notes: "Quarterly metric review with native editable charts.",
        content: { subtitle: "Q4 2026 Executive Summary" },
      },
      {
        id: "s2",
        layout: "chart",
        title: "ARR Growth from Q1 to Q4",
        notes: "Bar chart demonstrating Q-o-Q ARR expansion.",
        content: {
          chartType: "bar",
          categories: ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026"],
          series: [{ name: "ARR ($M)", values: [1.2, 1.8, 2.6, 3.5] }],
          caption: "ARR accelerated consistently across four consecutive fiscal quarters.",
        },
      },
      {
        id: "s3",
        layout: "chart",
        title: "Customer Retention & Net Dollar Expansion",
        notes: "Line chart tracking NRR trend over six quarters.",
        content: {
          chartType: "line",
          categories: ["Jan", "Mar", "Jun", "Sep", "Dec"],
          series: [{ name: "NRR (%)", values: [104, 108, 114, 121, 128] }],
          caption: "Net Revenue Retention steadily increased to 128%.",
        },
      },
      {
        id: "s4",
        layout: "chart",
        title: "Platform Revenue Breakdown by Product",
        notes: "Pie chart displaying revenue share distribution.",
        content: {
          chartType: "pie",
          categories: ["Enterprise API", "Cloud Workspace", "Pro Subscriptions", "Integrations"],
          series: [{ name: "Revenue Share (%)", values: [45, 30, 18, 7] }],
          caption: "Enterprise contracts now account for nearly half of revenue.",
        },
      },
    ],
  },

  // 12. Visual Image Layouts (Split & Full Bleed)
  {
    name: "12_image_layouts",
    title: "Global Brand & Vision Showcase",
    theme: "elegant",
    slides: [
      {
        id: "s1",
        layout: "title",
        title: "Designing the Next Generation Workspace",
        notes: "Product showcase with high resolution photography.",
        content: { subtitle: "Spatial Design and Collaborative Environments" },
      },
      {
        id: "s2",
        layout: "image",
        title: "Modern Minimalist Work Environments",
        notes: "Split layout with curated stock photography.",
        content: {
          variant: "split",
          imageKeyword: "modern office architecture",
          imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
          caption: "San Francisco Flagship Studio",
          photographer: "Unsplash",
          bullets: [
            "Designed for deep collaborative and asynchronous workflows",
            "Acoustic isolation zones paired with open innovation hubs",
            "Energy efficient circadian lighting systems installed throughout",
          ],
        },
      },
      {
        id: "s3",
        layout: "image",
        title: "Architectural Vision for 2030",
        notes: "Full bleed dramatic hero image with text overlay.",
        content: {
          variant: "full_bleed",
          imageKeyword: "skyscrapers modern tower",
          imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
          caption: "Global headquarters tower",
          bullets: [
            "Net zero carbon emissions footprint across global campuses",
            "Sustainable biophilic design integrated into every floor",
          ],
        },
      },
    ],
  },
];

async function run() {
  console.log(`Starting export test for ${fixtures.length} fixture decks...`);
  console.log(`Output directory: ${EXPORT_DIR}\n`);

  let successCount = 0;
  for (const fixture of fixtures) {
    try {
      const start = Date.now();
      const buffer = await buildPptx(fixture.title, fixture.slides, fixture.theme, false, `${fixture.name}.pdf`);
      const filePath = path.join(EXPORT_DIR, `${fixture.name}.pptx`);
      fs.writeFileSync(filePath, buffer);
      const sizeKb = Math.round(buffer.length / 1024);
      const durationMs = Date.now() - start;
      console.log(`[PASS] ${fixture.name}.pptx (${sizeKb} KB, ${durationMs}ms)`);
      successCount++;
    } catch (err) {
      console.error(`[FAIL] ${fixture.name}:`, err);
    }
  }

  console.log(`\nCompleted: ${successCount}/${fixtures.length} decks successfully generated.`);
}

run().catch((err) => {
  console.error("Test export runner failed:", err);
  process.exit(1);
});
