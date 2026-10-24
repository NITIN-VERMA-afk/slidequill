"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  Download,
  Image as ImageIcon,
  Search,
  X,
  ShieldCheck,
  Copy,
  Layout,
  Share2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
} from "lucide-react";
import type { OutlineSection, ISlide } from "@/app/models/Deck";
import SlideRenderer from "@/components/app/SlideRenderer";
import DeckEditorSkeleton from "@/components/app/DeckEditorSkeleton";
import { toast } from "sonner";
import { buildSourceCitation } from "@/lib/slides-schema";
import { applyNotesUpdate, shouldSyncNotesFromProps } from "@/lib/notes-sync";
import {
  createDefaultSlide,
  duplicateSlide,
  deleteSlide,
  reorderSlides,
  switchSlideLayout,
  MAX_DECK_SLIDES,
  LAYOUT_OPTIONS,
  ReorderDebounceManager,
} from "@/lib/slide-mutations";

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
  hasSourceText?: boolean;
  slidesDone?: number;
  slidesTotal?: number;
  updatedAt?: string | Date;
  version?: number;
  share?: {
    enabled: boolean;
    slug?: string;
    createdAt?: string | Date;
    revokedAt?: string | Date;
  };
  outlineProgress?: {
    stage?: string;
    chunksDone: number;
    chunksTotal: number;
    currentPageRange?: string;
  };
}

