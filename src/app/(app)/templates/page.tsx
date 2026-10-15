"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  LayoutTemplate,
  Sparkles,
  ArrowRight,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { themes, type ThemeDef } from "@/lib/themes";
import SlideRenderer from "@/components/app/SlideRenderer";
import type { SlideData } from "@/lib/slides-schema";

// Comprehensive multi-slide decks for each theme showcasing varied layouts
const THEME_DECKS: Record<string, SlideData[]> = {
  modern: [
    {
      id: "modern-1",
      layout: "title",
      title: "Next-Gen Enterprise Cloud Infrastructure",
      notes: "Introduction to scalability and cloud architecture",
      content: {
        subtitle: "Scalability, Performance & Cloud Architecture Roadmap",
      },
    },
    {
      id: "modern-2",
      layout: "stats",
      title: "Core Performance & Reliability",
      notes: "Infrastructure performance metrics",
      content: {
        stats: [
          { value: "99.99%", label: "Availability SLA", icon: "Shield" },
          { value: "4.2x", label: "Throughput Increase", icon: "Zap" },
          { value: "140K+", label: "Active Nodes", icon: "Activity" },
        ],
      },
    },
    {
      id: "modern-3",
      layout: "bullets",
      title: "Modern Architecture Principles",
      notes: "Core engineering guidelines",
      content: {
        bullets: [
          "Zero-trust isolation across all distributed compute microservices",
          "Automated self-healing clusters with sub-second failover",
          "Distributed in-memory caching reducing cold-start latency by 74%",
        ],
        icons: ["Shield", "Zap", "Layers"],
      },
    },
    {
      id: "modern-4",
      layout: "two_column",
      title: "Global Compute & Storage Topology",
      notes: "Detailed breakdown of compute and storage layer",
      content: {
        left: {
          heading: "Compute Fabric",
          bullets: [
            "Over 40 regional edge pops with low jitter",
            "Dynamic autoscaling based on real-time traffic",
          ],
        },
        right: {
          heading: "Storage & Persistence",
          bullets: [
            "Active-active multi-region database replication",
            "Continuous automated encrypted backups with instant recovery",
          ],
        },
      },
    },
    {
      id: "modern-5",
      layout: "process",
      title: "Zero-Downtime Deployment Lifecycle",
      notes: "Staged deployment pipeline steps",
      content: {
        steps: [
          { label: "Build & Test", desc: "Automated regression testing", icon: "Cpu" },
          { label: "Canary Verify", desc: "1% traffic rollout verification", icon: "Search" },
          { label: "Global Deploy", desc: "Progressive multi-region release", icon: "Rocket" },
        ],
      },
    },
    {
      id: "modern-6",
      layout: "chart",
      title: "Latency Reductions by Region",
      notes: "Benchmarked latency improvements across four core markets",
      content: {
        chartType: "bar",
        categories: ["US-East", "EU-West", "APAC", "LATAM"],
        series: [
          { name: "Legacy (ms)", values: [120, 145, 190, 230] },
          { name: "Next-Gen (ms)", values: [24, 32, 45, 58] },
        ],
        caption: "Average round-trip latency measured under 80% peak load",
      },
    },
    {
      id: "modern-7",
      layout: "quote",
      title: "Enterprise Testimonial",
      notes: "Customer quote regarding platform reliability",
      content: {
        quote:
          "This architecture allowed us to scale from 1M to 50M daily requests with zero downtime and lower operating costs.",
        attribution: "Elena Rostova, VP Engineering at CloudWave",
      },
    },
    {
      id: "modern-8",
      layout: "closing",
      title: "Next Steps",
      notes: "Call to action for the roadmap rollout",
      content: {
        headline: "Ready to Modernize Your Stack?",
        cta: "Deploy Today",
      },
    },
  ],

  corporate: [
    {
      id: "corporate-1",
      layout: "title",
      title: "Executive Strategic & Fiscal Review",
      notes: "Annual corporate overview and governance review",
      content: {
        subtitle: "Governance, Enterprise Growth & Market Expansion",
      },
    },
    {
      id: "corporate-2",
      layout: "stats",
      title: "Financial Performance Highlights",
      notes: "Annual revenue and operating metrics",
      content: {
        stats: [
          { value: "$420M", label: "Annual Recurring Revenue", icon: "DollarSign" },
          { value: "+38%", label: "Year-over-Year Growth", icon: "TrendingUp" },
          { value: "114%", label: "Net Revenue Retention", icon: "Award" },
        ],
      },
    },
    {
      id: "corporate-3",
      layout: "two_column",
      title: "Operational Pillars & Governance",
      notes: "Strategic priorities alongside risk controls",
      content: {
        left: {
          heading: "Strategic Priorities",
          bullets: [
            "Accelerate digital transformation across enterprise units",
            "Optimize cross-functional capital allocation and efficiency",
          ],
        },
        right: {
          heading: "Risk Governance",
          bullets: [
            "Maintain strict SOC2 and ISO compliance controls",
            "Quarterly external security audits and board checkpoints",
          ],
        },
      },
    },
    {
      id: "corporate-4",
      layout: "bullets",
      title: "Key Market Drivers & Expansion",
      notes: "Primary business catalysts for next fiscal year",
      content: {
        bullets: [
          "Enterprise contract renewals up 22% with multi-year commitments",
          "Successful expansion into EMEA and APAC financial hubs",
          "Consolidation of technology stack yielding 18% cost reductions",
        ],
        icons: ["Briefcase", "Globe", "CheckCircle2"],
      },
    },
    {
      id: "corporate-5",
      layout: "chart",
      title: "Quarterly Revenue Trajectory ($M)",
      notes: "Consistent quarter-over-quarter expansion",
      content: {
        chartType: "bar",
        categories: ["Q1", "Q2", "Q3", "Q4"],
        series: [
          { name: "Target", values: [85, 95, 110, 130] },
          { name: "Actual", values: [92, 104, 118, 140] },
        ],
        caption: "Consolidated figures audited under GAAP compliance",
      },
    },
    {
      id: "corporate-6",
      layout: "quote",
      title: "CEO Executive Commentary",
      notes: "Strategic guidance from the CEO",
      content: {
        quote:
          "Operational discipline paired with disciplined capital allocation has solidified our leadership in enterprise solutions.",
        attribution: "Marcus Vance, Chief Executive Officer",
      },
    },
    {
      id: "corporate-7",
      layout: "closing",
      title: "Closing & Acknowledgements",
      notes: "Meeting closure and shareholder Q&A",
      content: {
        headline: "Delivering Sustainable Value",
        cta: "Access Investor Report",
      },
    },
  ],

  creative: [
    {
      id: "creative-1",
      layout: "title",
      title: "Creative Studio & Brand Portfolio",
      notes: "Introduction to studio brand identity",
      content: {
        subtitle: "Visual Identity, Spatial Aesthetics & Modular Systems",
      },
    },
    {
      id: "creative-2",
      layout: "bullets",
      title: "Design Philosophy & Systems",
      notes: "Our core artistic principles",
      content: {
        bullets: [
          "Bold typographic hierarchy with expressive warm palettes",
          "Modular components built for adaptive brand resonance",
          "Seamless translation across digital and physical spaces",
        ],
        icons: ["Layers", "Compass", "Lightbulb"],
      },
    },
    {
      id: "creative-3",
      layout: "stats",
      title: "Impact Across Audiences",
      notes: "Creative reach and audience recognition",
      content: {
        stats: [
          { value: "3.8M", label: "Brand Impressions", icon: "Users" },
          { value: "94%", label: "Brand Recall Rate", icon: "Star" },
          { value: "48", label: "Design Awards", icon: "Award" },
        ],
      },
    },
    {
      id: "creative-4",
      layout: "two_column",
      title: "Form & Function in Harmony",
      notes: "Balance between physical touchpoints and digital craft",
      content: {
        left: {
          heading: "Editorial Craft",
          bullets: [
            "Handcrafted print materials with bespoke finishes",
            "Carefully calibrated spatial typography standards",
          ],
        },
        right: {
          heading: "Digital Resonance",
          bullets: [
            "Motion design systems with responsive fluidity",
            "Accessibility built directly into color contrasts",
          ],
        },
      },
    },
    {
      id: "creative-5",
      layout: "process",
      title: "The Creative Direction Cadence",
      notes: "How we move from seed idea to completed release",
      content: {
        steps: [
          { label: "Concept", desc: "Immersion and visual moodboards", icon: "Lightbulb" },
          { label: "Prototype", desc: "Rapid tactile and motion experiments", icon: "Compass" },
          { label: "Exhibit", desc: "Flawless launch and documentation", icon: "Star" },
        ],
      },
    },
    {
      id: "creative-6",
      layout: "quote",
      title: "Design Manifesto",
      notes: "Inspirational quote from our creative director",
      content: {
        quote:
          "Design is not just what it looks like; it is how deeply it sparks connection in the human imagination.",
        attribution: "Maya Lin, Creative Director",
      },
    },
    {
      id: "creative-7",
      layout: "closing",
      title: "Collaboration & Inquiries",
      notes: "Closing slide inviting new brand collaborations",
      content: {
        headline: "Let's Create Something Unforgettable",
        cta: "Start a Project",
      },
    },
  ],

  dark: [
    {
      id: "dark-1",
      layout: "title",
      title: "Autonomous Intelligence at Hyperscale",
      notes: "Technical pitch for high-performance AI infra",
      content: {
        subtitle: "Next-Gen AI Operations & Real-Time Edge Inference",
      },
    },
    {
      id: "dark-2",
      layout: "stats",
      title: "Model Scalability & Latency",
      notes: "Inference benchmark performance",
      content: {
        stats: [
          { value: "< 8ms", label: "Edge Latency", icon: "Cpu" },
          { value: "10x", label: "Inference Speed", icon: "Rocket" },
          { value: "99.95%", label: "Pipeline Reliability", icon: "CheckCircle2" },
        ],
      },
    },
    {
      id: "dark-3",
      layout: "bullets",
      title: "Neural Engine Architecture",
      notes: "Key technical capabilities of the compute engine",
      content: {
        bullets: [
          "Distributed transformer inference across multi-cloud GPU pods",
          "Dynamic speculative decoding cutting token latencies in half",
          "Autonomous fault recovery with self-healing inference workers",
        ],
        icons: ["Cpu", "Zap", "Activity"],
      },
    },
    {
      id: "dark-4",
      layout: "two_column",
      title: "Training Cluster vs Edge Serving",
      notes: "Dual-tier architecture breakdown",
      content: {
        left: {
          heading: "Massive Training Cluster",
          bullets: [
            "Terabit InfiniBand mesh networking",
            "Zero-loss gradient checkpointing at scale",
          ],
        },
        right: {
          heading: "Distributed Edge Serving",
          bullets: [
            "Local KV-cache reuse with high hit rates",
            "Quantized FP8 precision without quality degradation",
          ],
        },
      },
    },
    {
      id: "dark-5",
      layout: "chart",
      title: "Throughput (Tokens / Sec / GPU)",
      notes: "Comparative performance against standard engines",
      content: {
        chartType: "bar",
        categories: ["Llama-3", "Mistral", "DeepSeek", "Custom"],
        series: [
          { name: "Standard", values: [42, 55, 38, 60] },
          { name: "Optimized", values: [210, 260, 195, 310] },
        ],
        caption: "Tested on 8x H100 clusters with batched concurrent streams",
      },
    },
    {
      id: "dark-6",
      layout: "quote",
      title: "Industry Perspective",
      notes: "Research scientist validation",
      content: {
        quote:
          "Autonomous edge inference represents the single biggest operational inflection point for modern software.",
        attribution: "Dr. Aris Thorne, AI Research Lead",
      },
    },
    {
      id: "dark-7",
      layout: "closing",
      title: "Platform Onboarding",
      notes: "Closing call to action for developers",
      content: {
        headline: "Deploy Intelligence to the Edge",
        cta: "Request Cluster Access",
      },
    },
  ],

  playful: [
    {
      id: "playful-1",
      layout: "title",
      title: "Product Launch: Delightful Workflows",
      notes: "New product reveal presentation",
      content: {
        subtitle: "Empowering Modern Teams with Intuitive Tools",
      },
    },
    {
      id: "playful-2",
      layout: "stats",
      title: "Community & Team Adoption",
      notes: "Adoption and customer sentiment stats",
      content: {
        stats: [
          { value: "500K+", label: "Active Creators", icon: "Users" },
          { value: "4.9/5", label: "App Store Rating", icon: "Star" },
          { value: "82%", label: "Daily Engagement", icon: "Heart" },
        ],
      },
    },
    {
      id: "playful-3",
      layout: "process",
      title: "Continuous Delivery Trajectory",
      notes: "Agile iteration loop for happy teams",
      content: {
        steps: [
          { label: "Discover", desc: "User research & rapid wireframing", icon: "Search" },
          { label: "Prototype", desc: "Iterative testing with instant feedback", icon: "Lightbulb" },
          { label: "Deploy", desc: "Reliable zero-downtime releases", icon: "Rocket" },
        ],
      },
    },
    {
      id: "playful-4",
      layout: "bullets",
      title: "Why Teams Fall in Love",
      notes: "Core delightful features",
      content: {
        bullets: [
          "Zero steep learning curve: open and start shipping immediately",
          "Micro-animations and fluid gesture controls that make work feel joyful",
          "Collaborative live multiplayer with zero syncing hiccups",
        ],
        icons: ["Heart", "Star", "Users"],
      },
    },
    {
      id: "playful-5",
      layout: "two_column",
      title: "Designed for Modern Creators",
      notes: "Dual benefits for creators and leaders",
      content: {
        left: {
          heading: "For Builders",
          bullets: [
            "Frictionless shortcuts and keyboard power actions",
            "Instant previewing in real browser viewports",
          ],
        },
        right: {
          heading: "For Managers",
          bullets: [
            "Crystal-clear project velocity tracking",
            "Automated summaries and painless team check-ins",
          ],
        },
      },
    },
    {
      id: "playful-6",
      layout: "quote",
      title: "User Love",
      notes: "Testimonial from a startup founder",
      content: {
        quote:
          "Our team shipped twice as fast while having twice as much fun doing it. It simply sparks joy every single day.",
        attribution: "Chloe Chen, Founder at Popcorn Studio",
      },
    },
    {
      id: "playful-7",
      layout: "closing",
      title: "Get Started",
      notes: "Final invitation to test the app",
      content: {
        headline: "Ready to Fall in Love with Work Again?",
        cta: "Try Free for 14 Days",
      },
    },
  ],

  elegant: [
    {
      id: "elegant-1",
      layout: "title",
      title: "Sustainable Luxury & Global Heritage",
      notes: "Editorial overview of heritage brand craft",
      content: {
        subtitle: "Preserving Craftsmanship in Modern Commerce",
      },
    },
    {
      id: "elegant-2",
      layout: "two_column",
      title: "Editorial Design & Craft",
      notes: "Balancing heritage standards with modern sustainability",
      content: {
        left: {
          heading: "Heritage & Craft",
          bullets: [
            "Classic serif typography rooted in editorial tradition",
            "Balanced negative space ensuring reading clarity",
          ],
        },
        right: {
          heading: "Modern Standards",
          bullets: [
            "Harmonious palettes reflecting organic textures",
            "Uncompromising attention to proportion and layout",
          ],
        },
      },
    },
    {
      id: "elegant-3",
      layout: "stats",
      title: "Pillars of Sustainable Heritage",
      notes: "Traceability and environmental metrics",
      content: {
        stats: [
          { value: "100%", label: "Traceable Materials", icon: "Shield" },
          { value: "120+", label: "Years of Craft", icon: "Clock" },
          { value: "42", label: "Artisan Ateliers", icon: "Award" },
        ],
      },
    },
    {
      id: "elegant-4",
      layout: "bullets",
      title: "The Tenets of Conscious Elegance",
      notes: "Artisanal commitments and philosophy",
      content: {
        bullets: [
          "Uncompromising respect for artisanal heritage and natural textiles",
          "Restrained, timeless aesthetics that transcend seasonal fast trends",
          "Regenerative agriculture integrated across our supply ecosystem",
        ],
        icons: ["Award", "Shield", "Globe"],
      },
    },
    {
      id: "elegant-5",
      layout: "process",
      title: "The Artisanal Journey",
      notes: "From raw natural harvest to finished atelier piece",
      content: {
        steps: [
          { label: "Sourcing", desc: "Regenerative organic fibers", icon: "Globe" },
          { label: "Handcraft", desc: "Bespoke master craftsmanship", icon: "Award" },
          { label: "Exhibition", desc: "Gallery and boutique presentation", icon: "Star" },
        ],
      },
    },
    {
      id: "elegant-6",
      layout: "quote",
      title: "Artisan Philosophy",
      notes: "Master artisan quote on timeless luxury",
      content: {
        quote:
          "True luxury is patient; it honors the dedicated artisan of yesterday while preserving the earth for tomorrow.",
        attribution: "Julian de Montfort, Master Artisan",
      },
    },
    {
      id: "elegant-7",
      layout: "closing",
      title: "The Invitation",
      notes: "Private gallery viewing invitation",
      content: {
        headline: "A Timeless Legacy Reimagined",
        cta: "Explore the Collection",
      },
    },
  ],
};

