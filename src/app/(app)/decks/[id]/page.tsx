"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Check,
  Wand2,
  PlaySquare,
  ListOrdered,
  Settings2,
  MessageSquare,
  Undo2,
  Send,
  Zap,
  Download
} from "lucide-react";
import type { OutlineSection, ISlide } from "@/app/models/Deck";
import SlideRenderer from "@/components/app/SlideRenderer";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DeckData {
  _id: string;
  title: string;
  status: string;
  sourceName: string;
  theme: string;
  outline: OutlineSection[];
  slides: ISlide[];
  error?: string;
}

// ── Debounce hook ──────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DeckEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [deckId, setDeckId] = useState<string | null>(null);
  const [deck, setDeck] = useState<DeckData | null>(null);
  const [outline, setOutline] = useState<OutlineSection[]>([]);
  const [slides, setSlides] = useState<ISlide[]>([]);
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("modern");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const [viewMode, setViewMode] = useState<"outline" | "slides">("outline");
  const [activeSlideIdx, setActiveSlideIdx] = useState<number>(0);
  
  // Right Panel Tabs
  const [panelTab, setPanelTab] = useState<"edit" | "chat">("edit");
  
  // Edit Tab State
  const [regenInstruction, setRegenInstruction] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  
  // Chat Tab State
  const [chatMessages, setChatMessages] = useState<{role: string, content: string, id: string}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [remainingMessages, setRemainingMessages] = useState(30);

  // Resolve params
  useEffect(() => {
    params.then(({ id }) => setDeckId(id));
  }, [params]);

  // ── Initial load ────────────────────────────────────────────────────────────

  const fetchDeck = useCallback(async (id: string) => {
    const res = await fetch(`/api/decks/${id}`);
    if (!res.ok) {
      setLoadError("Deck not found or you don't have access.");
      return null;
    }
    const data = (await res.json()) as { deck: DeckData };
    return data.deck;
  }, []);

  useEffect(() => {
    if (!deckId) return;
    fetchDeck(deckId).then((d) => {
      if (!d) return;
      setDeck(d);
      setTitle(d.title);
      setTheme(d.theme);
      setOutline(d.outline ?? []);
      setSlides(d.slides ?? []);
      // Recover stuck states with no slides
      if (!d.slides || d.slides.length === 0) {
        if (d.status === "generating" || d.status === "ready") {
          setDeck({ ...d, status: "outlined" });
          setViewMode("outline");
          return;
        }
      }
      if (d.status === "generating" || d.status === "ready") {
        setViewMode("slides");
      }
    });
  }, [deckId, fetchDeck]);

  // ── Polling (outlining / generating) ────────────────────────────────────────

  useEffect(() => {
    if (!deckId || !deck) return;
    const activeStates = ["outlining", "generating"];
    if (!activeStates.includes(deck.status)) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }
    pollingRef.current = setInterval(async () => {
      const d = await fetchDeck(deckId);
      if (!d) return;
      setDeck(d);
      setSlides(d.slides ?? []);
      if (!activeStates.includes(d.status)) {
        clearInterval(pollingRef.current!);
        setTitle(d.title);
        setOutline(d.outline ?? []);
      }
    }, 2000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [deckId, deck?.status, fetchDeck]);

  // ── Generate slides ──────────────────────────────────────────────────────────

  const generateSlides = async () => {
    if (!deckId || !deck) return;
    if (saveStatus === "saving") await new Promise(r => setTimeout(r, 1000));

    setDeck({ ...deck, status: "generating", error: "" });
    setViewMode("slides");
    fetch(`/api/decks/${deckId}/generate`, { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json();
          setLoadError(body.error || "Generation failed");
        }
      })
      .catch(() => {});
  };

  // ── AI Chat Submit ───────────────────────────────────────────────────────────

  const submitChat = async (msgOverride?: string) => {
    const text = msgOverride || chatInput;
    if (!text.trim() || !deckId || chatLoading || remainingMessages <= 0) return;
    
    const userMsg = { role: "user", content: text, id: crypto.randomUUID() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const selectedSlideId = slides[activeSlideIdx]?.id;
      const res = await fetch(`/api/decks/${deckId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, selectedSlideId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      const assistantMsg = { role: "assistant", content: data.reply, id: crypto.randomUUID() };
      setChatMessages(prev => [...prev, assistantMsg]);
      
      if (data.slides) setSlides(data.slides);
      if (data.theme) setTheme(data.theme);
      if (data.remainingMessages !== undefined) setRemainingMessages(data.remainingMessages);
      
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Error: " + err.message, id: crypto.randomUUID() }]);
    } finally {
      setChatLoading(false);
    }
  };

  // ── Undo ─────────────────────────────────────────────────────────────────────

  const handleUndo = async () => {
    try {
      const res = await fetch(`/api/decks/${deckId}/undo`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSlides(data.slides);
      setTheme(data.theme);
    } catch (err: any) {
      alert(err.message || "Undo failed.");
    }
  };

  // ── Regenerate single slide ──────────────────────────────────────────────────

  const handleRegenerateSlide = async () => {
    if (!deckId || !deck || slides.length === 0) return;
    const currentSlide = slides[activeSlideIdx];
    if (!currentSlide || !currentSlide.id) return;

    setRegenerating(true);
    try {
      const res = await fetch(`/api/decks/${deckId}/slides/${currentSlide.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: regenInstruction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      const newSlides = [...slides];
      newSlides[activeSlideIdx] = data.slide;
      setSlides(newSlides);
      setRegenInstruction("");
    } catch (err: any) {
      alert(err.message || "Failed to regenerate slide.");
    } finally {
      setRegenerating(false);
    }
  };

  // ── Autosave ───────────────────────────────────────────────────────────────

  const debouncedTitle = useDebounce(title, 800);
  const debouncedOutline = useDebounce(outline, 800);
  const savedRef = useRef({ title: "", outline: "[]", theme: "" });

  useEffect(() => {
    if (!deckId || !deck) return;
    if (deck.status === "outlining" || deck.status === "generating") return;

    const nextTitle = debouncedTitle;
    const nextOutline = JSON.stringify(debouncedOutline);
    
    if (
      nextTitle === savedRef.current.title &&
      nextOutline === savedRef.current.outline &&
      theme === savedRef.current.theme
    )
      return;

    setSaveStatus("saving");
    fetch(`/api/decks/${deckId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: nextTitle, outline: debouncedOutline, theme }),
    })
      .then((r) => {
        if (r.ok) {
          savedRef.current = { title: nextTitle, outline: nextOutline, theme };
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        }
      })
      .catch(() => setSaveStatus("idle"));
  }, [debouncedTitle, debouncedOutline, theme, deckId, deck?.status]);

  // ── Outline helpers ────────────────────────────────────────────────────────

  const updateSection = (idx: number, patch: Partial<OutlineSection>) =>
    setOutline((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  const addSection = () =>
    setOutline((prev) => [...prev, { id: crypto.randomUUID(), title: "New section", points: [""] }]);
  const deleteSection = (idx: number) =>
    setOutline((prev) => prev.filter((_, i) => i !== idx));
  const moveSection = (idx: number, dir: -1 | 1) =>
    setOutline((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  const updatePoint = (sIdx: number, pIdx: number, val: string) =>
    setOutline((prev) =>
      prev.map((s, i) => i === sIdx ? { ...s, points: s.points.map((p, j) => (j === pIdx ? val : p)) } : s)
    );
  const addPoint = (sIdx: number) =>
    setOutline((prev) => prev.map((s, i) => i === sIdx ? { ...s, points: [...s.points, ""] } : s));
  const deletePoint = (sIdx: number, pIdx: number) =>
    setOutline((prev) => prev.map((s, i) => i === sIdx ? { ...s, points: s.points.filter((_, j) => j !== pIdx) } : s));

  // ── Render states ────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <AlertCircle size={32} className="text-red-500" />
        <p className="mt-3 text-sm text-[#5a6384]">{loadError}</p>
        <button
          onClick={() => router.push("/decks")}
          className="mt-4 rounded-xl bg-[#101A3A] px-4 py-2 text-sm font-semibold text-white"
        >
          Back to decks
        </button>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[#5a6384]" />
      </div>
    );
  }

  const isOutlining = deck.status === "outlining";
  const isGenerating = deck.status === "generating";
  const isFailed = deck.status === "failed";
  const canGenerate = (deck.status === "outlined" || deck.status === "ready") && outline.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 shrink-0 mb-4">
        <div className="flex-1 flex items-center gap-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isOutlining || isGenerating}
            className="w-full max-w-sm rounded-xl border border-transparent bg-transparent px-2 py-1 text-2xl font-extrabold text-[#101A3A] [font-family:var(--font-display)] outline-none transition hover:border-[#101A3A]/15 focus:border-[#2F5BFF] focus:ring-2 focus:ring-[#2F5BFF]/15 focus:bg-white disabled:opacity-60"
          />
          {/* Save indicator */}
          <div className="flex h-8 items-center text-xs text-[#5a6384] w-20">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> Saving…
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1.5 text-emerald-600">
                <Check size={12} /> Saved
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          {(deck.status === "outlined" || deck.status === "ready" || isGenerating) && (
            <div className="flex bg-[#101A3A]/5 p-1 rounded-lg mr-4">
              <button
                onClick={() => setViewMode("outline")}
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition",
                  viewMode === "outline" ? "bg-white text-[#101A3A] shadow-sm" : "text-[#5a6384]"
                )}
              >
                <ListOrdered size={16} /> Outline
              </button>
              <button
                onClick={() => setViewMode("slides")}
                disabled={slides.length === 0 && !isGenerating}
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition",
                  viewMode === "slides" ? "bg-white text-[#101A3A] shadow-sm" : "text-[#5a6384] disabled:opacity-50"
                )}
              >
                <PlaySquare size={16} /> Slides
              </button>
            </div>
          )}

          {canGenerate && viewMode === "outline" && (
            <button
              onClick={generateSlides}
              className="flex items-center gap-2 rounded-xl bg-[#101A3A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d2c5e]"
            >
              <Wand2 size={16} /> Generate Slides (1 credit)
            </button>
          )}

          {viewMode === "slides" && slides.length > 0 && (
            <button
              onClick={async () => {
                if (!deckId) return;
                const btn = document.getElementById("export-btn") as HTMLButtonElement;
                const originalText = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = `<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Exporting...`;
                
                try {
                  const res = await fetch(`/api/decks/${deckId}/export`);
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || "Failed to export");
                  }
                  const blob = await res.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  const cd = res.headers.get("Content-Disposition");
                  let filename = "Presentation.pptx";
                  if (cd) {
                    const match = cd.match(/filename="([^"]+)"/);
                    if (match) filename = match[1];
                  }
                  a.download = filename;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  window.URL.revokeObjectURL(url);
                } catch (err: any) {
                  alert(err.message || "Failed to export presentation.");
                } finally {
                  btn.disabled = false;
                  btn.innerHTML = originalText;
                }
              }}
              id="export-btn"
              className="flex items-center gap-2 rounded-xl bg-[#2F5BFF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2548cc] disabled:opacity-50"
            >
              <Download size={16} /> Download PPTX
            </button>
          )}
        </div>
      </div>

      {/* Status banners */}
      {isOutlining && (
        <div className="flex items-center gap-3 rounded-xl border border-[#2F5BFF]/20 bg-[#2F5BFF]/5 px-4 py-3 text-sm text-[#2F5BFF] mb-6">
          <Loader2 size={16} className="animate-spin shrink-0" />
          Generating your outline with AI… this takes about 10 seconds.
        </div>
      )}
      
      {isFailed && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 mb-6">
          <div className="flex items-center gap-2.5 text-sm text-red-600">
            <AlertCircle size={16} className="shrink-0" />
            Operation failed. {deck.error}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 relative">
        
        {/* Outline View */}
        {viewMode === "outline" && outline.length > 0 && (
          <div className="mx-auto max-w-3xl space-y-4 pb-20 h-full overflow-y-auto">
            {outline.map((section, sIdx) => (
              <div key={section.id} className="rounded-2xl border border-[#101A3A]/10 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="mt-2.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2F5BFF]/10 text-[10px] font-bold text-[#2F5BFF]">
                    {sIdx + 1}
                  </span>
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => updateSection(sIdx, { title: e.target.value })}
                    className="flex-1 rounded-lg border border-transparent bg-transparent py-1.5 text-base font-semibold text-[#101A3A] [font-family:var(--font-display)] outline-none transition hover:border-[#101A3A]/15 focus:border-[#2F5BFF] focus:ring-2 focus:ring-[#2F5BFF]/10 focus:bg-[#F4F6FB] px-2"
                  />
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveSection(sIdx, -1)} disabled={sIdx === 0} className="rounded-lg p-1.5 text-[#5a6384] hover:bg-[#F4F6FB] disabled:opacity-30">
                      <ChevronUp size={15} />
                    </button>
                    <button onClick={() => moveSection(sIdx, 1)} disabled={sIdx === outline.length - 1} className="rounded-lg p-1.5 text-[#5a6384] hover:bg-[#F4F6FB] disabled:opacity-30">
                      <ChevronDown size={15} />
                    </button>
                    <button onClick={() => deleteSection(sIdx)} className="rounded-lg p-1.5 text-[#5a6384] hover:text-red-500 hover:bg-red-50">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <ul className="mt-3 space-y-2 pl-8">
                  {section.points.map((point, pIdx) => (
                    <li key={pIdx} className="flex items-start gap-2">
                      <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2F5BFF]/50" />
                      <input
                        type="text"
                        value={point}
                        onChange={(e) => updatePoint(sIdx, pIdx, e.target.value)}
                        className="flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm text-[#101A3A] placeholder:text-[#9aa3bf] outline-none transition hover:border-[#101A3A]/10 focus:border-[#2F5BFF] focus:bg-[#F4F6FB]"
                        placeholder="Add a point…"
                      />
                      <button onClick={() => deletePoint(sIdx, pIdx)} className="mt-1.5 shrink-0 p-1 text-[#9aa3bf] hover:text-red-500 hover:bg-red-50 rounded">
                        <Trash2 size={13} />
                      </button>
                    </li>
                  ))}
                  <li>
                    <button onClick={() => addPoint(sIdx)} className={clsx("ml-3.5 mt-1 flex items-center gap-1 text-xs text-[#5a6384] hover:text-[#2F5BFF]", section.points.length >= 10 && "hidden")}>
                      <Plus size={12} /> Add point
                    </button>
                  </li>
                </ul>
              </div>
            ))}
            {outline.length < 20 && (
              <button onClick={addSection} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#101A3A]/10 py-4 text-sm font-medium text-[#5a6384] hover:border-[#2F5BFF]/30 hover:text-[#2F5BFF]">
                <Plus size={16} /> Add section
              </button>
            )}
          </div>
        )}

        {/* Slides View */}
        {viewMode === "slides" && (
          <div className="absolute inset-0 flex gap-6">
            
            {/* Left Rail: Thumbnails */}
            <div className="w-48 shrink-0 flex flex-col gap-3 overflow-y-auto pr-2 pb-10">
              {slides.map((slide, idx) => (
                <button
                  key={idx} // Some might be null while generating
                  onClick={() => slide && setActiveSlideIdx(idx)}
                  className={clsx(
                    "w-full aspect-video rounded-lg overflow-hidden border-2 text-left transition relative group",
                    activeSlideIdx === idx ? "border-[#2F5BFF] ring-2 ring-[#2F5BFF]/20" : "border-transparent hover:border-[#101A3A]/20"
                  )}
                >
                  {slide ? (
                    <SlideRenderer slide={slide as any} theme={theme} className="pointer-events-none" />
                  ) : (
                    <div className="absolute inset-0 bg-[#101A3A]/5 flex items-center justify-center">
                      <Loader2 size={20} className="animate-spin text-[#5a6384]" />
                    </div>
                  )}
                  <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 rounded">
                    {idx + 1}
                  </div>
                </button>
              ))}
              {isGenerating && (
                <div className="text-center text-xs text-[#5a6384] mt-2 flex items-center justify-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" /> Generating...
                </div>
              )}
            </div>

            {/* Center Canvas */}
            <div className="flex-1 flex flex-col min-h-0 bg-white/50 rounded-2xl border border-[#101A3A]/10 p-6 relative">
              <div className="flex justify-end mb-4 absolute top-4 right-4 z-10">
                <button
                  onClick={handleUndo}
                  className="flex items-center gap-1.5 bg-white border border-[#101A3A]/15 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#101A3A] shadow-sm hover:bg-[#F4F6FB]"
                >
                  <Undo2 size={14} /> Undo Edit
                </button>
              </div>

              <div className="flex-1 flex items-center justify-center overflow-hidden">
                {slides[activeSlideIdx] ? (
                  <div className="w-full max-w-4xl shadow-xl ring-1 ring-black/5 rounded overflow-hidden">
                    <SlideRenderer slide={slides[activeSlideIdx] as any} theme={theme} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-[#5a6384]">
                    <Loader2 size={32} className="animate-spin mb-4" />
                    <p>Generating slide...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Controls & Chat */}
            <div className="w-80 shrink-0 flex flex-col border border-[#101A3A]/10 rounded-2xl overflow-hidden bg-white shadow-sm">
              
              {/* Tabs */}
              <div className="flex border-b border-[#101A3A]/10">
                <button
                  onClick={() => setPanelTab("edit")}
                  className={clsx(
                    "flex-1 py-3 text-sm font-semibold border-b-2 transition flex items-center justify-center gap-2",
                    panelTab === "edit" ? "border-[#2F5BFF] text-[#101A3A]" : "border-transparent text-[#5a6384] hover:text-[#101A3A]"
                  )}
                >
                  <Settings2 size={16} /> Edit
                </button>
                <button
                  onClick={() => setPanelTab("chat")}
                  className={clsx(
                    "flex-1 py-3 text-sm font-semibold border-b-2 transition flex items-center justify-center gap-2",
                    panelTab === "chat" ? "border-[#2F5BFF] text-[#101A3A]" : "border-transparent text-[#5a6384] hover:text-[#101A3A]"
                  )}
                >
                  <MessageSquare size={16} /> AI Chat
                </button>
              </div>

              {/* Edit Tab */}
              {panelTab === "edit" && (
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
                  {/* Theme Switcher */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5a6384] mb-3">Deck Theme</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {["modern", "corporate", "creative", "dark", "playful", "elegant"].map((t) => (
                        <button
                          key={t}
                          onClick={() => setTheme(t)}
                          className={clsx(
                            "text-xs py-2 px-2 rounded capitalize border transition font-medium",
                            theme === t ? "bg-[#2F5BFF] text-white border-[#2F5BFF]" : "bg-[#F4F6FB] text-[#5a6384] border-transparent hover:border-[#101A3A]/20"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Slide controls */}
                  {slides[activeSlideIdx] && (
                    <div className="flex flex-col gap-4 border-t border-[#101A3A]/10 pt-4">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#5a6384] mb-2">Slide Notes</h3>
                        <p className="text-sm text-[#101A3A] leading-relaxed bg-[#F4F6FB] p-3 rounded-lg">
                          {slides[activeSlideIdx].notes || "No notes."}
                        </p>
                      </div>
                      
                      <div className="border-t border-[#101A3A]/10 pt-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#5a6384] mb-2 flex items-center gap-1.5">
                          <Wand2 size={14} /> Regenerate Slide
                        </h3>
                        <textarea
                          placeholder="e.g. Make it shorter, use bullet points..."
                          value={regenInstruction}
                          onChange={e => setRegenInstruction(e.target.value)}
                          disabled={regenerating}
                          rows={2}
                          className="w-full text-sm p-3 rounded-xl border border-[#101A3A]/15 focus:border-[#2F5BFF] outline-none resize-none mb-3 disabled:opacity-50"
                        />
                        <button
                          onClick={handleRegenerateSlide}
                          disabled={regenerating}
                          className="w-full flex items-center justify-center gap-2 bg-[#101A3A] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#1d2c5e] transition disabled:opacity-50"
                        >
                          {regenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                          Regenerate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Chat Tab */}
              {panelTab === "chat" && (
                <div className="flex-1 flex flex-col min-h-0 bg-[#F4F6FB]">
                  
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                    {chatMessages.length === 0 && (
                      <div className="text-center text-[#5a6384] text-sm mt-4">
                        <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
                        <p>Ask AI to edit your slides.</p>
                        <p className="text-xs mt-1 opacity-70">"Add a title slide", "Shorten slide 3", "Change theme to corporate"</p>
                      </div>
                    )}
                    {chatMessages.map(m => (
                      <div key={m.id} className={clsx("max-w-[85%] rounded-xl p-3 text-sm", m.role === "user" ? "bg-[#2F5BFF] text-white self-end rounded-tr-sm" : "bg-white border border-[#101A3A]/10 text-[#101A3A] self-start rounded-tl-sm")}>
                        {m.content}
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="bg-white border border-[#101A3A]/10 text-[#101A3A] self-start rounded-xl rounded-tl-sm p-3 flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" /> <span className="text-sm">Thinking...</span>
                      </div>
                    )}
                  </div>

                  {/* Quick Chips */}
                  <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
                    {["Shorten text", "More formal", "Fix overflow"].map(q => (
                      <button key={q} onClick={() => submitChat(q)} disabled={chatLoading} className="shrink-0 bg-white border border-[#101A3A]/15 px-3 py-1.5 rounded-full text-xs font-semibold text-[#101A3A] hover:bg-[#F4F6FB] transition whitespace-nowrap disabled:opacity-50">
                        {q}
                      </button>
                    ))}
                  </div>

                  {/* Input area */}
                  <div className="p-4 bg-white border-t border-[#101A3A]/10 shrink-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#2F5BFF] bg-[#2F5BFF]/10 px-2 py-0.5 rounded-full">
                        <Zap size={10} /> Context: Slide {activeSlideIdx + 1}
                      </div>
                      <span className="text-[10px] text-[#5a6384]">{remainingMessages} left</span>
                    </div>
                    
                    <div className="relative">
                      <textarea
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            submitChat();
                          }
                        }}
                        disabled={chatLoading || remainingMessages <= 0}
                        placeholder={remainingMessages > 0 ? "Message AI editor..." : "Limit reached for this deck"}
                        rows={2}
                        className="w-full text-sm p-3 pr-10 rounded-xl border border-[#101A3A]/15 focus:border-[#2F5BFF] outline-none resize-none bg-[#F4F6FB] focus:bg-white transition disabled:opacity-50"
                      />
                      <button 
                        onClick={() => submitChat()} 
                        disabled={!chatInput.trim() || chatLoading || remainingMessages <= 0}
                        className="absolute right-2 bottom-2 p-1.5 bg-[#2F5BFF] text-white rounded-lg hover:bg-[#2449d6] disabled:opacity-50 disabled:bg-gray-400"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                  
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
