import Link from "next/link";
 
const steps = [
  { t: "Drop in your source", d: "Upload a PDF or DOCX, or paste text. Slidequill reads it and drafts an outline." },
  { t: "Fix the outline", d: "Reorder, rename or delete sections before any slides are written." },
  { t: "Download the deck", d: "Get an editable .pptx with your template applied. Open it in PowerPoint or Keynote." },
];
 
const features = [
  ["Real .pptx files", "Text stays editable. No locked images, no web-only viewer."],
  ["Regenerate one slide", "Not happy with slide 6? Redo just that one, shorter or in a different tone."],
  ["Documents in, decks out", "Built for turning reports, notes and chapters into slides."],
  ["Pay per deck", "Credits never expire. No monthly plan to forget about."],
];
 
const plans = [
  { name: "Free", price: "₹0", note: "3 decks to try it", items: ["PDF, DOCX or text input", ".pptx export", "Slidequill watermark"], cta: "Start free", hl: false },
  { name: "Credits", price: "₹199", note: "20 decks, never expire", items: ["Everything in Free", "No watermark", "All templates", "Regenerate any slide"], cta: "Buy credits", hl: true },
];
 
const faqs = [
  ["Can I edit the slides after export?", "Yes. Every slide is native PowerPoint text and shapes."],
  ["What can I upload?", "PDF, DOCX and plain text. YouTube and web links are planned."],
  ["What does a deck cost?", "One credit per deck. A failed generation refunds the credit."],
];
 
const bar = "shadow-[0_10px_30px_-12px_rgba(16,26,58,.35)]";
 
export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-12 md:grid-cols-2 md:pt-20">
        <div>
          <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight [font-family:var(--font-display)] md:text-6xl">
            Turn any document into a presentation.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-[#3a4468]">
            Upload a PDF or Word file. Get an editable PowerPoint deck in about a minute.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/signup" className="rounded-full bg-[#2F5BFF] px-6 py-3 font-semibold text-white hover:bg-[#2449d6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#101A3A]">
              Make your first deck free
            </Link>
            <span className="text-sm text-[#5a6384]">3 free decks. No card needed.</span>
          </div>
        </div>
 
        <div aria-hidden className="relative mx-auto flex w-full max-w-md items-center gap-4">
          <div className={`w-1/2 rotate-[-3deg] rounded-md bg-white p-4 ${bar}`}>
            <div className="mb-3 h-2.5 w-2/3 rounded bg-[#101A3A]" />
            {[100, 92, 96, 60].map((w, i) => (
              <div key={i} className={`mb-1.5 h-1.5 rounded ${i === 1 || i === 2 ? "bg-[#2F5BFF]/40" : "bg-[#101A3A]/15"}`} style={{ width: `${w}%` }} />
            ))}
            <div className="mb-3 mt-4 h-2.5 w-1/2 rounded bg-[#101A3A]" />
            {[98, 90, 70].map((w, i) => (
              <div key={i} className="mb-1.5 h-1.5 rounded bg-[#101A3A]/15" style={{ width: `${w}%` }} />
            ))}
          </div>
          <svg viewBox="0 0 40 24" className="h-6 w-10 shrink-0 text-[#2F5BFF]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h34M28 4l8 8-8 8" /></svg>
          <div className="flex w-1/2 flex-col gap-3">
            {["Key findings", "Next steps"].map((t, i) => (
              <div key={t} className={`aspect-video rounded-md p-3 ${bar} ${i === 0 ? "bg-[#101A3A] text-white" : "bg-white"}`}>
                <div className="text-[10px] font-bold [font-family:var(--font-display)]">{t}</div>
                <div className={`mt-2 h-1 w-4/5 rounded ${i === 0 ? "bg-white/40" : "bg-[#101A3A]/20"}`} />
                <div className={`mt-1.5 h-1 w-3/5 rounded ${i === 0 ? "bg-white/40" : "bg-[#101A3A]/20"}`} />
              </div>
            ))}
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
 
      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)]">Made for people who start from a document</h2>
        <dl className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
          {features.map(([t, d]) => (
            <div key={t}>
              <dt className="text-lg font-bold [font-family:var(--font-display)]">{t}</dt>
              <dd className="mt-1 leading-relaxed text-[#3a4468]">{d}</dd>
            </div>
          ))}
        </dl>
      </section>
 
      {/* Pricing */}
      <section id="pricing" className="bg-white py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)]">Simple pricing</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {plans.map((p) => (
              <div key={p.name} className={`rounded-2xl p-8 ${p.hl ? "bg-[#101A3A] text-white" : "border border-[#101A3A]/15"}`}>
                <h3 className="text-lg font-bold [font-family:var(--font-display)]">{p.name}</h3>
                <div className="mt-3 text-4xl font-extrabold [font-family:var(--font-display)]">{p.price}</div>
                <div className={`mt-1 text-sm ${p.hl ? "text-white/70" : "text-[#5a6384]"}`}>{p.note}</div>
                <ul className="mt-6 space-y-2 text-sm">
                  {p.items.map((it) => <li key={it}>{it}</li>)}
                </ul>
                <Link href="/signup" className={`mt-8 inline-block rounded-full px-5 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5BFF] ${p.hl ? "bg-[#2F5BFF] text-white hover:bg-[#4a70ff]" : "bg-[#101A3A] text-white hover:bg-[#1d2c5e]"}`}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
 
      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)]">Questions</h2>
        <div className="mt-8 divide-y divide-[#101A3A]/15 border-y border-[#101A3A]/15">
          {faqs.map(([q, a]) => (
            <details key={q} className="py-4">
              <summary className="cursor-pointer list-none font-semibold marker:content-none">{q}</summary>
              <p className="mt-2 leading-relaxed text-[#3a4468]">{a}</p>
            </details>
          ))}
        </div>
      </section>
 
      {/* Final CTA */}
      <section className="bg-[#101A3A] py-16 text-center text-white">
        <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)]">Your next deck is one upload away.</h2>
        <Link href="/signup" className="mt-6 inline-block rounded-full bg-[#2F5BFF] px-6 py-3 font-semibold hover:bg-[#4a70ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          Make your first deck free
        </Link>
      </section>
    </main>
  );
}