"use client";

import { Suspense, useCallback, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import {
  Upload,
  FileText,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { themes, defaultThemeId } from "@/lib/themes";

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
        res = await fetch("/api/decks", { method: "POST", body: form });
      } else {
        res = await fetch("/api/decks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim() || undefined, text, theme: selectedTheme }),
        });
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
    <div className="mx-auto max-w-2xl">
      <h2 className="text-2xl font-extrabold text-[#101A3A] [font-family:var(--font-display)]">
        New Deck
      </h2>
      <p className="mt-1 text-sm text-[#5a6384]">
        Upload a PDF or DOCX, or paste your content below.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="deck-title" className="text-sm font-semibold text-[#101A3A]">
            Deck title
          </label>
          <input
            id="deck-title"
            type="text"
            placeholder="e.g. Q3 Earnings Overview"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            disabled={busy}
            className="rounded-xl border border-[#101A3A]/15 bg-white px-4 py-3 text-sm text-[#101A3A] placeholder:text-[#9aa3bf] shadow-sm outline-none transition focus:border-[#2F5BFF] focus:ring-2 focus:ring-[#2F5BFF]/15 disabled:opacity-60"
          />
        </div>

        {/* Theme picker */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-[#101A3A]">Theme</label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {Object.values(themes).map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={busy}
                onClick={() => setSelectedTheme(t.id)}
                title={t.name}
                className={clsx(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-2 text-xs font-medium transition",
                  selectedTheme === t.id
                    ? "border-[#2F5BFF] bg-[#2F5BFF]/5 text-[#2F5BFF]"
                    : "border-[#101A3A]/10 bg-white text-[#5a6384] hover:border-[#2F5BFF]/30"
                )}
              >
                {/* Mini swatch */}
                <span
                  className="h-6 w-full rounded-md border border-black/5"
                  style={{ background: t.colors.bg, borderBottom: `3px solid ${t.colors.accent}` }}
                />
                <span className="truncate w-full text-center leading-tight">{t.name.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div>
          <div
            role="tablist"
            className="mb-4 flex w-full overflow-hidden rounded-xl border border-[#101A3A]/10 bg-[#F4F6FB] p-1"
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
                  "flex-1 rounded-lg py-2 text-sm font-semibold transition",
                  tab === t
                    ? "bg-white text-[#101A3A] shadow-sm"
                    : "text-[#5a6384] hover:text-[#101A3A]"
                )}
              >
                {t === "file" ? "Upload file" : "Paste text"}
              </button>
            ))}
          </div>

          {/* File tab */}
          {tab === "file" && (
            <div
              role="tabpanel"
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => !busy && inputRef.current?.click()}
              aria-label="File drop zone"
              className={clsx(
                "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition",
                dragging
                  ? "border-[#2F5BFF] bg-[#2F5BFF]/5"
                  : "border-[#101A3A]/15 bg-white hover:border-[#2F5BFF]/40 hover:bg-[#2F5BFF]/5",
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
                  <FileText size={32} className="text-[#2F5BFF]" />
                  <p className="mt-3 font-semibold text-[#101A3A]">{file.name}</p>
                  <p className="mt-1 text-xs text-[#5a6384]">
                    {(file.size / 1024 / 1024).toFixed(2)} MB — click to change
                  </p>
                </>
              ) : (
                <>
                  <Upload size={32} className="text-[#5a6384]" />
                  <p className="mt-3 font-semibold text-[#101A3A]">
                    Drop your file here
                  </p>
                  <p className="mt-1 text-sm text-[#5a6384]">
                    PDF or DOCX · max {MAX_MB} MB
                  </p>
                  <span className="mt-4 rounded-lg border border-[#101A3A]/15 bg-white px-4 py-1.5 text-sm font-medium text-[#101A3A]">
                    Browse files
                  </span>
                </>
              )}
            </div>
          )}

          {/* Text tab */}
          {tab === "text" && (
            <div role="tabpanel">
              <textarea
                id="deck-text"
                placeholder="Paste your document content here…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={50_000}
                rows={14}
                disabled={busy}
                className="w-full rounded-2xl border border-[#101A3A]/15 bg-white px-4 py-3 text-sm text-[#101A3A] placeholder:text-[#9aa3bf] shadow-sm outline-none transition focus:border-[#2F5BFF] focus:ring-2 focus:ring-[#2F5BFF]/15 disabled:opacity-60"
              />
              <p className="mt-1 text-right text-xs text-[#9aa3bf]">
                {text.length.toLocaleString()} / 50,000
              </p>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2F5BFF] py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#2F5BFF]/25 transition hover:bg-[#2449d6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5BFF] disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {progress === "redirecting" ? "Opening deck…" : "Uploading…"}
            </>
          ) : (
            "Create deck →"
          )}
        </button>
      </form>
    </div>
  );
}

export default function NewDeckPage() {
  return (
    <Suspense>
      <NewDeckForm />
    </Suspense>
  );
}
