import Link from "next/link";
import { Download, FileText, Sparkles, CheckCircle2 } from "lucide-react";
import SlideRenderer from "@/components/app/SlideRenderer";

const steps = [
  { t: "Upload your source", d: "Upload a PDF or DOCX. SlideQuill reads it and drafts an outline." },
  { t: "Fix the outline", d: "Reorder, rename or delete sections before your slides are written." },
  { t: "Download the deck", d: "Get an editable .pptx formatted with one of our 6 professionally designed templates. Open it in PowerPoint or Keynote." },
];

const features = [
  ["PDF & DOCX → PPTX", "Turn reports, notes and documents into editable PowerPoint files."],
  ["Start from your content", "SlideQuill works from the material you already have."],
  ["Regenerate individual slides", "Don't regenerate the entire deck when one slide needs work."],
  ["Pay only when you need it", "Credits never expire. No monthly subscription."],
];

const plans = [
  {
    name: "Free",
    price: "₹0",
    note: "3 decks to try",
    items: ["PDF, DOCX or text input", ".pptx export", "6 professional templates", "Slidequill watermark"],
    cta: "Start free",
    ctaHref: "/signup",
    hl: false,
  },
  {
    name: "20 Credits",
    price: "₹199",
    note: "20 decks, never expire",
    items: ["Credits never expire", "Everything in Free", "No watermark", "All 6 professional templates", "Regenerate any slide"],
    cta: "Buy 20 credits — ₹199",
    ctaHref: "/signup",
    hl: true,
  },
  {
    name: "50 Credits",
    price: "₹399",
    note: "50 decks, best value",
    items: ["Best value pricing", "Everything in 20 Credits", "Priority support", "No watermark", "All 6 professional templates"],
    cta: "Buy 50 credits — ₹399",
    ctaHref: "/signup",
    hl: false,
  }
];

const faqs = [
  ["Can I edit the slides after export?", "Yes. Every slide is native PowerPoint text and shapes — fully editable in PowerPoint or Keynote."],
  ["What templates are available?", "SlideQuill includes 6 professionally designed templates (Modern Minimal, Corporate Executive, Creative Studio, Midnight Pitch, Startup Playful, and Elegant Report) with curated typography and color schemes."],
  ["What can I upload?", "PDF, DOCX and plain text. YouTube and web links are planned."],
  ["How many credits does one deck use?", "One credit per deck. A failed generation refunds the credit automatically."],
  ["Can I regenerate individual slides?", "Yes. If one slide isn't right, you can regenerate just that slide without redoing the whole deck."],
  ["Do credits expire?", "No. Credits never expire — use them whenever you need them."],
  ["Do you store my uploaded documents?", "Uploaded documents and source text are automatically permanently deleted after 30 days. You can also delete your source text immediately from the deck editor at any time. We never use your content to train models."],
];


const bar = "shadow-[0_10px_30px_-12px_rgba(16,26,58,.35)]";

// Real SlideRenderer slides for Before & After showcase
const beforeAfterSlide = {
  id: "hero-sample",
  layout: "chart" as const,
  title: "Annual Revenue Acceleration Exceeded 190% YoY",
  notes: "Executive quarterly summary demonstrating ARR expansion.",
  sourceSection: "Quarterly Financial Analysis",
  sourcePage: 12,
  content: {
    chartType: "bar" as const,
    categories: ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026"],
    series: [{ name: "ARR ($M)", values: [1.2, 1.8, 2.6, 3.5] }],
    caption: "ARR accelerated consistently across four consecutive fiscal quarters.",
  },
};

