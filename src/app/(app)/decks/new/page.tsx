"use client";

import { Suspense, useCallback, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import {
  Upload,
  FileText,
  AlertCircle,
  Loader2,
  Sparkles,
  Layers,
  CheckCircle2,
  Image as ImageIcon,
  ArrowRight,
  Sliders,
} from "lucide-react";
import { themes, defaultThemeId } from "@/lib/themes";
import { Skeleton } from "@/components/ui/skeleton";

type Tab = "file" | "text";

const ACCEPTED = ".pdf,.docx";
const MAX_MB = 10;

function NewDeckForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTheme = searchParams.get("theme") ?? defaultThemeId;
  const [tab, setTab] = useState<Tab>("file");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedTheme, setSelectedTheme] = useState(initialTheme);
  const [includeImages, setIncludeImages] = useState(true);
  const [slideCount, setSlideCount] = useState<number>(10);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<
    "idle" | "uploading" | "redirecting"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── File selection helpers ─────────────────────────────────────────────────

  const pickFile = (f: File | null | undefined) => {
    setError(null);
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File is too large. Maximum size is ${MAX_MB} MB.`);
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    pickFile(e.target.files?.[0]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files?.[0]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (tab === "file" && !file) {
      setError("Please select a file.");
      return;
    }
    if (tab === "text" && !text.trim()) {
      setError("Please paste some text.");
      return;
    }

    setProgress("uploading");

    try {
      let res: Response;

      if (tab === "file" && file) {
        const form = new FormData();
        form.append("file", file);
        if (title.trim()) form.append("title", title.trim());
        form.append("theme", selectedTheme);
        form.append("includeImages", String(includeImages));
        form.append("targetSlideCount", String(slideCount));
        res = await fetch("/api/decks", { method: "POST", body: form });
      } else {
        res = await fetch("/api/decks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim() || undefined,
            text,
            theme: selectedTheme,
            includeImages,
            targetSlideCount: slideCount,
          }),
        });
      }

      if (res.status === 401) {
        const refreshRes = await fetch("/api/auth/refresh", { method: "POST" }).catch(() => null);
        if (refreshRes && refreshRes.ok) {
          if (tab === "file" && file) {
            const form = new FormData();
            form.append("file", file);
            if (title.trim()) form.append("title", title.trim());
            form.append("theme", selectedTheme);
            form.append("includeImages", String(includeImages));
            form.append("targetSlideCount", String(slideCount));
            res = await fetch("/api/decks", { method: "POST", body: form });
          } else {
            res = await fetch("/api/decks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: title.trim() || undefined,
                text,
                theme: selectedTheme,
                includeImages,
                targetSlideCount: slideCount,
              }),
            });
          }
        } else {
          router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
      }

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setProgress("idle");
        return;
      }

      // Kick off outline generation (fire-and-forget; page polls)
      fetch(`/api/decks/${data.id}/outline`, { method: "POST" }).catch(() => {});

      setProgress("redirecting");
      router.push(`/decks/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
      setProgress("idle");
    }
  };

  const busy = progress !== "idle";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="relative w-full min-h-full flex flex-col items-center justify-center py-2 sm:py-3 lg:py-4">
      {/* ── Dynamic Ambient Color & Animation Background Layer (Extra Grand Scale) ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
        {/* Soft geometric technical blueprint grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#2f5bff14_1px,transparent_1px),linear-gradient(to_bottom,#2f5bff14_1px,transparent_1px)] bg-[size:38px_38px] [mask-image:radial-gradient(ellipse_90%_80%_at_50%_40%,#000_65%,transparent_100%)]" />

        {/* Ambient dot matrix */}
        <div className="absolute inset-0 bg-[radial-gradient(#2F5BFF_1.4px,transparent_1.4px)] [background-size:26px_26px] opacity-25 [mask-image:radial-gradient(ellipse_80%_70%_at_50%_45%,#000_40%,transparent_90%)]" />

        {/* Glowing floating color orb 1: Electric Blue / Indigo (Top Left) */}
        <div className="absolute -top-24 -left-24 h-[750px] w-[750px] rounded-full bg-gradient-to-tr from-blue-600/35 via-indigo-500/30 to-sky-400/25 blur-[115px] animate-blob" />

        {/* Glowing floating color orb 2: Luminous Purple / Violet (Top Right) */}
        <div className="absolute top-0 -right-24 h-[700px] w-[700px] rounded-full bg-gradient-to-bl from-purple-600/35 via-fuchsia-500/25 to-pink-500/20 blur-[115px] animate-blob-delayed" />

        {/* Glowing floating color orb 3: Vibrant Cyan / Azure (Bottom Left) */}
        <div className="absolute -bottom-28 left-1/4 h-[650px] w-[650px] rounded-full bg-gradient-to-r from-cyan-400/30 via-blue-500/25 to-indigo-600/20 blur-[105px] animate-blob-slow" />

        {/* Glowing pulsing accent 4: Soft Rose / Coral glow (Center) */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[480px] w-[480px] rounded-full bg-gradient-to-r from-pink-500/20 via-rose-400/15 to-amber-300/15 blur-[95px] animate-pulse-glow" />
      </div>

      {/* ── Main Frosted Glassmorphism Studio Card (Scaled Up For Big Displays) ── */}
      <div className="relative z-10 w-full max-w-7xl 2xl:max-w-[1440px] rounded-3xl border border-white/85 bg-white/85 p-6 sm:p-8 lg:p-9 xl:p-10 shadow-[0_20px_60px_-15px_rgba(16,26,58,0.08),0_1px_3px_rgba(16,26,58,0.04)] backdrop-blur-xl">
        {/* Iridescent Accent Line */}
        <div className="absolute top-0 left-6 right-6 sm:left-12 sm:right-12 h-[4px] rounded-full bg-gradient-to-r from-[#2F5BFF] via-[#8B5CF6] to-[#06B6D4] opacity-90 animate-gradient-shift" />

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 mb-5 border-b border-[#101A3A]/8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2F5BFF]/15 to-[#8B5CF6]/15 text-[#2F5BFF] shadow-xs">
              <Sparkles size={26} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-extrabold tracking-tight text-[#101A3A] [font-family:var(--font-display)]">
                  Create a New Deck
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#2F5BFF]/20 bg-[#2F5BFF]/10 px-3 py-0.5 text-xs font-bold text-[#2F5BFF]">
                  AI Studio
                </span>
              </div>
              <p className="text-xs sm:text-sm lg:text-base text-[#5a6384] mt-0.5">
                Convert documents or raw notes into a tailored, executive-ready presentation.
              </p>
            </div>
          </div>
          <span className="text-xs sm:text-sm font-medium text-[#5a6384] hidden sm:block">
            Supports PDF, DOCX or plain text
          </span>
        </div>

        {/* ── 2-Column Responsive Layout (Large screens side-by-side; stacked on mobile) ── */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 xl:gap-10 items-stretch">
          {/* Left Column: Deck Configuration */}
          <div className="lg:col-span-6 flex flex-col justify-between gap-4 sm:gap-5">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="deck-title" className="text-sm font-bold text-[#101A3A] flex items-center justify-between">
                <span>Deck title</span>
                <span className="text-xs font-normal text-[#5a6384]">Optional (auto-named from file)</span>
              </label>
              <input
                id="deck-title"
                type="text"
                placeholder="e.g. Q3 Earnings & Market Strategy"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                disabled={busy}
                className="w-full rounded-2xl border border-[#101A3A]/15 bg-white/95 px-4 py-3 text-sm sm:text-base text-[#101A3A] placeholder:text-[#9aa3bf] shadow-xs outline-none transition focus:border-[#2F5BFF] focus:ring-4 focus:ring-[#2F5BFF]/10 disabled:opacity-60"
              />
            </div>

            {/* Template picker */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-[#101A3A] flex items-center gap-2">
                  <Layers size={16} className="text-[#2F5BFF]" />
                  <span>Template theme</span>
                </label>
                <span className="text-xs text-[#5a6384]">Switchable anytime</span>
              </div>
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                {Object.values(themes).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={busy}
                    onClick={() => setSelectedTheme(t.id)}
                    title={t.name}
                    className={clsx(
                      "group relative flex items-center gap-3 rounded-2xl border p-3 text-left text-xs sm:text-sm font-semibold transition-all duration-150",
                      selectedTheme === t.id
                        ? "border-[#2F5BFF] bg-[#2F5BFF]/10 text-[#2F5BFF] shadow-xs ring-2 ring-[#2F5BFF]/30"
                        : "border-[#101A3A]/10 bg-white/90 text-[#5a6384] hover:border-[#2F5BFF]/40 hover:bg-white hover:shadow-xs"
                    )}
                  >
                    <span
                      className="h-7 w-7 shrink-0 rounded-xl border border-black/10 shadow-xs"
                      style={{ background: t.colors.bg, borderBottom: `3px solid ${t.colors.accent}` }}
                    />
                    <span className="truncate text-xs sm:text-sm leading-tight font-bold">
                      {t.name.split(" ")[0]}
                    </span>
                    {selectedTheme === t.id && (
                      <span className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#2F5BFF] text-[9px] text-white shadow-xs">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Slide Count Selector */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-[#101A3A] flex items-center gap-2">
                  <Sliders size={16} className="text-[#2F5BFF]" />
                  <span>Slide count</span>
                </label>
                <span className="text-xs text-[#5a6384]">Target presentation length</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                {[
                  { count: 6, label: "6 slides", desc: "Brief" },
                  { count: 10, label: "10 slides", desc: "Standard" },
                  { count: 15, label: "15 slides", desc: "Detailed" },
                  { count: 20, label: "20 slides", desc: "Full deck" },
                ].map((opt) => (
                  <button
                    key={opt.count}
                    type="button"
                    disabled={busy}
                    onClick={() => setSlideCount(opt.count)}
                    className={clsx(
                      "flex flex-col items-start p-3 sm:p-3.5 rounded-2xl border text-left transition-all duration-150",
                      slideCount === opt.count
                        ? "border-[#2F5BFF] bg-[#2F5BFF]/8 ring-2 ring-[#2F5BFF]/25 shadow-xs"
                        : "border-[#101A3A]/10 bg-white/90 hover:border-[#101A3A]/25 hover:bg-white",
                      busy && "pointer-events-none opacity-60"
                    )}
                  >
                    <span
                      className={clsx(
                        "text-sm sm:text-base font-bold leading-tight",
                        slideCount === opt.count ? "text-[#2F5BFF]" : "text-[#101A3A]"
                      )}
                    >
                      {opt.label}
                    </span>
                    <span className="text-xs text-[#5a6384] mt-0.5">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Include Images Option */}
            <div className="flex items-center justify-between rounded-2xl border border-[#101A3A]/10 bg-white/95 px-4 py-3.5 shadow-xs transition hover:border-[#2F5BFF]/30">
              <div className="flex items-center gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#2F5BFF]">
                  <ImageIcon size={20} />
                </div>
                <div className="flex flex-col">
                  <label htmlFor="include-images" className="text-sm sm:text-base font-bold text-[#101A3A] cursor-pointer">
                    Stock photography
                  </label>
                  <span className="text-xs text-[#5a6384]">
                    Automatically selects contextual imagery for visual slides
                  </span>
                </div>
              </div>
              <input
                id="include-images"
                type="checkbox"
                checked={includeImages}
                onChange={(e) => setIncludeImages(e.target.checked)}
                disabled={busy}
                className="h-5 w-5 rounded border-[#101A3A]/20 text-[#2F5BFF] focus:ring-[#2F5BFF] cursor-pointer accent-[#2F5BFF]"
              />
            </div>
          </div>

          {/* Right Column: Source Document / Text & Action Button */}
          <div className="lg:col-span-6 flex flex-col justify-between gap-4">
            {/* Source Input Tabs */}
            <div className="flex flex-col flex-1 gap-3">
              <div
                role="tablist"
                className="flex w-full overflow-hidden rounded-2xl border border-[#101A3A]/10 bg-[#F4F6FB] p-1.5"
              >
                {(["file", "text"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => { setTab(t); setError(null); }}
                    disabled={busy}
                    className={clsx(
                      "flex-1 rounded-xl py-2.5 text-xs sm:text-sm font-bold transition-all duration-150 flex items-center justify-center gap-2",
                      tab === t
                        ? "bg-white text-[#101A3A] shadow-xs"
                        : "text-[#5a6384] hover:text-[#101A3A]"
                    )}
                  >
                    {t === "file" ? (
                      <>
                        <Upload size={16} className={tab === t ? "text-[#2F5BFF]" : "text-[#5a6384]"} />
                        <span>Upload document</span>
                      </>
                    ) : (
                      <>
                        <FileText size={16} className={tab === t ? "text-[#2F5BFF]" : "text-[#5a6384]"} />
                        <span>Paste text</span>
                      </>
                    )}
                  </button>
                ))}
              </div>

              {/* File Tab Dropzone */}
              {tab === "file" && (
                <div
                  role="tabpanel"
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => !busy && inputRef.current?.click()}
                  aria-label="File drop zone"
                  className={clsx(
                    "group flex flex-1 min-h-[220px] lg:min-h-[250px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-200",
                    dragging
                      ? "border-[#2F5BFF] bg-gradient-to-b from-[#2F5BFF]/10 via-[#2F5BFF]/5 to-transparent scale-[1.01]"
                      : "border-[#101A3A]/15 bg-white/80 hover:border-[#2F5BFF]/50 hover:bg-gradient-to-b hover:from-blue-50/40 hover:to-white hover:shadow-xs",
                    busy && "pointer-events-none opacity-60"
                  )}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED}
                    onChange={onInputChange}
                    className="sr-only"
                    aria-label="Choose a PDF or DOCX file"
                  />
                  {file ? (
                    <>
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-[#2F5BFF] shadow-xs">
                        <FileText size={28} />
                      </div>
                      <p className="mt-3 font-bold text-[#101A3A] text-sm sm:text-base line-clamp-1 max-w-[360px]">
                        {file.name}
                      </p>
                      <p className="mt-1 text-xs text-[#5a6384]">
                        {(file.size / 1024 / 1024).toFixed(2)} MB · Click to change file
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60">
                        <CheckCircle2 size={14} /> Ready to generate
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2F5BFF]/10 text-[#2F5BFF] transition-transform group-hover:scale-110 shadow-xs">
                        <Upload size={26} />
                      </div>
                      <p className="mt-3 text-base sm:text-lg font-bold text-[#101A3A]">
                        Drop your document here
                      </p>
                      <p className="mt-1 text-xs sm:text-sm text-[#5a6384]">
                        Supports PDF or DOCX (max {MAX_MB} MB)
                      </p>
                      <span className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl border border-[#101A3A]/15 bg-white px-4 py-2 text-xs sm:text-sm font-bold text-[#101A3A] shadow-xs group-hover:border-[#2F5BFF] group-hover:text-[#2F5BFF]">
                        Browse files
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* Text Tab */}
              {tab === "text" && (
                <div role="tabpanel" className="flex-1 flex flex-col">
                  <textarea
                    id="deck-text"
                    placeholder="Paste your report, meeting notes, research summary, or article here…"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={50_000}
                    rows={9}
                    disabled={busy}
                    className="w-full flex-1 min-h-[220px] lg:min-h-[250px] rounded-2xl border border-[#101A3A]/15 bg-white/95 p-4 text-sm sm:text-base text-[#101A3A] placeholder:text-[#9aa3bf] shadow-xs outline-none transition focus:border-[#2F5BFF] focus:ring-4 focus:ring-[#2F5BFF]/10 disabled:opacity-60"
                  />
                  <div className="mt-1.5 flex items-center justify-between text-xs text-[#9aa3bf]">
                    <span>Raw text or notes</span>
                    <span>{text.length.toLocaleString()} / 50,000</span>
                  </div>
                </div>
              )}
            </div>

            {/* Error display */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-xs sm:text-sm text-red-600 shadow-xs animate-in fade-in">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={busy}
              className="group relative flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#2F5BFF] via-[#4338CA] to-[#7C3AED] py-4 px-8 text-sm sm:text-base font-bold text-white shadow-lg shadow-[#2F5BFF]/25 transition-all duration-200 hover:shadow-[#2F5BFF]/45 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5BFF] disabled:opacity-60 disabled:pointer-events-none"
            >
              {busy ? (
                <>
                  <Loader2 size={19} className="animate-spin" />
                  <span>{progress === "redirecting" ? "Opening deck…" : "Generating slides…"}</span>
                </>
              ) : (
                <>
                  <span>Create presentation deck</span>
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewDeckSkeleton() {
  return (
    <div className="relative w-full min-h-full flex flex-col items-center justify-center py-2 sm:py-3 lg:py-4">
      <div className="relative z-10 w-full max-w-7xl 2xl:max-w-[1440px] rounded-3xl border border-white/80 bg-white/80 p-6 sm:p-8 lg:p-9 xl:p-10 shadow-sm backdrop-blur-xl space-y-6">
        <div className="flex items-center justify-between border-b border-[#101A3A]/8 pb-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56 rounded-lg" />
            <Skeleton className="h-4 w-80 rounded-md" />
          </div>
          <Skeleton className="h-6 w-40 rounded-full" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 xl:gap-10">
          <div className="lg:col-span-6 space-y-5">
            <Skeleton className="h-12 w-full rounded-2xl" />
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-13 rounded-2xl" />
              ))}
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-13 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
          <div className="lg:col-span-6 space-y-5">
            <Skeleton className="h-11 w-full rounded-2xl" />
            <Skeleton className="h-56 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewDeckPage() {
  return (
    <Suspense fallback={<NewDeckSkeleton />}>
      <NewDeckForm />
    </Suspense>
  );
}