function formatLayoutLabel(layout: string): string {
  switch (layout) {
    case "title":
      return "Title";
    case "stats":
      return "Stats";
    case "bullets":
      return "Bullets";
    case "two_column":
      return "2-Column";
    case "process":
      return "Process";
    case "chart":
      return "Chart";
    case "quote":
      return "Quote";
    case "closing":
      return "Closing";
    default:
      return layout;
  }
}

// Full interactive modal lightbox
function TemplatePreviewModal({
  themeId,
  initialSlideIdx = 0,
  onClose,
  onSelectTheme,
}: {
  themeId: string;
  initialSlideIdx?: number;
  onClose: () => void;
  onSelectTheme: (newThemeId: string) => void;
}) {
  const [activeSlideIdx, setActiveSlideIdx] = useState(initialSlideIdx);
  const theme = themes[themeId] || themes.modern;
  const deck = THEME_DECKS[theme.id] || THEME_DECKS.modern;
  const currentSlide = deck[activeSlideIdx] || deck[0];

  const handlePrev = useCallback(() => {
    setActiveSlideIdx((prev) => (prev > 0 ? prev - 1 : deck.length - 1));
  }, [deck.length]);

  const handleNext = useCallback(() => {
    setActiveSlideIdx((prev) => (prev < deck.length - 1 ? prev + 1 : 0));
  }, [deck.length]);

  // Keyboard navigation: Escape to close, Left/Right arrows to flip slides
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrev, handleNext, onClose]);

  // Prevent background body scrolling while modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-6xl max-h-[95vh] overflow-hidden rounded-3xl bg-[#0f1422] text-white shadow-2xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/10 bg-[#141b2d]">
          {/* Theme Title & Meta */}
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full ring-2 ring-white/20"
              style={{ backgroundColor: theme.colors.accent }}
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white [font-family:var(--font-display)]">
                  {theme.name}
                </h3>
                <span className="hidden sm:inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/80">
                  {deck.length} Sample Slides
                </span>
              </div>
              <p className="text-xs text-white/60 line-clamp-1">{theme.description}</p>
            </div>
          </div>

          {/* Theme Switcher Tabs / Dropdown */}
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center bg-black/40 rounded-xl p-1 border border-white/10">
              {Object.values(themes).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTheme(t.id)}
                  className={clsx(
                    "px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5",
                    t.id === theme.id
                      ? "bg-[#2F5BFF] text-white shadow-md"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: t.colors.accent }}
                  />
                  {t.name.split(" ")[0]}
                </button>
              ))}
            </div>

            {/* Mobile / Compact Theme Select */}
            <select
              value={theme.id}
              onChange={(e) => onSelectTheme(e.target.value)}
              className="lg:hidden text-xs font-medium rounded-xl bg-white/10 border border-white/20 px-3 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]"
            >
              {Object.values(themes).map((t) => (
                <option key={t.id} value={t.id} className="bg-[#141b2d] text-white">
                  {t.name}
                </option>
              ))}
            </select>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Slide Stage with Left / Right Navigation */}
        <div className="relative flex-1 flex items-center justify-center p-3 sm:p-6 bg-[#0b0e17] overflow-hidden">
          {/* Prev Button */}
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-2 sm:left-4 z-20 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md border border-white/10 shadow-xl transition hover:bg-[#2F5BFF] hover:scale-110 active:scale-95"
            aria-label="Previous slide"
          >
            <ChevronLeft size={24} />
          </button>

          {/* Main Slide Renderer Stage */}
          <div className="relative w-full max-w-4xl aspect-[16/9] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/15 bg-black">
            <SlideRenderer
              key={`${theme.id}-${activeSlideIdx}`}
              slide={currentSlide}
              theme={theme.id}
              className="w-full h-full"
            />
          </div>

          {/* Next Button */}
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-2 sm:right-4 z-20 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md border border-white/10 shadow-xl transition hover:bg-[#2F5BFF] hover:scale-110 active:scale-95"
            aria-label="Next slide"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Slide Tracker Badge */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-[#141b2d] border-t border-white/10 text-xs text-white/70">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">
              Slide {activeSlideIdx + 1} of {deck.length}
            </span>
            <span>•</span>
            <span className="text-[#2F5BFF] font-medium bg-[#2F5BFF]/15 px-2 py-0.5 rounded">
              {formatLayoutLabel(currentSlide.layout)} Layout
            </span>
            <span className="hidden sm:inline text-white/50 truncate max-w-md">
              — {currentSlide.title}
            </span>
          </div>

          <div className="text-[11px] text-white/50 hidden md:block">
            Use <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-white/80">←</kbd>{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-white/80">→</kbd> to
            navigate • <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-white/80">Esc</kbd> to close
          </div>
        </div>

        {/* Thumbnail Strip */}
        <div className="flex items-center gap-2.5 p-3 sm:px-5 bg-[#0e1320] overflow-x-auto border-t border-white/5 scrollbar-thin">
          {deck.map((slide, idx) => {
            const isSelected = idx === activeSlideIdx;
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => setActiveSlideIdx(idx)}
                className={clsx(
                  "group relative shrink-0 w-24 sm:w-28 aspect-[16/9] rounded-lg overflow-hidden border transition-all text-left",
                  isSelected
                    ? "ring-2 ring-[#2F5BFF] border-transparent scale-105 shadow-lg shadow-[#2F5BFF]/30"
                    : "border-white/15 opacity-60 hover:opacity-100 hover:border-white/40"
                )}
              >
                <div className="w-full h-full pointer-events-none scale-100">
                  <SlideRenderer slide={slide} theme={theme.id} className="w-full h-full" />
                </div>
                <div
                  className={clsx(
                    "absolute bottom-0 inset-x-0 px-1 py-0.5 text-[9px] font-bold text-center truncate",
                    isSelected ? "bg-[#2F5BFF] text-white" : "bg-black/70 text-white/90"
                  )}
                >
                  {idx + 1}. {formatLayoutLabel(slide.layout)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-[#141b2d] border-t border-white/10">
          {/* Swatches preview */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60 font-medium">Palette:</span>
            <div className="flex gap-1.5">
              {[
                theme.colors.bg,
                theme.colors.accent,
                theme.colors.surface,
                theme.colors.text,
              ].map((c, i) => (
                <span
                  key={i}
                  className="h-4 w-4 rounded-full border border-white/20 shadow-xs"
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
            <span className="text-xs text-white/40 font-mono ml-2 hidden sm:inline">
              Heading: {theme.headingFont.name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 transition"
            >
              Close
            </button>
            <Link
              href={`/decks/new?theme=${theme.id}`}
              className="flex items-center gap-2 rounded-xl bg-[#2F5BFF] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-[#2F5BFF]/30 transition hover:bg-[#1d44c8] hover:shadow-xl"
            >
              Use this Template <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateCard({
  theme,
  onOpenPreview,
}: {
  theme: ThemeDef;
  onOpenPreview: (themeId: string, slideIdx?: number) => void;
}) {
  const [activeSlide, setActiveSlide] = useState<"title" | "content">("title");
  const deck = THEME_DECKS[theme.id] || THEME_DECKS.modern;
  const titleSlide = deck[0];
  const contentSlide = deck[1] || deck[0];
  const currentSlide = activeSlide === "title" ? titleSlide : contentSlide;

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-[#101A3A]/10 bg-white shadow-sm transition hover:shadow-xl hover:-translate-y-1 hover:border-[#2F5BFF]/30">
      {/* Slide Preview Header Tabs */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#F4F6FB] border-b border-[#101A3A]/5 text-xs">
        <span className="font-bold text-[#5a6384] text-[11px] uppercase tracking-wider">
          {activeSlide === "title" ? "Title Slide" : "Content Slide"}
        </span>
        <div className="flex rounded-lg bg-white p-0.5 border border-[#101A3A]/10 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveSlide("title")}
            className={clsx(
              "px-2.5 py-0.5 rounded text-[11px] font-semibold transition",
              activeSlide === "title"
                ? "bg-[#2F5BFF] text-white shadow-xs"
                : "text-[#5a6384] hover:text-[#101A3A]"
            )}
          >
            Title
          </button>
          <button
            type="button"
            onClick={() => setActiveSlide("content")}
            className={clsx(
              "px-2.5 py-0.5 rounded text-[11px] font-semibold transition",
              activeSlide === "content"
                ? "bg-[#2F5BFF] text-white shadow-xs"
                : "text-[#5a6384] hover:text-[#101A3A]"
            )}
          >
            Content
          </button>
        </div>
      </div>

      {/* Real SlideRenderer preview with full-modal trigger hover overlay */}
      <div
        onClick={() => onOpenPreview(theme.id, activeSlide === "title" ? 0 : 1)}
        className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100 cursor-pointer group/preview"
      >
        <SlideRenderer
          slide={currentSlide}
          theme={theme.id}
          className="pointer-events-none w-full h-full"
        />

        {/* Hover overlay hint */}
        <div className="absolute inset-0 bg-[#101A3A]/60 opacity-0 group-hover/preview:opacity-100 backdrop-blur-xs transition-opacity flex flex-col items-center justify-center text-white gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 shadow-md">
            <Eye size={20} className="text-white" />
          </div>
          <span className="text-xs font-semibold tracking-wide">
            Preview all {deck.length} slides
          </span>
        </div>
      </div>

      {/* Template Info & Action */}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-bold text-[#101A3A] [font-family:var(--font-display)]">
            {theme.name}
          </h3>
          <span className="text-[11px] font-medium text-[#5a6384] bg-[#F4F6FB] px-2 py-0.5 rounded-full border border-[#101A3A]/5">
            {deck.length} slides
          </span>
        </div>

        <p className="mt-1 text-sm text-[#5a6384] flex-1 line-clamp-2">
          {theme.description}
        </p>

        <div className="mt-4 flex items-center justify-between pt-4 border-t border-[#101A3A]/5">
          {/* Color swatches */}
          <div className="flex gap-1.5" title="Palette swatches">
            {[theme.colors.bg, theme.colors.accent, theme.colors.surface, theme.colors.text].map(
              (c, i) => (
                <span
                  key={i}
                  className="h-4 w-4 rounded-full border border-black/10"
                  style={{ background: c }}
                />
              )
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onOpenPreview(theme.id)}
              className="flex items-center gap-1 text-xs font-semibold text-[#5a6384] hover:text-[#101A3A] transition"
            >
              <Eye size={14} /> Preview
            </button>

            <Link
              href={`/decks/new?theme=${theme.id}`}
              className="flex items-center gap-1 text-xs font-bold text-[#2F5BFF] hover:text-[#1d44c8] transition-colors"
            >
              Use <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const themeList = Object.values(themes);
  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null);
  const [initialSlideIdx, setInitialSlideIdx] = useState(0);

  const handleOpenPreview = (themeId: string, slideIdx = 0) => {
    setPreviewThemeId(themeId);
    setInitialSlideIdx(slideIdx);
  };

  const handleClosePreview = () => {
    setPreviewThemeId(null);
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h2 className="text-3xl font-extrabold text-[#101A3A] [font-family:var(--font-display)] flex items-center gap-3">
          <LayoutTemplate size={28} className="text-[#2F5BFF]" />
          Templates
        </h2>
        <p className="mt-2 max-w-2xl text-[#5a6384] leading-relaxed">
          Choose from 6 professionally designed presentation templates. Click any card to preview the full slide deck (Titles, Stats, Bullets, 2-Column, Process, Charts, and Quotes), or jump straight into creation.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {themeList.map((theme) => (
          <TemplateCard
            key={theme.id}
            theme={theme}
            onOpenPreview={handleOpenPreview}
          />
        ))}

        {/* Request Custom Template Card */}
        <div className="group flex flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#101A3A]/15 bg-[#F4F6FB]/50 p-8 text-center transition hover:border-[#2F5BFF]/40 hover:bg-[#2F5BFF]/5">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-[#101A3A]/5">
            <Sparkles size={24} className="text-[#2F5BFF]" />
          </div>
          <h3 className="text-lg font-bold text-[#101A3A] [font-family:var(--font-display)]">
            Need a custom template?
          </h3>
          <p className="mt-2 text-sm text-[#5a6384] max-w-[200px]">
            Have a specific brand guide? We can build a custom layout for your team.
          </p>
          <Link
            href="/contact"
            className="mt-6 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#101A3A] shadow-sm ring-1 ring-[#101A3A]/10 transition hover:bg-slate-50 hover:ring-[#101A3A]/20"
          >
            Contact us
          </Link>
        </div>
      </div>

      {/* Full Multi-Slide Preview Modal */}
      {previewThemeId && (
        <TemplatePreviewModal
          themeId={previewThemeId}
          initialSlideIdx={initialSlideIdx}
          onClose={handleClosePreview}
          onSelectTheme={(newThemeId) => setPreviewThemeId(newThemeId)}
        />
      )}
    </div>
  );
}