const IMAGE_SUPPORTED_LAYOUTS = [
  "title",
  "bullets",
  "two_column",
  "quote",
  "closing",
  "image",
];

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
  const [batchError, setBatchError] = useState<string | null>(null);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [generatingInAnotherTab, setGeneratingInAnotherTab] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const deckUpdatedAtRef = useRef<string | Date | null>(null);
  const deckVersionRef = useRef<number | null>(null);
  const activeSaveCountRef = useRef(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const [viewMode, setViewMode] = useState<"outline" | "slides">("outline");
  const [activeSlideIdx, setActiveSlideIdx] = useState<number>(0);
  const [mobileTab, setMobileTab] = useState<"canvas" | "slides" | "edit" | "chat">("canvas");
  
  // Right Panel Tabs
  const [panelTab, setPanelTab] = useState<"edit" | "chat">("edit");
  
  // Slide Management & Reorder State
  const [showAddSlideMenu, setShowAddSlideMenu] = useState(false);
  const addSlideMenuRef = useRef<HTMLDivElement>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [reorderAnnouncement, setReorderAnnouncement] = useState("");
  const reorderManagerRef = useRef<ReorderDebounceManager | null>(null);

  useEffect(() => {
    if (!showAddSlideMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (addSlideMenuRef.current && !addSlideMenuRef.current.contains(e.target as Node)) {
        setShowAddSlideMenu(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowAddSlideMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showAddSlideMenu]);

  // Present Mode & Share State
  const [isPresenting, setIsPresenting] = useState(false);
  const [showSpeakerNotesInPresent, setShowSpeakerNotesInPresent] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  // Edit Tab State
  const [regenInstruction, setRegenInstruction] = useState("");
  const [regenNote, setRegenNote] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [imageSearchQuery, setImageSearchQuery] = useState("");
  const [imageSearchResults, setImageSearchResults] = useState<
    Array<{
      url: string;
      thumb?: string;
      alt?: string;
      photographer?: string;
      photographerUrl?: string;
      source: string;
      downloadLocation?: string;
    }>
  >([]);
  const [imageSearching, setImageSearching] = useState(false);
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [customImageUrl, setCustomImageUrl] = useState("");
  const [deletingSource, setDeletingSource] = useState(false);

  const handleDeleteSourceText = async () => {
    if (!deckId) return;
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete the uploaded source document and text from our servers? Your slides and outline will remain intact."
    );
    if (!confirmed) return;

    setDeletingSource(true);
    try {
      const res = await fetch(`/api/decks/${deckId}/source`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete source text.");
      }
      setDeck((prev) => (prev ? { ...prev, hasSourceText: false } : null));
      toast.success("Source document text deleted.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete source text.");
    } finally {
      setDeletingSource(false);
    }
  };
  
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
      if (d.updatedAt) deckUpdatedAtRef.current = d.updatedAt;
      if (d.version !== undefined) deckVersionRef.current = d.version;
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

  // ── Resumable Client-Driven Outline Stepper ─────────────────────────────────
  const drivingOutlineRef = useRef(false);
  const outlineRetryCountRef = useRef(0);

  useEffect(() => {
    if (!deckId || !deck || deck.status !== "outlining" || outlineError) {
      drivingOutlineRef.current = false;
      return;
    }
    if (drivingOutlineRef.current) return;

    drivingOutlineRef.current = true;
    let isMounted = true;

    const driveNextChunk = async () => {
      try {
        const res = await fetch(`/api/decks/${deckId}/outline`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!isMounted) return;

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          // If server failed (429 rate limit or 5xx), retry up to 3 times with backoff
          if (outlineRetryCountRef.current < 3) {
            const retryAfterHeader = res.headers.get("Retry-After");
            const retryAfterMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : 0;
            const delays = [2000, 5000, 10000];
            const delay = Math.min(retryAfterMs || delays[outlineRetryCountRef.current] || 10000, 15000);
            outlineRetryCountRef.current += 1;
            console.warn(
              `[Outline] Step failed (${res.status}), retrying in ${delay}ms (attempt ${outlineRetryCountRef.current}/3)…`
            );
            await new Promise((r) => setTimeout(r, delay));
            drivingOutlineRef.current = false;
            if (isMounted) setRetryTrigger((prev) => prev + 1);
            return;
          }

          setOutlineError(
            body?.error || "Outline generation paused due to a server error. Please try again."
          );
          const d = await fetchDeck(deckId);
          if (d && isMounted) {
            setDeck(d);
            if (d.title) setTitle(d.title);
            if (d.outline) setOutline(d.outline);
          }
          return;
        }

        const data = await res.json().catch(() => null);
        if (!isMounted || !data) return;

        // Reset errors and retry counter on success
        outlineRetryCountRef.current = 0;
        setOutlineError(null);

        if (data.deck) {
          setDeck(data.deck);
          setTitle(data.deck.title);
          setOutline(data.deck.outline ?? []);
        } else if (data.status === "outlining" && data.progress) {
          setDeck((prev) => (prev ? { ...prev, outlineProgress: data.progress } : null));
        } else {
          const d = await fetchDeck(deckId);
          if (d && isMounted) {
            setDeck(d);
            if (d.title) setTitle(d.title);
            if (d.outline) setOutline(d.outline);
          }
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Outline step network error:", err);
        if (outlineRetryCountRef.current < 3) {
          const delays = [2000, 5000, 10000];
          const delay = delays[outlineRetryCountRef.current] || 10000;
          outlineRetryCountRef.current += 1;
          console.warn(
            `[Outline] Network error, retrying in ${delay}ms (attempt ${outlineRetryCountRef.current}/3)…`
          );
          await new Promise((r) => setTimeout(r, delay));
          drivingOutlineRef.current = false;
          if (isMounted) setRetryTrigger((prev) => prev + 1);
          return;
        }
        setOutlineError("Network connection interrupted during outline generation. Please retry.");
        const d = await fetchDeck(deckId);
        if (d && isMounted) setDeck(d);
      } finally {
        drivingOutlineRef.current = false;
      }
    };

    driveNextChunk();

    return () => {
      isMounted = false;
      drivingOutlineRef.current = false;
    };
  }, [deckId, deck?.status, deck?.outlineProgress?.chunksDone, outlineError, retryTrigger, fetchDeck]);


  // ── Resumable Client-Driven Slide Generation Stepper ────────────────────────
  const drivingSlideGenRef = useRef(false);
  const retryCountRef = useRef(0);
  const inProgressCountRef = useRef(0);

  useEffect(() => {
    if (!deckId || !deck || deck.status !== "generating" || batchError) {
      drivingSlideGenRef.current = false;
      return;
    }
    if (drivingSlideGenRef.current) return;

    drivingSlideGenRef.current = true;
    let isMounted = true;

    const driveNextSlideBatch = async () => {
      try {
        const res = await fetch(`/api/decks/${deckId}/generate`, { method: "POST" });
        if (!isMounted) return;

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          // If server failed (5xx) or error returned, retry up to 3 times with backoff (2s, 5s, 10s)
          if (retryCountRef.current < 3) {
            const delays = [2000, 5000, 10000];
            const delay = delays[retryCountRef.current] || 10000;
            retryCountRef.current += 1;
            console.warn(
              `[SlideGen] Batch failed (${res.status}), retrying in ${delay}ms (attempt ${retryCountRef.current}/3)…`
            );
            await new Promise((r) => setTimeout(r, delay));
            drivingSlideGenRef.current = false;
            if (isMounted) setRetryTrigger((prev) => prev + 1);
            return;
          }

          setBatchError(
            body.error || "Slide generation paused due to a server error. Progress is saved."
          );
          const d = await fetchDeck(deckId);
          if (d && isMounted) setDeck(d);
          return;
        }

        const data = await res.json();
        if (!isMounted) return;

        // Reset errors and retry counter on success
        retryCountRef.current = 0;
        setBatchError(null);

        if (data.inProgress) {
          inProgressCountRef.current += 1;
          if (inProgressCountRef.current >= 2) {
            setGeneratingInAnotherTab(true);
          }
          await new Promise((r) => setTimeout(r, 2500));
        } else {
          inProgressCountRef.current = 0;
          setGeneratingInAnotherTab(false);
        }

        if (data.slides) {
          setSlides(data.slides);
        }

        if (data.status === "ready") {
          const d = await fetchDeck(deckId);
          if (d && isMounted) {
            setDeck(d);
            setSlides(d.slides ?? []);
            setTitle(d.title);
            setOutline(d.outline ?? []);
          }
        } else if (data.status === "generating") {
          setDeck((prev) =>
            prev
              ? {
                  ...prev,
                  status: "generating",
                  slidesDone: data.slidesDone,
                  slidesTotal: data.slidesTotal,
                  slides: data.slides || prev.slides,
                }
              : null
          );
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Slide batch generation step network error:", err);
        if (retryCountRef.current < 3) {
          const delays = [2000, 5000, 10000];
          const delay = delays[retryCountRef.current] || 10000;
          retryCountRef.current += 1;
          console.warn(
            `[SlideGen] Network error, retrying in ${delay}ms (attempt ${retryCountRef.current}/3)…`
          );
          await new Promise((r) => setTimeout(r, delay));
          drivingSlideGenRef.current = false;
          if (isMounted) setRetryTrigger((prev) => prev + 1);
          return;
        }
        setBatchError("Network connection interrupted. Your progress is saved.");
      } finally {
        drivingSlideGenRef.current = false;
      }
    };

    driveNextSlideBatch();

    return () => {
      isMounted = false;
      drivingSlideGenRef.current = false;
    };
  }, [deckId, deck?.status, deck?.slidesDone, deck?.slides?.length, batchError, retryTrigger, fetchDeck]);

  // ── Generate slides ──────────────────────────────────────────────────────────

  const generateSlides = async () => {
    if (!deckId || !deck) return;
    if (saveStatus === "saving") await new Promise(r => setTimeout(r, 1000));

    setBatchError(null);
    setGeneratingInAnotherTab(false);
    retryCountRef.current = 0;
    inProgressCountRef.current = 0;
    drivingSlideGenRef.current = false;
    setDeck({ ...deck, status: "generating", error: "" });
    setViewMode("slides");
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

  // ── Undo & Canvas Editing ───────────────────────────────────────────────────
  const clientUndoStackRef = useRef<{ slides: ISlide[]; theme: string }[]>([]);

  const isInlineEditorFocused = () => {
    if (typeof document === "undefined") return false;
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName.toLowerCase();
    return (
      tag === "input" ||
      tag === "textarea" ||
      active.getAttribute("contenteditable") === "true" ||
      Boolean(active.closest("[contenteditable='true']"))
    );
  };

  const commitSlidesUpdate = useCallback(
    async (newSlides: ISlide[], actionToast?: string) => {
      if (!deckId) return;

      // Push current state to undo history
      clientUndoStackRef.current.push({
        slides: [...slidesRef.current],
        theme,
      });
      if (clientUndoStackRef.current.length > 10) {
        clientUndoStackRef.current.shift();
      }

      setSlides(newSlides);
      slidesRef.current = newSlides;

      setSaveStatus("saving");
      activeSaveCountRef.current++;

      try {
        const res = await fetch(`/api/decks/${deckId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slides: newSlides,
            expectedUpdatedAt: deckUpdatedAtRef.current,
            version: deckVersionRef.current,
          }),
        });

        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.updatedAt) deckUpdatedAtRef.current = data.updatedAt;
          if (data.version !== undefined) deckVersionRef.current = data.version;
          setSaveStatus("saved");
          if (actionToast) toast.success(actionToast);
          setTimeout(() => setSaveStatus("idle"), 1500);
        } else if (res.status === 409) {
          toast.error("Stale write detected. Deck has been modified elsewhere; reloading latest content.");
          const d = await fetchDeck(deckId);
          if (d) {
            setDeck(d);
            setSlides(d.slides ?? []);
            slidesRef.current = d.slides ?? [];
            if (d.updatedAt) deckUpdatedAtRef.current = d.updatedAt;
            if (d.version !== undefined) deckVersionRef.current = d.version;
          }
          setSaveStatus("idle");
        } else {
          const errData = await res.json().catch(() => ({}));
          toast.error(errData.error || "Failed to save slide update.");
          setSaveStatus("idle");
        }
      } catch (err: any) {
        toast.error(err?.message || "Network error while saving.");
        setSaveStatus("idle");
      } finally {
        activeSaveCountRef.current = Math.max(0, activeSaveCountRef.current - 1);
      }
    },
    [deckId, theme, fetchDeck]
  );

  const flushPendingReorder = useCallback(() => {
    reorderManagerRef.current?.flush();
  }, []);

  useEffect(() => {
    reorderManagerRef.current = new ReorderDebounceManager((slidesToCommit) => {
      commitSlidesUpdate(slidesToCommit);
    }, 500);

    const handleBeforeUnload = () => {
      reorderManagerRef.current?.flush();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      reorderManagerRef.current?.flush();
    };
  }, [commitSlidesUpdate]);

  const handleCanvasSlideChange = useCallback(
    (updatedSlide: ISlide) => {
      if (!deckId || !slides[activeSlideIdx]) return;
      flushPendingReorder();

      // Push current state to undo history
      clientUndoStackRef.current.push({
        slides: [...slides],
        theme,
      });
      if (clientUndoStackRef.current.length > 10) {
        clientUndoStackRef.current.shift();
      }

      const updated = [...slides];
      updated[activeSlideIdx] = updatedSlide;
      setSlides(updated);
      slidesRef.current = updated;

      setSaveStatus("saving");
      activeSaveCountRef.current++;
      fetch(`/api/decks/${deckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slideIndex: activeSlideIdx,
          slide: updatedSlide,
          expectedUpdatedAt: deckUpdatedAtRef.current,
          version: deckVersionRef.current,
        }),
      })
        .then(async (r) => {
          if (r.ok) {
            const data = await r.json().catch(() => ({}));
            if (data.updatedAt) deckUpdatedAtRef.current = data.updatedAt;
            if (data.version !== undefined) deckVersionRef.current = data.version;
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus("idle"), 1500);
          } else if (r.status === 409) {
            toast.error("Stale write detected. Deck has been modified elsewhere; reloading latest content.");
            const d = await fetchDeck(deckId);
            if (d) {
              setDeck(d);
              setSlides(d.slides ?? []);
              slidesRef.current = d.slides ?? [];
              if (d.updatedAt) deckUpdatedAtRef.current = d.updatedAt;
              if (d.version !== undefined) deckVersionRef.current = d.version;
            }
            setSaveStatus("idle");
          } else {
            setSaveStatus("idle");
          }
        })
        .catch(() => setSaveStatus("idle"))
        .finally(() => {
          activeSaveCountRef.current = Math.max(0, activeSaveCountRef.current - 1);
        });
    },
    [deckId, slides, activeSlideIdx, theme, fetchDeck]
  );

  const handleAddSlide = (layout: string) => {
    flushPendingReorder();
    if (slides.length >= MAX_DECK_SLIDES) {
      toast.error(`Deck cannot exceed maximum of ${MAX_DECK_SLIDES} slides.`);
      return;
    }
    const newSlide = createDefaultSlide(layout);
    const updated = [...slides];
    const insertIdx = activeSlideIdx + 1 <= updated.length ? activeSlideIdx + 1 : updated.length;
    updated.splice(insertIdx, 0, newSlide as any);
    setActiveSlideIdx(insertIdx);
    setShowAddSlideMenu(false);
    setReorderAnnouncement(`Added ${layout} slide at position ${insertIdx + 1} of ${updated.length}`);
    commitSlidesUpdate(updated, "New slide added.");
  };

  const handleDuplicateSlide = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    flushPendingReorder();
    try {
      const { updated, newIndex } = duplicateSlide(slides as any, idx);
      setActiveSlideIdx(newIndex);
      setReorderAnnouncement(`Duplicated slide to position ${newIndex + 1} of ${updated.length}`);
      commitSlidesUpdate(updated as any, "Slide duplicated.");
    } catch (err: any) {
      toast.error(err.message || "Failed to duplicate slide.");
    }
  };

  const handleDeleteSlide = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    flushPendingReorder();
    try {
      const { updated, newIndex } = deleteSlide(slides as any, idx);
      setActiveSlideIdx(newIndex);
      setReorderAnnouncement(`Deleted slide. Active slide is now position ${newIndex + 1} of ${updated.length}`);
      commitSlidesUpdate(updated as any, "Slide deleted.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete slide.");
    }
  };

  const handleLayoutSwitch = (targetLayout: string) => {
    flushPendingReorder();
    const current = slides[activeSlideIdx];
    if (!current || current.layout === targetLayout) return;
    const switched = switchSlideLayout(current as any, targetLayout);
    const updated = [...slides];
    updated[activeSlideIdx] = switched as any;
    commitSlidesUpdate(updated, `Switched layout to ${targetLayout.replace("_", " ")}.`);
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragOverIdx !== idx) {
      setDragOverIdx(idx);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    flushPendingReorder();
    const sourceIdx = draggedIdx;
    setDraggedIdx(null);
    setDragOverIdx(null);
    if (sourceIdx === null || sourceIdx === targetIdx) return;

    const reordered = reorderSlides(slides as any, sourceIdx, targetIdx);
    setActiveSlideIdx(targetIdx);
    setReorderAnnouncement(`Moved slide to position ${targetIdx + 1} of ${reordered.length}`);
    commitSlidesUpdate(reordered as any);
  };

  const handleMoveSlide = useCallback(
    (fromIdx: number, toIdx: number) => {
      if (toIdx < 0 || toIdx >= slidesRef.current.length || fromIdx === toIdx) return;
      const reordered = reorderSlides(slidesRef.current as any, fromIdx, toIdx);
      setSlides(reordered as any);
      slidesRef.current = reordered as any;
      setActiveSlideIdx(toIdx);
      setReorderAnnouncement(`Moved slide to position ${toIdx + 1} of ${reordered.length}`);

      // Debounce commit (~500ms) for keyboard accessibility
      reorderManagerRef.current?.schedule(reordered as any);
    },
    []
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      if (isInlineEditorFocused()) return;

      e.preventDefault();
      const currentIdx = activeSlideIdx;
      const targetIdx = e.key === "ArrowUp" ? currentIdx - 1 : currentIdx + 1;
      handleMoveSlide(currentIdx, targetIdx);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSlideIdx, handleMoveSlide]);

  const handleUndo = async () => {
    if (!deckId) return;
    flushPendingReorder();
    // If we have a local client snapshot, restore it immediately for instant responsiveness
    if (clientUndoStackRef.current.length > 0) {
      const prev = clientUndoStackRef.current.pop()!;
      setSlides(prev.slides);
      setTheme(prev.theme);
      slidesRef.current = prev.slides;
      toast.success("Change undone.");
      if (deckId) {
        fetch(`/api/decks/${deckId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slides: prev.slides,
            theme: prev.theme,
            expectedUpdatedAt: deckUpdatedAtRef.current,
            version: deckVersionRef.current,
          }),
        })
          .then(async (r) => {
            if (r.ok) {
              const data = await r.json().catch(() => ({}));
              if (data.updatedAt) deckUpdatedAtRef.current = data.updatedAt;
              if (data.version !== undefined) deckVersionRef.current = data.version;
            } else if (r.status === 409) {
              toast.error("Stale write detected. Reloading latest content.");
              const d = await fetchDeck(deckId);
              if (d) {
                setDeck(d);
                setSlides(d.slides ?? []);
                slidesRef.current = d.slides ?? [];
              }
            }
          })
          .catch(() => {});
      }
      return;
    }

    try {
      const res = await fetch(`/api/decks/${deckId}/undo`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSlides(data.slides);
      setTheme(data.theme);
      slidesRef.current = data.slides;
      const refreshed = await fetchDeck(deckId);
      if (refreshed) {
        if (refreshed.updatedAt) deckUpdatedAtRef.current = refreshed.updatedAt;
        if (refreshed.version !== undefined) deckVersionRef.current = refreshed.version;
      }
      toast.success("Change undone.");
    } catch (err: any) {
      toast.error(err.message || "Undo failed.");
    }
  };

  // ── Present Mode & Fullscreen Sync ──────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, []);

  const handleEnterPresentMode = async () => {
    flushPendingReorder();
    if (pendingNotesSaveRef.current) {
      await flushPendingNotes();
    }
    setIsPresenting(true);
    try {
      if (typeof document !== "undefined" && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Inline fullscreen fallback
    }
  };

  const handleExitPresentMode = useCallback(() => {
    if (typeof document !== "undefined" && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    setIsPresenting(false);
  }, []);

  // Sync fullscreen state
  useEffect(() => {
    const onFullscreenChange = () => {
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
      if (!fs && isPresenting) {
        setIsPresenting(false);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [isPresenting]);

  // Lock body scroll while presenting
  useEffect(() => {
    if (!isPresenting) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isPresenting]);

  useEffect(() => {
    if (!isPresenting) return;
    const handlePresentKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown" || e.key === "Enter") {
        e.preventDefault();
        setActiveSlideIdx((prev) => Math.min(slides.length - 1, prev + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp" || e.key === "Backspace") {
        e.preventDefault();
        setActiveSlideIdx((prev) => Math.max(0, prev - 1));
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleExitPresentMode();
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        setShowSpeakerNotesInPresent((prev) => !prev);
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handlePresentKeyDown);
    return () => window.removeEventListener("keydown", handlePresentKeyDown);
  }, [isPresenting, slides.length, handleExitPresentMode, toggleFullscreen]);

  // ── Share Link Toggle ────────────────────────────────────────────────────────
  const handleToggleShare = async () => {
    if (!deckId || shareLoading) return;
    setShareLoading(true);
    try {
      if (deck?.share?.enabled) {
        // Revoke
        const res = await fetch(`/api/decks/${deckId}/share`, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to revoke share link.");
        setDeck((prev) => (prev ? { ...prev, share: { enabled: false } } : null));
        toast.success("Share link revoked. Access has been removed immediately.");
      } else {
        // Enable with brand-new slug
        const res = await fetch(`/api/decks/${deckId}/share`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to generate share link.");
        setDeck((prev) => (prev ? { ...prev, share: { enabled: true, slug: data.slug } } : null));
        toast.success("Public share link created!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update share settings.");
    } finally {
      setShareLoading(false);
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
      if (data.note) {
        setRegenNote(data.note);
        toast.info(data.note, { duration: 6000 });
      } else {
        setRegenNote(null);
        toast.success("Slide regenerated!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to regenerate slide.");
    } finally {
      setRegenerating(false);
    }
  };

  const updateCurrentSlide = async (patch: Partial<ISlide>) => {
    if (!deckId || !slides[activeSlideIdx]) return;
    const updated = [...slides];
    updated[activeSlideIdx] = { ...updated[activeSlideIdx], ...patch } as ISlide;
    setSlides(updated);
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/decks/${deckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slides: updated }),
      });
      if (res.ok) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      } else {
        const errData = await res.json().catch(() => null);
        if (errData?.error) {
          toast.error(errData.error);
        }
        setSaveStatus("idle");
      }
    } catch {
      setSaveStatus("idle");
    }
  };

  // ── Speaker notes editing & autosave ─────────────────────────────────────────
  const [notesText, setNotesText] = useState("");
  const [isNotesFocused, setIsNotesFocused] = useState(false);
  const lastSyncedSlideIdRef = useRef<string | null>(null);
  const prevActiveSlideIdRef = useRef<string | null>(null);
  const pendingNotesSaveRef = useRef<{ slideId: string; notes: string } | null>(null);
  const notesSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const slidesRef = useRef(slides);
  slidesRef.current = slides;

  const flushPendingNotes = useCallback(async () => {
    if (notesSaveTimeoutRef.current) {
      clearTimeout(notesSaveTimeoutRef.current);
      notesSaveTimeoutRef.current = null;
    }
    const pending = pendingNotesSaveRef.current;
    if (!pending || !pending.slideId) return;

    pendingNotesSaveRef.current = null;

    const currentSlides = slidesRef.current;
    const { updatedSlides, updated } = applyNotesUpdate(
      currentSlides,
      pending.slideId,
      pending.notes
    );

    if (!updated || !deckId) return;

    setSlides(updatedSlides);
    slidesRef.current = updatedSlides;
    setSaveStatus("saving");
    activeSaveCountRef.current++;

    try {
      const res = await fetch(`/api/decks/${deckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slides: updatedSlides,
          expectedUpdatedAt: deckUpdatedAtRef.current,
          version: deckVersionRef.current,
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.updatedAt) deckUpdatedAtRef.current = data.updatedAt;
        if (data.version !== undefined) deckVersionRef.current = data.version;
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      } else if (res.status === 409) {
        toast.error("Stale write detected. Deck has been modified elsewhere; reloading latest content.");
        const d = await fetchDeck(deckId);
        if (d) {
          setDeck(d);
          setSlides(d.slides ?? []);
          slidesRef.current = d.slides ?? [];
          if (d.updatedAt) deckUpdatedAtRef.current = d.updatedAt;
          if (d.version !== undefined) deckVersionRef.current = d.version;
        }
        setSaveStatus("idle");
      } else {
        const errData = await res.json().catch(() => null);
        if (errData?.error) {
          toast.error(errData.error);
        }
        setSaveStatus("idle");
      }
    } catch {
      setSaveStatus("idle");
    } finally {
      activeSaveCountRef.current = Math.max(0, activeSaveCountRef.current - 1);
    }
  }, [deckId]);

  // Sync from props only when the slide id changes or the textarea is not focused;
  // flush pending notes if active slide changes.
  useEffect(() => {
    const currentSlide = slides[activeSlideIdx];
    const currentSlideId = currentSlide?.id;

    if (prevActiveSlideIdRef.current && prevActiveSlideIdRef.current !== currentSlideId) {
      if (pendingNotesSaveRef.current && pendingNotesSaveRef.current.slideId === prevActiveSlideIdRef.current) {
        flushPendingNotes();
      }
    }
    prevActiveSlideIdRef.current = currentSlideId || null;

    const shouldSync = shouldSyncNotesFromProps({
      currentSlideId,
      lastSyncedSlideId: lastSyncedSlideIdRef.current || undefined,
      isTextareaFocused: isNotesFocused,
    });

    if (shouldSync) {
      setNotesText(currentSlide?.notes || "");
      lastSyncedSlideIdRef.current = currentSlideId || null;
    }
  }, [activeSlideIdx, slides[activeSlideIdx]?.id, slides[activeSlideIdx]?.notes, isNotesFocused, flushPendingNotes]);

  useEffect(() => {
    return () => {
      if (notesSaveTimeoutRef.current) clearTimeout(notesSaveTimeoutRef.current);
      flushPendingNotes();
    };
  }, [flushPendingNotes]);

  const handleNotesChange = (val: string) => {
    const currentSlideId = slides[activeSlideIdx]?.id;
    setNotesText(val);

    if (!currentSlideId) return;

    // Capture slide id when typing starts
    pendingNotesSaveRef.current = { slideId: currentSlideId, notes: val };

    if (notesSaveTimeoutRef.current) {
      clearTimeout(notesSaveTimeoutRef.current);
    }
    notesSaveTimeoutRef.current = setTimeout(() => {
      flushPendingNotes();
    }, 600);
  };

  const handleNotesFocus = () => {
    setIsNotesFocused(true);
  };

  const handleNotesBlur = () => {
    setIsNotesFocused(false);
    flushPendingNotes();
  };

  const handleSearchImages = async (q: string) => {
    if (!q.trim()) return;
    setImageSearching(true);
    try {
      const res = await fetch(`/api/images/search?query=${encodeURIComponent(q)}&perPage=6`);
      const data = await res.json();
      if (data.images) {
        setImageSearchResults(data.images);
      }
    } catch (err) {
      console.error("Image search failed:", err);
    } finally {
      setImageSearching(false);
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
    return <DeckEditorSkeleton />;
  }

  const isOutlining = deck.status === "outlining";
  const isGenerating = deck.status === "generating";
  const isFailed = deck.status === "failed";
  const canGenerate = (deck.status === "outlined" || deck.status === "ready") && outline.length > 0;

  return (
    <div className="flex flex-col h-[calc(100dvh-120px)] md:h-[calc(100vh-120px)] min-h-0">
      {/* Header row */}
      <div className="flex flex-col gap-2.5 shrink-0 mb-3 w-full">
        {/* Title & Save status */}
        <div className="flex items-center justify-between gap-2 min-w-0 w-full">
          <input
            type="text"
            value={title}
            title={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isOutlining || isGenerating}
            className="flex-1 min-w-0 max-w-xl truncate text-ellipsis rounded-xl border border-transparent bg-transparent px-2 py-1 text-xl md:text-2xl font-extrabold text-[#101A3A] [font-family:var(--font-display)] outline-none transition hover:border-[#101A3A]/15 focus:border-[#2F5BFF] focus:ring-2 focus:ring-[#2F5BFF]/15 focus:bg-white disabled:opacity-60"
          />
          {/* Save indicator */}
          <div className="flex h-8 items-center text-xs text-[#5a6384] shrink-0">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> <span className="hidden sm:inline">Saving…</span>
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1.5 text-emerald-600">
                <Check size={12} /> <span className="hidden sm:inline">Saved</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Controls & Buttons: Wrap cleanly on small screens */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 w-full">
          {/* Left group: Privacy source text + Outline/Slides toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Privacy: Source Text Deletion */}
            {deck.hasSourceText ? (
              <button
                onClick={handleDeleteSourceText}
                disabled={deletingSource || isOutlining}
                title="Permanently delete uploaded source document text from server now"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#101A3A]/15 bg-white text-xs font-semibold text-[#5a6384] hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition shadow-sm disabled:opacity-50"
              >
                {deletingSource ? (
                  <Loader2 size={13} className="animate-spin text-red-500" />
                ) : (
                  <ShieldCheck size={13} className="text-emerald-600" />
                )}
                <span className="hidden sm:inline">Delete source text now</span>
                <span className="sm:hidden">Delete text</span>
              </button>
            ) : (
              <span
                title="Uploaded document and source text have been permanently deleted"
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200"
              >
                <ShieldCheck size={12} className="text-emerald-600" /> <span className="hidden sm:inline">Source text deleted</span><span className="sm:hidden">Deleted</span>
              </span>
            )}

            {/* View Toggle */}
            {(deck.status === "outlined" || deck.status === "ready" || isGenerating) && (
              <div className="flex bg-[#101A3A]/5 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode("outline")}
                  className={clsx(
                    "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition",
                    viewMode === "outline" ? "bg-white text-[#101A3A] shadow-sm" : "text-[#5a6384]"
                  )}
                >
                  <ListOrdered size={15} /> Outline
                </button>
                <button
                  onClick={() => setViewMode("slides")}
                  disabled={slides.length === 0 && !isGenerating}
                  className={clsx(
                    "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition",
                    viewMode === "slides" ? "bg-white text-[#101A3A] shadow-sm" : "text-[#5a6384] disabled:opacity-50"
                  )}
                >
                  <PlaySquare size={15} /> Slides
                </button>
              </div>
            )}
          </div>

          {/* Right group: Actions (Generate Slides in outline mode, or Export/Present/Share in slides mode) */}
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {canGenerate && viewMode === "outline" && (
              <button
                onClick={generateSlides}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#101A3A] px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-[#1d2c5e] transition shadow-md w-full sm:w-auto"
              >
                <Wand2 size={15} /> Generate Slides (1 credit)
              </button>
            )}

            {viewMode === "slides" && slides.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                <button
                  onClick={async () => {
                    if (!deckId || isExporting) return;
                    setIsExporting(true);
                    const toastId = toast.loading("Saving changes and preparing PowerPoint export...");
                    try {
                      // Ensure export waits for pending speaker notes or canvas saves
                      if (pendingNotesSaveRef.current) {
                        await flushPendingNotes();
                      }

                      let waitAttempts = 0;
                      while ((activeSaveCountRef.current > 0 || saveStatus === "saving") && waitAttempts < 25) {
                        await new Promise((r) => setTimeout(r, 200));
                        waitAttempts++;
                      }

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
                      toast.success("PowerPoint presentation downloaded!", { id: toastId });
                    } catch (err: any) {
                      toast.error(err.message || "Failed to export presentation.", { id: toastId });
                    } finally {
                      setIsExporting(false);
                    }
                  }}
                  disabled={isExporting}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl bg-[#2F5BFF] px-3.5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#2548cc] disabled:opacity-60 transition shadow-sm"
                >
              {isExporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Exporting...
                </>
              ) : (
                <>
                  <Download size={16} /> Download PPTX
                </>
              )}
            </button>
            <button
              onClick={async () => {
                if (!deckId || isExportingPdf || isExporting) return;
                setIsExportingPdf(true);
                const toastId = toast.loading("Rendering presentation and generating PDF...");
                try {
                  if (pendingNotesSaveRef.current) {
                    await flushPendingNotes();
                  }

                  let waitAttempts = 0;
                  while ((activeSaveCountRef.current > 0 || saveStatus === "saving") && waitAttempts < 25) {
                    await new Promise((r) => setTimeout(r, 200));
                    waitAttempts++;
                  }

                  const res = await fetch(`/api/decks/${deckId}/export/pdf`, {
                    method: "POST",
                  });
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || "Failed to generate PDF");
                  }
                  const blob = await res.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  const cd = res.headers.get("Content-Disposition");
                  let filename = "Presentation.pdf";
                  if (cd) {
                    const match = cd.match(/filename="([^"]+)"/);
                    if (match) filename = match[1];
                  }
                  a.download = filename;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  window.URL.revokeObjectURL(url);
                  toast.success("PDF document downloaded!", { id: toastId });
                } catch (err: any) {
                  toast.error(err.message || "Failed to export PDF.", { id: toastId });
                } finally {
                  setIsExportingPdf(false);
                }
              }}
              disabled={isExportingPdf || isExporting}
              title="Export as PDF Document"
              aria-label="Export PDF"
              className="flex items-center gap-1.5 rounded-xl border border-[#101A3A]/15 bg-white px-3.5 py-2 text-sm font-semibold text-[#101A3A] hover:bg-[#F4F6FB] disabled:opacity-60 transition shadow-sm"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 size={16} className="animate-spin text-[#2F5BFF]" /> Generating PDF...
                </>
              ) : (
                <>
                  <FileText size={16} className="text-[#2F5BFF]" /> Export PDF
                </>
              )}
            </button>
            <button
              onClick={handleEnterPresentMode}
              title="Present Fullscreen"
              aria-label="Present Fullscreen"
              className="flex items-center gap-1.5 rounded-xl border border-[#101A3A]/15 bg-white px-3.5 py-2 text-sm font-semibold text-[#101A3A] hover:bg-[#F4F6FB] transition shadow-sm"
            >
              <PlaySquare size={16} className="text-[#2F5BFF]" /> Present
            </button>
            <button
              onClick={() => setShowShareModal(true)}
              title="Share Presentation"
              aria-label="Share Presentation"
              className="flex items-center gap-1.5 rounded-xl border border-[#101A3A]/15 bg-white px-3.5 py-2 text-sm font-semibold text-[#101A3A] hover:bg-[#F4F6FB] transition shadow-sm"
            >
              <Share2 size={16} className="text-[#2F5BFF]" /> Share
            </button>
          </div>
        )}
      </div>
    </div>
  </div>

      {/* Status banners */}
      {isOutlining && (
        <div className="flex items-center gap-3 rounded-xl border border-[#2F5BFF]/20 bg-[#2F5BFF]/5 px-4 py-3 text-sm text-[#2F5BFF] mb-6">
          <Loader2 size={16} className="animate-spin shrink-0" />
          {deck.outlineProgress && deck.outlineProgress.chunksTotal > 1 ? (
            <span>
              Reading pages {deck.outlineProgress.currentPageRange || `chunk ${deck.outlineProgress.chunksDone + 1}`} (chunk{" "}
              {Math.min(deck.outlineProgress.chunksDone + 1, deck.outlineProgress.chunksTotal)} of{" "}
              {deck.outlineProgress.chunksTotal})… synthesizing presentation outline.
            </span>
          ) : (
            <span>Generating your outline with AI… this takes about 10 seconds.</span>
          )}
        </div>
      )}

      {outlineError && isOutlining && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-6">
          <div className="flex items-center gap-2.5 text-sm text-amber-800">
            <AlertCircle size={16} className="shrink-0 text-amber-600" />
            <span>{outlineError}</span>
          </div>
          <button
            onClick={() => {
              setOutlineError(null);
              outlineRetryCountRef.current = 0;
              drivingOutlineRef.current = false;
              setRetryTrigger((prev) => prev + 1);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F5BFF] text-white text-xs font-semibold hover:bg-[#2548cc] transition shadow-sm"
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {isGenerating && (
        <div className="flex items-center gap-3 rounded-xl border border-[#2F5BFF]/20 bg-[#2F5BFF]/5 px-4 py-3 text-sm text-[#2F5BFF] mb-6">
          <Loader2 size={16} className="animate-spin shrink-0" />
          <span>
            {generatingInAnotherTab
              ? "Generating in another tab or window…"
              : `Generating slide ${Math.min((deck.slidesDone ?? slides.length) + 1, deck.slidesTotal || outline.length || 1)} of ${deck.slidesTotal || outline.length || 1}…`}
          </span>
        </div>
      )}

      {batchError && isGenerating && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-6">
          <div className="flex items-center gap-2.5 text-sm text-amber-800">
            <AlertCircle size={16} className="shrink-0 text-amber-600" />
            <span>{batchError}</span>
          </div>
          <button
            onClick={() => {
              setBatchError(null);
              retryCountRef.current = 0;
              drivingSlideGenRef.current = false;
              setRetryTrigger((prev) => prev + 1);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F5BFF] text-white text-xs font-semibold hover:bg-[#2548cc] transition shadow-sm"
          >
            <RefreshCw size={13} /> Retry
          </button>
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
          <div className="absolute inset-0 flex flex-col lg:flex-row lg:gap-6 min-h-0">
            {/* Mobile Sub-Navigation Tabs */}
            <div className="lg:hidden flex items-center justify-around bg-white border border-[#101A3A]/10 rounded-xl p-1 mb-2.5 shrink-0 shadow-sm">
              <button
                onClick={() => setMobileTab("canvas")}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition",
                  mobileTab === "canvas" ? "bg-[#2F5BFF] text-white shadow-sm" : "text-[#5a6384] hover:bg-[#F4F6FB]"
                )}
              >
                <PlaySquare size={13} /> Slide
              </button>
              <button
                onClick={() => setMobileTab("slides")}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition",
                  mobileTab === "slides" ? "bg-[#2F5BFF] text-white shadow-sm" : "text-[#5a6384] hover:bg-[#F4F6FB]"
                )}
              >
                <ListOrdered size={13} /> Slides ({slides.length})
              </button>
              <button
                onClick={() => { setMobileTab("edit"); setPanelTab("edit"); }}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition",
                  mobileTab === "edit" ? "bg-[#2F5BFF] text-white shadow-sm" : "text-[#5a6384] hover:bg-[#F4F6FB]"
                )}
              >
                <Settings2 size={13} /> Edit
              </button>
              <button
                onClick={() => { setMobileTab("chat"); setPanelTab("chat"); }}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition",
                  mobileTab === "chat" ? "bg-[#2F5BFF] text-white shadow-sm" : "text-[#5a6384] hover:bg-[#F4F6FB]"
                )}
              >
                <MessageSquare size={13} /> AI Chat
              </button>
            </div>
            
            {/* Left Rail: Thumbnails */}
            <div className={clsx(
              "w-full lg:w-56 shrink-0 flex-col h-full min-h-0 bg-white/70 lg:bg-transparent rounded-2xl lg:rounded-none p-3 lg:p-0 border border-[#101A3A]/10 lg:border-none",
              mobileTab === "slides" ? "flex" : "hidden lg:flex"
            )}>
              {/* Accessible Live Region for Reorder Announcements */}
              <div className="sr-only" aria-live="polite" aria-atomic="true">
                {reorderAnnouncement}
              </div>

              {/* Rail Header with Add Slide Button (Pinned at top, outside scroll container) */}
              <div className="relative z-30 flex items-center justify-between pb-2 mb-2 border-b border-[#101A3A]/10 shrink-0">
                <span className="text-[11px] font-bold text-[#5a6384] uppercase tracking-wider">
                  Slides ({slides.length}/{MAX_DECK_SLIDES})
                </span>
                <div className="relative" ref={addSlideMenuRef}>
                  <button
                    onClick={() => setShowAddSlideMenu((prev) => !prev)}
                    disabled={isGenerating || isOutlining || slides.length >= MAX_DECK_SLIDES}
                    aria-label="Add new slide"
                    aria-expanded={showAddSlideMenu}
                    aria-haspopup="true"
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-[#2F5BFF] text-white rounded-md shadow-sm hover:bg-[#2548cc] active:scale-95 transition disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#2F5BFF] focus-visible:outline-none"
                  >
                    <Plus size={13} /> Add
                  </button>

                  {/* Layout Picker Dropdown */}
                  {showAddSlideMenu && (
                    <div className="absolute right-0 mt-1.5 w-52 bg-white border border-[#101A3A]/15 rounded-xl shadow-2xl z-50 py-1.5 flex flex-col animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/5">
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#5a6384] border-b border-[#101A3A]/10 flex items-center justify-between">
                        <span>Choose Layout</span>
                        <span className="text-[9px] font-normal lowercase text-[#9aa3bf]">esc</span>
                      </div>
                      <div className="max-h-72 overflow-y-auto py-1">
                        {LAYOUT_OPTIONS.map((item) => (
                          <button
                            key={item.value}
                            onClick={() => {
                              handleAddSlide(item.value);
                              setMobileTab("canvas");
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-[#101A3A] hover:bg-[#F4F6FB] hover:text-[#2F5BFF] transition flex items-center justify-between font-medium group"
                          >
                            <span>{item.label}</span>
                            <span className="text-[10px] text-[#9aa3bf] group-hover:text-[#2F5BFF]/70 truncate max-w-[90px] text-right">
                              {item.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Scrollable Thumbnails Container */}
              <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pr-2 pb-10">

              {slides.map((slide, idx) => (
                <div
                  key={slide?.id || idx}
                  draggable={!isGenerating && !isOutlining && Boolean(slide)}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  className={clsx(
                    "relative group rounded-lg transition",
                    dragOverIdx === idx && "ring-2 ring-blue-500 scale-[1.02]"
                  )}
                >
                  <button
                    onClick={() => {
                      if (slide) {
                        setActiveSlideIdx(idx);
                        setMobileTab("canvas");
                      }
                    }}
                    aria-label={`Slide ${idx + 1} of ${slides.length}: ${slide?.title || "Untitled"}`}
                    className={clsx(
                      "w-full aspect-video rounded-lg overflow-hidden border-2 text-left transition relative block focus-visible:ring-2 focus-visible:ring-[#2F5BFF] focus-visible:outline-none",
                      activeSlideIdx === idx
                        ? "border-[#2F5BFF] ring-2 ring-[#2F5BFF]/20"
                        : "border-transparent hover:border-[#101A3A]/20"
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

                  {/* Thumbnail Action Buttons (Visible on hover or keyboard focus) */}
                  {slide && !isGenerating && !isOutlining && (
                    <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity bg-black/75 backdrop-blur-sm rounded-md p-0.5 z-20 shadow-md">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSlide(idx, idx - 1);
                        }}
                        disabled={idx === 0}
                        aria-label={`Move slide ${idx + 1} up`}
                        title="Move Up (Alt+Up)"
                        className="p-1 text-white/80 hover:text-white disabled:opacity-30 disabled:hover:text-white/80 focus-visible:ring-1 focus-visible:ring-white rounded"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSlide(idx, idx + 1);
                        }}
                        disabled={idx === slides.length - 1}
                        aria-label={`Move slide ${idx + 1} down`}
                        title="Move Down (Alt+Down)"
                        className="p-1 text-white/80 hover:text-white disabled:opacity-30 disabled:hover:text-white/80 focus-visible:ring-1 focus-visible:ring-white rounded"
                      >
                        <ChevronDown size={12} />
                      </button>
                      <button
                        onClick={(e) => handleDuplicateSlide(e, idx)}
                        disabled={slides.length >= MAX_DECK_SLIDES}
                        aria-label={`Duplicate slide ${idx + 1}`}
                        title="Duplicate Slide"
                        className="p-1 text-white/80 hover:text-white disabled:opacity-30 focus-visible:ring-1 focus-visible:ring-white rounded"
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteSlide(e, idx)}
                        disabled={slides.length <= 1}
                        aria-label={`Delete slide ${idx + 1}`}
                        title="Delete Slide"
                        className="p-1 text-red-300 hover:text-red-400 disabled:opacity-30 focus-visible:ring-1 focus-visible:ring-white rounded"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {isGenerating && (
                <div className="text-center text-xs text-[#5a6384] mt-2 flex items-center justify-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />{" "}
                  {generatingInAnotherTab
                    ? "Generating in another tab…"
                    : `Generating slide ${Math.min((deck.slidesDone ?? slides.length) + 1, deck.slidesTotal || outline.length || 1)} of ${deck.slidesTotal || outline.length || 1}`}
                </div>
              )}
              </div>
            </div>

            {/* Center Canvas */}
            <div className={clsx(
              "flex-1 flex-col min-h-0 bg-white/50 rounded-2xl border border-[#101A3A]/10 p-3 sm:p-6 relative",
              mobileTab === "canvas" ? "flex" : "hidden lg:flex"
            )}>
              {/* Mobile Slide Switcher Controls */}
              <div className="lg:hidden flex items-center justify-between bg-white border border-[#101A3A]/10 rounded-xl px-3 py-1.5 mb-2.5 shadow-sm shrink-0">
                <button
                  onClick={() => setActiveSlideIdx((i) => Math.max(0, i - 1))}
                  disabled={activeSlideIdx === 0}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-[#101A3A] hover:bg-[#F4F6FB] disabled:opacity-30"
                >
                  <ChevronLeft size={16} /> Prev
                </button>
                <span className="text-xs font-bold text-[#101A3A]">
                  Slide {activeSlideIdx + 1} of {slides.length}
                </span>
                <button
                  onClick={() => setActiveSlideIdx((i) => Math.min(slides.length - 1, i + 1))}
                  disabled={activeSlideIdx >= slides.length - 1}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-[#101A3A] hover:bg-[#F4F6FB] disabled:opacity-30"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>

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
                    <SlideRenderer
                      slide={slides[activeSlideIdx] as any}
                      theme={theme}
                      editable={!isGenerating && !isOutlining}
                      onSlideChange={handleCanvasSlideChange}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-[#5a6384]">
                    <Loader2 size={32} className="animate-spin mb-4" />
                    <p>
                      {generatingInAnotherTab
                        ? "Generating in another tab…"
                        : `Generating slide ${Math.min((deck.slidesDone ?? slides.length) + 1, deck.slidesTotal || outline.length || 1)} of ${deck.slidesTotal || outline.length || 1}…`}
                    </p>
                    {batchError && (
                      <button
                        onClick={() => {
                          setBatchError(null);
                          retryCountRef.current = 0;
                          drivingSlideGenRef.current = false;
                          setRetryTrigger((prev) => prev + 1);
                        }}
                        className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F5BFF] text-white text-xs font-semibold hover:bg-[#2548cc] transition shadow-sm"
                      >
                        <RefreshCw size={13} /> Resume Generation
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Controls & Chat */}
            <div className={clsx(
              "w-full lg:w-80 shrink-0 flex-col border border-[#101A3A]/10 rounded-2xl overflow-hidden bg-white shadow-sm min-h-0",
              (mobileTab === "edit" || mobileTab === "chat") ? "flex flex-1" : "hidden lg:flex"
            )}>
              
              {/* Tabs */}
              <div className="flex border-b border-[#101A3A]/10">
                <button
                  onClick={() => { setPanelTab("edit"); setMobileTab("edit"); }}
                  className={clsx(
                    "flex-1 py-3 text-sm font-semibold border-b-2 transition flex items-center justify-center gap-2",
                    panelTab === "edit" ? "border-[#2F5BFF] text-[#101A3A]" : "border-transparent text-[#5a6384] hover:text-[#101A3A]"
                  )}
                >
                  <Settings2 size={16} /> Edit
                </button>
                <button
                  onClick={() => { setPanelTab("chat"); setMobileTab("chat"); }}
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
                  {/* Template Switcher */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5a6384] mb-3">Template</h3>
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
                      {/* Layout Switcher */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label htmlFor="slide-layout-select" className="text-xs font-bold uppercase tracking-wider text-[#5a6384] flex items-center gap-1.5">
                            <Layout size={13} className="text-[#2F5BFF]" />
                            Slide Layout
                          </label>
                          <span className="text-[10px] text-[#5a6384] capitalize">
                            {slides[activeSlideIdx].layout?.replace("_", " ")}
                          </span>
                        </div>
                        <select
                          id="slide-layout-select"
                          value={slides[activeSlideIdx].layout}
                          onChange={(e) => handleLayoutSwitch(e.target.value)}
                          aria-label="Change layout of active slide"
                          className="w-full text-xs font-medium text-[#101A3A] bg-[#F4F6FB] p-2.5 rounded-lg border border-[#101A3A]/10 hover:border-[#2F5BFF]/50 focus:border-[#2F5BFF] focus:bg-white focus:outline-none transition cursor-pointer"
                        >
                          {LAYOUT_OPTIONS.map((lo) => (
                            <option key={lo.value} value={lo.value}>
                              {lo.label} — {lo.description}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5a6384]">Slide Notes</h3>
                          <span className="text-[10px] text-[#5a6384]">Autosaved</span>
                        </div>
                        <textarea
                          value={notesText}
                          onChange={(e) => handleNotesChange(e.target.value)}
                          onFocus={handleNotesFocus}
                          onBlur={handleNotesBlur}
                          placeholder="Add speaker notes for this slide..."
                          rows={4}
                          className="w-full text-sm text-[#101A3A] bg-[#F4F6FB] p-3 rounded-lg border border-transparent focus:border-[#2F5BFF] focus:bg-white focus:outline-none resize-y leading-relaxed transition"
                        />
                        {(() => {
                          const citation = buildSourceCitation(
                            deck?.sourceName,
                            slides[activeSlideIdx]?.sourcePage,
                            slides[activeSlideIdx]?.sourceSection,
                            slides[activeSlideIdx]?.sourcePageApprox
                          );
                          return citation ? (
                            <div className="mt-2 flex items-start gap-1.5 text-xs text-[#5a6384] bg-[#F4F6FB]/70 px-2.5 py-1.5 rounded border border-[#101A3A]/5">
                              <span className="font-semibold text-[#101A3A] shrink-0">Source:</span>
                              <span className="break-words">{citation.replace(/^Source:\s*/i, "")}</span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                      
                      {/* Image Controls for Supported Slides */}
                      {IMAGE_SUPPORTED_LAYOUTS.includes(slides[activeSlideIdx]?.layout) && (() => {
                        const currentLayout = slides[activeSlideIdx]?.layout;
                        const imgContent = (slides[activeSlideIdx]?.content || {}) as any;
                        const currentImgUrl = imgContent.imageUrl || "";
                        const currentPlacement =
                          imgContent.imagePlacement ||
                          (currentLayout === "title" || currentLayout === "closing"
                            ? "background"
                            : "right");
                        const currentVariant = imgContent.variant || "split";

                        return (
                          <div className="border-t border-[#101A3A]/10 pt-4">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-xs font-bold uppercase tracking-wider text-[#5a6384] flex items-center gap-1.5">
                                <ImageIcon size={14} /> Slide Image
                              </h3>
                              {currentImgUrl && (
                                currentLayout === "image" ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateCurrentSlide({
                                        content: {
                                          ...imgContent,
                                          variant: currentVariant === "full_bleed" ? "split" : "full_bleed",
                                        },
                                      })
                                    }
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#F4F6FB] hover:bg-[#101A3A]/5 text-[#5a6384] transition"
                                  >
                                    Style: {currentVariant === "full_bleed" ? "Full-bleed" : "Split"}
                                  </button>
                                ) : (currentLayout === "title" || currentLayout === "closing" || currentLayout === "quote") ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateCurrentSlide({
                                        content: {
                                          ...imgContent,
                                          imagePlacement: currentPlacement === "background" ? "right" : "background",
                                        },
                                      })
                                    }
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#F4F6FB] hover:bg-[#101A3A]/5 text-[#5a6384] transition"
                                  >
                                    Placement: {currentPlacement === "background" ? "Background" : "Right"}
                                  </button>
                                ) : null
                              )}
                            </div>

                            {/* Current Image Preview */}
                            {currentImgUrl ? (
                              <div className="relative rounded-lg overflow-hidden border border-[#101A3A]/10 mb-3 bg-[#F4F6FB] group">
                                <img
                                  src={currentImgUrl}
                                  alt={imgContent.imageAlt || imgContent.imageQuery || "Slide image"}
                                  className="w-full h-28 object-cover"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowImageSearch(true);
                                      const defaultQuery = imgContent.imageQuery || slides[activeSlideIdx]?.title || "";
                                      setImageSearchQuery(defaultQuery);
                                      if (defaultQuery) handleSearchImages(defaultQuery);
                                    }}
                                    className="bg-white text-xs font-semibold px-2.5 py-1 rounded shadow text-[#101A3A] hover:bg-[#F4F6FB]"
                                  >
                                    Swap
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateCurrentSlide({
                                        content: {
                                          ...imgContent,
                                          imageUrl: "",
                                          imageQuery: "",
                                          imagePlacement: "none",
                                          imageAlt: "",
                                          imageCaption: "",
                                          imageCredit: "",
                                          photographer: "",
                                          photographerUrl: "",
                                        },
                                      })
                                    }
                                    className="bg-red-500 text-xs font-semibold px-2 py-1 rounded shadow text-white hover:bg-red-600"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-dashed border-[#101A3A]/20 p-4 text-center mb-3">
                                <p className="text-xs text-[#5a6384] mb-2">No image on this slide</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowImageSearch(true);
                                    const defaultQuery = slides[activeSlideIdx]?.title || "";
                                    setImageSearchQuery(defaultQuery);
                                    if (defaultQuery) handleSearchImages(defaultQuery);
                                  }}
                                  className="bg-[#2F5BFF] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#2449d6]"
                                >
                                  Add Image
                                </button>
                              </div>
                            )}

                            {/* Search / Swap Panel */}
                            {showImageSearch && (
                              <div className="rounded-xl border border-[#2F5BFF]/30 bg-[#F4F6FB]/80 p-3 mb-3 flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-[#101A3A]">Search Stock Photos</span>
                                  <button
                                    type="button"
                                    onClick={() => setShowImageSearch(false)}
                                    className="text-[#5a6384] hover:text-[#101A3A] p-0.5"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>

                                <div className="flex gap-1.5">
                                  <input
                                    type="text"
                                    placeholder="e.g. technology, modern office..."
                                    value={imageSearchQuery}
                                    onChange={(e) => setImageSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleSearchImages(imageSearchQuery);
                                    }}
                                    className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-[#101A3A]/15 bg-white outline-none focus:border-[#2F5BFF]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSearchImages(imageSearchQuery)}
                                    disabled={imageSearching}
                                    className="px-2.5 py-1.5 bg-[#2F5BFF] text-white rounded-lg text-xs font-semibold hover:bg-[#2449d6] disabled:opacity-50 flex items-center justify-center"
                                  >
                                    {imageSearching ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                                  </button>
                                </div>

                                {/* Search results */}
                                {imageSearchResults.length > 0 && (
                                  <div className="grid grid-cols-3 gap-1.5 mt-1 max-h-40 overflow-y-auto pr-1">
                                    {imageSearchResults.map((img, i) => (
                                      <button
                                        key={i}
                                        type="button"
                                        onClick={() => {
                                          updateCurrentSlide({
                                            content: {
                                              ...imgContent,
                                              imageUrl: img.url,
                                              imageQuery: imageSearchQuery || img.alt || "",
                                              imagePlacement:
                                                currentPlacement === "none"
                                                  ? (currentLayout === "title" || currentLayout === "closing" ? "background" : "right")
                                                  : currentPlacement,
                                              imageAlt: img.alt || "Slide image",
                                              photographer: img.photographer,
                                              photographerUrl: img.photographerUrl,
                                              imageCredit: img.photographer ? `${img.photographer} via ${img.source}` : img.source,
                                            },
                                          });
                                          if (img.downloadLocation) {
                                            fetch("/api/images/track-download", {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({ downloadLocation: img.downloadLocation }),
                                            }).catch(() => {});
                                          }
                                          setShowImageSearch(false);
                                        }}
                                        className="aspect-video rounded overflow-hidden border border-transparent hover:border-[#2F5BFF] hover:ring-1 hover:ring-[#2F5BFF] transition relative group"
                                      >
                                        <img src={img.thumb || img.url} alt={img.alt} className="w-full h-full object-cover" />
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {/* Custom URL Option */}
                                <div className="pt-2 border-t border-[#101A3A]/10 flex flex-col gap-1">
                                  <span className="text-[10px] text-[#5a6384] font-medium">Or paste image URL:</span>
                                  <div className="flex gap-1.5">
                                    <input
                                      type="text"
                                      placeholder="https://images.unsplash.com/..."
                                      value={customImageUrl}
                                      onChange={(e) => setCustomImageUrl(e.target.value)}
                                      className="flex-1 text-xs px-2 py-1 rounded border border-[#101A3A]/15 bg-white outline-none focus:border-[#2F5BFF]"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (customImageUrl.trim()) {
                                          updateCurrentSlide({
                                            content: {
                                              ...imgContent,
                                              imageUrl: customImageUrl.trim(),
                                              imagePlacement:
                                                currentPlacement === "none"
                                                  ? (currentLayout === "title" || currentLayout === "closing" ? "background" : "right")
                                                  : currentPlacement,
                                              imageAlt: "Slide image",
                                            },
                                          });
                                          setCustomImageUrl("");
                                          setShowImageSearch(false);
                                        }
                                      }}
                                      disabled={!customImageUrl.trim()}
                                      className="px-2 py-1 bg-[#101A3A] text-white rounded text-xs font-semibold disabled:opacity-40"
                                    >
                                      Apply
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="border-t border-[#101A3A]/10 pt-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#5a6384] mb-2 flex items-center gap-1.5">
                          <Wand2 size={14} /> Regenerate Slide
                        </h3>
                        {regenNote && (
                          <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs flex items-start gap-2">
                            <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                            <span>{regenNote}</span>
                          </div>
                        )}
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
                        <p className="text-xs mt-1 opacity-70">"Add a title slide", "Shorten slide 3", "Change template to corporate"</p>
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

      {/* Fullscreen Present Mode Overlay (Portaled to document.body to escape layout overflow & stacking contexts) */}
      {typeof document !== "undefined" && isPresenting && createPortal(
        <div
          className="fixed inset-0 text-white flex flex-col justify-between overflow-hidden select-none"
          style={{ backgroundColor: "#070913", zIndex: 99999 }}
          data-testid="fullscreen-present-overlay"
        >
          {/* Top Floating Bar */}
          <header className="flex items-center justify-between px-6 py-3.5 bg-gradient-to-b from-black/85 via-black/50 to-transparent shrink-0 z-30">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs font-bold text-white/70 uppercase tracking-wider truncate max-w-sm sm:max-w-md">
                {title || "Presentation"}
              </span>
              <span className="text-xs bg-white/10 px-2.5 py-0.5 rounded-full text-white/80 shrink-0">
                {activeSlideIdx + 1} / {slides.length}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowSpeakerNotesInPresent((prev) => !prev)}
                className={clsx(
                  "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition",
                  showSpeakerNotesInPresent
                    ? "bg-[#2F5BFF] text-white border-[#2F5BFF]"
                    : "bg-white/10 text-white/80 border-transparent hover:bg-white/20"
                )}
                aria-label="Toggle speaker notes"
                title="Toggle speaker notes (S)"
              >
                <FileText size={14} /> Notes (S)
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition"
                aria-label={isFullscreen ? "Exit Fullscreen (F)" : "Enter Fullscreen (F)"}
                title={isFullscreen ? "Exit Fullscreen (F)" : "Enter Fullscreen (F)"}
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button
                onClick={handleExitPresentMode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white font-semibold text-xs transition shadow-sm"
                aria-label="Exit Present Mode (Esc)"
                title="Exit Present Mode (Esc)"
              >
                <X size={16} />
                <span>Exit</span>
              </button>
            </div>
          </header>

          {/* Slide Stage (Responsive 16:9, guaranteed to fit viewport without overflow) */}
          <main
            className="flex-1 flex items-center justify-center p-3 sm:p-6 min-h-0 overflow-hidden relative"
            onClick={() => setActiveSlideIdx((prev) => Math.min(slides.length - 1, prev + 1))}
          >
            <div
              className="aspect-video rounded-xl shadow-2xl overflow-hidden ring-1 ring-white/15 bg-white relative flex items-center justify-center cursor-pointer transition-transform duration-150"
              style={{
                maxHeight: "calc(100vh - 130px)",
                maxWidth: "min(100%, calc((100vh - 130px) * (16 / 9)))",
                width: "100%",
              }}
              title="Click slide to advance"
            >
              <SlideRenderer
                slide={slides[activeSlideIdx] as any}
                theme={theme}
                editable={false}
                className="w-full h-full pointer-events-none"
              />
            </div>

            {/* Floating Speaker Notes Overlay */}
            {showSpeakerNotesInPresent && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-6 inset-x-4 mx-auto max-w-2xl p-4 rounded-xl bg-black/90 backdrop-blur-md border border-white/20 text-white/90 text-sm shadow-2xl z-30 max-h-44 overflow-y-auto animate-in fade-in slide-in-from-bottom-2"
              >
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1 flex items-center justify-between sticky top-0 bg-transparent">
                  <span>Speaker Notes</span>
                  <span className="text-[10px]">Press S to hide</span>
                </div>
                <p className="leading-relaxed whitespace-pre-line text-xs sm:text-sm">
                  {slides[activeSlideIdx]?.notes || "No notes for this slide."}
                </p>
              </div>
            )}
          </main>

          {/* Bottom Floating Bar */}
          <footer className="px-6 py-3.5 bg-gradient-to-t from-black/85 via-black/50 to-transparent flex items-center justify-between shrink-0 z-30">
            <div className="flex items-center gap-3">
              <div className="w-36 sm:w-48 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#2F5BFF] transition-all duration-300"
                  style={{ width: `${((activeSlideIdx + 1) / Math.max(1, slides.length)) * 100}%` }}
                />
              </div>
              <span className="text-xs text-white/70 font-semibold">
                {activeSlideIdx + 1} / {slides.length}
              </span>
              <span className="text-[11px] text-white/40 hidden sm:inline ml-2">
                Click slide or use &larr; &rarr; keys
              </span>
            </div>

            <div className="flex items-center gap-2.5 pr-12 sm:pr-6">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSlideIdx((prev) => Math.max(0, prev - 1));
                }}
                disabled={activeSlideIdx === 0}
                aria-label="Previous Slide (Left Arrow)"
                title="Previous Slide (Left Arrow)"
                className="flex items-center justify-center p-2.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 text-white transition focus:ring-2 focus:ring-blue-400"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSlideIdx((prev) => Math.min(slides.length - 1, prev + 1));
                }}
                disabled={activeSlideIdx === slides.length - 1}
                aria-label="Next Slide (Right Arrow)"
                title="Next Slide (Right Arrow)"
                className="flex items-center justify-center p-2.5 rounded-full bg-[#2F5BFF] hover:bg-[#2548cc] disabled:opacity-20 text-white transition shadow-lg focus:ring-2 focus:ring-blue-400"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </footer>
        </div>,
        document.body
      )}

      {/* Share Modal Dialog */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#101A3A]/10 p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#101A3A] font-bold text-base">
                <Share2 size={18} className="text-[#2F5BFF]" />
                Share Presentation
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-1 rounded-lg text-[#5a6384] hover:bg-[#F4F6FB]"
              >
                <X size={18} />
              </button>
            </div>

            {deck?.share?.enabled ? (
              <div className="flex flex-col gap-4">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Public sharing is active
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#5a6384] block mb-1.5">
                    Shareable Link
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={typeof window !== "undefined" ? `${window.location.origin}/p/${deck.share.slug}` : `/p/${deck.share.slug}`}
                      className="flex-1 text-xs bg-[#F4F6FB] border border-[#101A3A]/10 rounded-lg p-2.5 text-[#101A3A] select-all font-mono"
                    />
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/p/${deck.share?.slug}`;
                        navigator.clipboard.writeText(url);
                        toast.success("Link copied to clipboard!");
                      }}
                      className="px-3 py-2.5 bg-[#2F5BFF] hover:bg-[#2548cc] text-white text-xs font-semibold rounded-lg transition shrink-0"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <p className="text-xs text-[#5a6384] leading-relaxed">
                  Anyone with this link can view the slides in presentation mode. Speaker notes, source text, and revision history are never shared.
                </p>

                <div className="pt-2 border-t border-[#101A3A]/10 flex justify-end">
                  <button
                    onClick={handleToggleShare}
                    disabled={shareLoading}
                    className="px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    {shareLoading ? "Revoking…" : "Revoke Share Link"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-[#5a6384] leading-relaxed">
                  Create a public link to share this deck in presentation mode. Anyone with the link can view it without an account.
                </p>
                <div className="p-3 bg-[#F4F6FB] rounded-xl text-xs text-[#5a6384]">
                  🔒 <strong>Privacy Guarantee:</strong> Notes, uploaded source documents, and AI chat are completely excluded from the public view.
                </div>
                <div className="pt-2 border-t border-[#101A3A]/10 flex justify-end">
                  <button
                    onClick={handleToggleShare}
                    disabled={shareLoading}
                    className="px-4 py-2 bg-[#2F5BFF] hover:bg-[#2548cc] text-white text-xs font-semibold rounded-lg transition shadow-sm flex items-center gap-1.5"
                  >
                    {shareLoading ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                    Create Public Link
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