// Gallery sample decks available for instant download
const sampleDecks = [
  {
    title: "Executive Strategic Showcase",
    description: "Multi-column layouts, quotes, process flows, and stats cards.",
    theme: "modern",
    slidesCount: 7,
    fileSize: "108 KB",
    downloadUrl: "/samples/executive_showcase.pptx",
    previewSlide: {
      id: "preview-1",
      layout: "stats" as const,
      title: "Key Performance Metrics & Scale",
      notes: "Company scale indicators.",
      content: {
        stats: [
          { value: "99.98%", label: "Uptime SLA", icon: "Shield" },
          { value: "4.2x", label: "ARR Growth", icon: "TrendingUp" },
          { value: "140K+", label: "Daily Active Users", icon: "Users" },
        ],
      },
    },
  },
  {
    title: "Quarterly Financial Analytics",
    description: "Native PowerPoint bar, line, and pie charts with editable numbers.",
    theme: "corporate",
    slidesCount: 4,
    fileSize: "138 KB",
    downloadUrl: "/samples/financial_charts.pptx",
    previewSlide: {
      id: "preview-2",
      layout: "chart" as const,
      title: "Platform Revenue Breakdown by Segment",
      notes: "Segment analysis.",
      content: {
        chartType: "pie" as const,
        categories: ["Enterprise", "Cloud Workspace", "Pro Subscriptions", "Integrations"],
        series: [{ name: "Revenue Share", values: [45, 30, 18, 7] }],
        caption: "Enterprise now drives nearly half of total contracted ARR.",
      },
    },
  },
  {
    title: "Global Brand & Spatial Design",
    description: "Full-bleed and split photography layouts with stock imagery.",
    theme: "elegant",
    slidesCount: 3,
    fileSize: "398 KB",
    downloadUrl: "/samples/brand_visuals.pptx",
    previewSlide: {
      id: "preview-3",
      layout: "image" as const,
      title: "Modern Minimalist Work Environments",
      notes: "Design showcase.",
      content: {
        variant: "split" as const,
        imageKeyword: "modern architecture office",
        imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
        caption: "San Francisco Flagship Studio",
        bullets: [
          "Designed for asynchronous collaborative work",
          "Acoustic isolation zones paired with innovation hubs",
        ],
      },
    },
  },
  {
    title: "Minimal Executive Pitch",
    description: "Crisp three-slide investor executive summary and closing call to action.",
    theme: "playful",
    slidesCount: 3,
    fileSize: "61 KB",
    downloadUrl: "/samples/minimal_pitch.pptx",
    previewSlide: {
      id: "preview-4",
      layout: "process" as const,
      title: "Three Step Enterprise Deployment Path",
      notes: "Onboarding trajectory.",
      content: {
        steps: [
          { label: "Audit", desc: "Security and compliance validation", icon: "Search" },
          { label: "Connect", desc: "SSO and directory integration", icon: "Cpu" },
          { label: "Scale", desc: "Rollout across global teams", icon: "Rocket" },
        ],
      },
    },
  },
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-12 md:grid-cols-2 md:pt-20">
        <div>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight [font-family:var(--font-display)] sm:text-5xl md:text-6xl">
            Turn your documents into editable PowerPoint decks.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-[#3a4468]">
            Upload a PDF or Word file. SlideQuill turns it into a structured presentation you can download and edit in PowerPoint.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/signup"
              className="rounded-full bg-[#2F5BFF] px-6 py-3 font-semibold text-white hover:bg-[#2449d6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#101A3A]"
            >
              Create my first deck — free
            </Link>
          </div>
          <p className="mt-3 text-sm text-[#5a6384]">3 free decks · No card required</p>
        </div>

        {/* Hero visual: Document → SlideQuill → Deck */}
        <div aria-hidden className="mx-auto flex w-full max-w-md items-center gap-3">
          {/* Source document */}
          <div className={`w-[38%] shrink-0 rounded-lg bg-white p-4 ${bar}`}>
            <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-[#5a6384]">report.pdf</div>
            <div className="mb-2 h-2 w-4/5 rounded bg-[#101A3A]/80" />
            {[100, 90, 95, 70, 85, 60, 75].map((w, i) => (
              <div key={i} className="mb-1 h-1 rounded bg-[#101A3A]/12" style={{ width: `${w}%` }} />
            ))}
            <div className="mb-2 mt-3 h-2 w-3/5 rounded bg-[#101A3A]/50" />
            {[95, 80, 65].map((w, i) => (
              <div key={i} className="mb-1 h-1 rounded bg-[#101A3A]/12" style={{ width: `${w}%` }} />
            ))}
          </div>

          {/* Arrow + label */}
          <div className="flex shrink-0 flex-col items-center gap-1">
            <span className="text-[9px] font-semibold text-[#2F5BFF]">SlideQuill</span>
            <svg viewBox="0 0 40 16" className="h-4 w-8 text-[#2F5BFF]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 8h34M28 2l8 6-8 6" />
            </svg>
          </div>

          {/* Output slides stack */}
          <div className="flex flex-1 flex-col gap-2">
            <div className={`rounded-md bg-[#101A3A] p-3 ${bar}`}>
              <div className="text-[9px] font-bold text-white/60 uppercase tracking-wide">Title</div>
              <div className="mt-1.5 h-2 w-4/5 rounded bg-white/70" />
              <div className="mt-1 h-1.5 w-3/5 rounded bg-white/30" />
            </div>
            <div className={`rounded-md bg-white p-3 ${bar}`}>
              <div className="text-[9px] font-bold text-[#2F5BFF] uppercase tracking-wide">Slide 2</div>
              <div className="mt-1.5 h-2 w-3/4 rounded bg-[#101A3A]/70" />
              <div className="mt-1 h-1 w-full rounded bg-[#101A3A]/15" />
              <div className="mt-1 h-1 w-4/5 rounded bg-[#101A3A]/15" />
            </div>
            <div className={`rounded-md bg-[#F4F6FB] p-3 ${bar}`}>
              <div className="text-[9px] font-bold text-[#101A3A]/50 uppercase tracking-wide">Slide 3</div>
              <div className="mt-1.5 h-2 w-2/3 rounded bg-[#101A3A]/50" />
              <div className="mt-1 h-1 w-full rounded bg-[#101A3A]/12" />
              <div className="mt-1 h-1 w-3/4 rounded bg-[#101A3A]/12" />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)]">From file to deck in three steps</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.t} className="border-t-2 border-[#101A3A] pt-4">
                <div className="text-sm font-semibold text-[#2F5BFF]">Step {i + 1}</div>
                <h3 className="mt-1 text-xl font-bold [font-family:var(--font-display)]">{s.t}</h3>
                <p className="mt-2 leading-relaxed text-[#3a4468]">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Interactive Before & After Showcase */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#2F5BFF] bg-[#2F5BFF]/10 px-3 py-1 rounded-full">
              Real Transformation
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight [font-family:var(--font-display)] mt-3">
              Document In → Native PPTX Out
            </h2>
            <p className="mt-2 text-[#3a4468] max-w-xl">
              See how SlideQuill ingests unstructured document pages and turns them into high-fidelity, presentation-ready slides.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#5a6384]">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /> Live SVG Preview
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white p-6 sm:p-8 rounded-3xl border border-[#101A3A]/10 shadow-sm">
          {/* Before: Raw Document Page */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-semibold text-[#5a6384]">
              <span className="flex items-center gap-1.5"><FileText size={14} className="text-red-500" /> Quarterly_Report.pdf (Page 12)</span>
              <span>Raw Text</span>
            </div>
            <div className="bg-[#F4F6FB] p-5 rounded-2xl border border-[#101A3A]/10 font-mono text-xs leading-relaxed text-[#101A3A]/80 flex flex-col gap-2.5 h-[280px] overflow-hidden select-none">
              <div className="font-bold text-[#101A3A]">3.2 Financial & ARR Trajectory</div>
              <p>
                During fiscal year 2026, annualized run-rate revenue experienced notable acceleration across our core enterprise customer segment. Specifically:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[#3a4468]">
                <li>Q1 2026 reached $1.2M in recognized ARR with 14 new logos.</li>
                <li>Q2 expanded to $1.8M, representing a 50% QoQ growth rate.</li>
                <li>Q3 closed at $2.6M driven by cloud contract expansions.</li>
                <li>Q4 ended at $3.5M (+191% aggregate annual expansion).</li>
              </ul>
              <p className="text-[11px] text-[#5a6384] italic mt-1">
                Management concludes that expansion velocity was sustained across all quarters...
              </p>
            </div>
          </div>

          {/* Transformation Indicator */}
          <div className="lg:col-span-1 flex lg:flex-col items-center justify-center text-[#2F5BFF]">
            <div className="w-10 h-10 rounded-full bg-[#2F5BFF]/10 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
          </div>

          {/* After: SlideRenderer Generated Output */}
          <div className="lg:col-span-6 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-semibold text-[#5a6384]">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> SlideQuill Generated Slide</span>
              <span className="text-[#2F5BFF] font-bold">Native Chart</span>
            </div>
            <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-xl ring-1 ring-black/10">
              <SlideRenderer slide={beforeAfterSlide as any} theme="corporate" />
            </div>
          </div>
        </div>
      </section>

      {/* Sample Gallery & Direct PPTX Downloads */}
      <section className="bg-white py-20 border-t border-[#101A3A]/10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#2F5BFF] bg-[#2F5BFF]/10 px-3 py-1 rounded-full">
                Sample Showcase
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight [font-family:var(--font-display)] mt-3">
                Explore Real Exported Presentations
              </h2>
              <p className="mt-2 text-[#3a4468] max-w-xl">
                Download and inspect authentic <strong>.pptx</strong> decks generated by SlideQuill. Completely native text, vector shapes, and editable charts.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {sampleDecks.map((deck) => (
              <div
                key={deck.title}
                className="rounded-3xl border border-[#101A3A]/10 p-6 bg-[#F4F6FB]/50 hover:bg-white transition-all shadow-sm hover:shadow-md flex flex-col justify-between group"
              >
                <div>
                  {/* Thumbnail */}
                  <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-sm ring-1 ring-black/5 mb-5">
                    <SlideRenderer slide={deck.previewSlide as any} theme={deck.theme} className="pointer-events-none" />
                  </div>

                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold uppercase tracking-wider text-[#2F5BFF] bg-[#2F5BFF]/10 px-2 py-0.5 rounded">
                      Template: {deck.theme}
                    </span>
                    <span className="text-[#5a6384] font-medium">{deck.slidesCount} slides · {deck.fileSize}</span>
                  </div>

                  <h3 className="text-lg font-bold text-[#101A3A] mb-1">{deck.title}</h3>
                  <p className="text-xs text-[#5a6384] leading-relaxed mb-6">{deck.description}</p>
                </div>

                <a
                  href={deck.downloadUrl}
                  download
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-white hover:bg-[#101A3A] text-[#101A3A] hover:text-white border border-[#101A3A]/15 hover:border-transparent rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <Download size={14} /> Download Sample .pptx
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)]">Built for document-to-deck workflows</h2>
          <dl className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
            {features.map(([t, d]) => (
              <div key={t}>
                <dt className="text-lg font-bold [font-family:var(--font-display)]">{t}</dt>
                <dd className="mt-1 leading-relaxed text-[#3a4468]">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative mx-auto max-w-6xl px-6 py-32 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-3xl pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#2F5BFF]/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#9b51e0]/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight [font-family:var(--font-display)] mb-4">Simple, transparent pricing</h2>
          <p className="text-lg text-[#5a6384] max-w-xl mx-auto">Start for free, then pay only for what you need. No monthly subscriptions, no hidden fees.</p>
        </div>

        <div className="relative grid gap-8 md:grid-cols-3 max-w-6xl mx-auto items-stretch md:items-center">
          {plans.map((p) => (
            <div 
              key={p.name} 
              className={`relative group rounded-3xl p-8 lg:p-12 transition-all duration-500 hover:-translate-y-2 flex flex-col ${
                p.hl 
                  ? "bg-[#101A3A] text-white shadow-2xl shadow-[#2F5BFF]/20 border border-[#101A3A]" 
                  : "bg-white/60 backdrop-blur-xl border border-white shadow-xl hover:shadow-2xl hover:bg-white"
              }`}
            >
              {p.hl && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-[#2F5BFF] to-[#9b51e0] text-white text-[11px] font-bold uppercase tracking-wider py-1.5 px-4 rounded-full shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}

              <h3 className="text-xl font-bold [font-family:var(--font-display)] mb-2">{p.name}</h3>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-extrabold [font-family:var(--font-display)]">{p.price}</span>
              </div>
              <p className={`text-sm mb-8 ${p.hl ? "text-white/70" : "text-[#5a6384]"}`}>{p.note}</p>
              
              <ul className="space-y-4 mb-10 flex-1">
                {p.items.map((it) => (
                  <li key={it} className="flex items-start gap-3 text-sm font-medium">
                    <svg className={`w-5 h-5 shrink-0 ${p.hl ? "text-[#2F5BFF]" : "text-[#2F5BFF]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className={p.hl ? "text-white/90" : "text-[#101A3A]/80"}>{it}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={p.ctaHref}
                className={`block w-full text-center rounded-xl px-6 py-4 text-sm font-bold transition-all duration-300 ${
                  p.hl 
                    ? "bg-[#2F5BFF] text-white shadow-lg shadow-[#2F5BFF]/30 hover:bg-[#2548cc] hover:shadow-[#2F5BFF]/50" 
                    : "bg-[#F4F6FB] text-[#101A3A] hover:bg-[#e4e8f5]"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-white py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)]">Questions</h2>
          <div className="mt-8 divide-y divide-[#101A3A]/15 border-y border-[#101A3A]/15">
            {faqs.map(([q, a]) => (
              <details key={q} className="py-4">
                <summary className="cursor-pointer list-none font-semibold marker:content-none">{q}</summary>
                <p className="mt-2 leading-relaxed text-[#3a4468]">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-[#101A3A] py-16 text-center text-white">
        <h2 className="px-6 text-3xl font-extrabold tracking-tight [font-family:var(--font-display)]">Your next deck is one upload away.</h2>
        <Link
          href="/signup"
          className="mt-6 inline-block rounded-full bg-[#2F5BFF] px-6 py-3 font-semibold hover:bg-[#4a70ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Create my first deck — free
        </Link>
        <p className="mt-3 text-sm text-white/60">3 free decks · No card required</p>
      </section>
    </main>
  );
}
