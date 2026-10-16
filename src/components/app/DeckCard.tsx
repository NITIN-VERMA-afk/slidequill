"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, CheckCircle2, AlertCircle, Loader2, MoreVertical, Trash2, Download, Pen, Presentation } from "lucide-react";
import { clsx } from "clsx";
import type { DeckStatus } from "@/app/models/Deck";
import { themes } from "@/lib/themes";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  draft:      { label: "Draft",      color: "text-[#5a6384] bg-[#F4F6FB]",    Icon: Clock },
  outlining:  { label: "Outlining",  color: "text-[#2F5BFF] bg-[#2F5BFF]/10", Icon: Loader2 },
  outlined:   { label: "Outlined",   color: "text-emerald-700 bg-emerald-50",  Icon: CheckCircle2 },
  generating: { label: "Generating", color: "text-amber-700 bg-amber-50",      Icon: Loader2 },
  ready:      { label: "Ready",      color: "text-emerald-700 bg-emerald-50",  Icon: CheckCircle2 },
  failed:     { label: "Failed",     color: "text-red-600 bg-red-50",          Icon: AlertCircle },
};

interface DeckCardProps {
  deck: {
    _id: string;
    title: string;
    status: string;
    sourceName?: string;
    theme?: string;
    createdAt: string | Date;
    coverImage?: string | null;
    slideCount?: number;
  };
  onDelete?: (id: string) => void;
  onRename?: (id: string, newTitle: string) => void;
}

export default function DeckCard({ deck, onDelete, onRename }: DeckCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(deck.title);
  const [renaming, setRenaming] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const status = deck.status;
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  const { Icon } = meta;
  const themeColor = themes[deck.theme as string]?.colors?.accent ?? "#2F5BFF";
  const date = new Date(deck.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    setDownloading(true);
    const toastId = toast.loading("Preparing PowerPoint export...");
    try {
      const res = await fetch(`/api/decks/${deck._id}/export`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to export presentation.");
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
      toast.success("Presentation downloaded successfully!", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Failed to export presentation.", { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/decks/${deck._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete deck");
      toast.success("Deck deleted successfully");
      setDeleteOpen(false);
      if (onDelete) {
        onDelete(deck._id);
      } else {
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete deck");
    } finally {
      setDeleting(false);
    }
  };

  const handleRenameSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = editTitle.trim();
    if (!trimmed) {
      toast.error("Please enter a title for your presentation");
      return;
    }
    if (trimmed === deck.title) {
      setRenameOpen(false);
      return;
    }
    setRenaming(true);
    try {
      const res = await fetch(`/api/decks/${deck._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error("Failed to rename deck");
      toast.success("Deck renamed successfully");
      setRenameOpen(false);
      if (onRename) {
        onRename(deck._id, trimmed);
      } else {
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to rename deck");
    } finally {
      setRenaming(false);
    }
  };

  return (
    <div className="group relative flex h-full w-full flex-col justify-between rounded-2xl border border-[#101A3A]/10 bg-white shadow-sm transition hover:border-[#2F5BFF]/30 hover:shadow-md">
      <Link href={`/decks/${deck._id}`} className="flex flex-1 flex-col p-4 sm:p-5 outline-none focus-visible:ring-2 focus-visible:ring-[#2F5BFF] rounded-2xl">
        {/* Fixed Uniform Thumbnail Preview */}
        <div 
          className="relative mb-4 h-44 sm:h-48 w-full shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#101A3A]/5 to-[#F4F6FB] border border-[#101A3A]/10 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] group-hover:border-[#2F5BFF]/30 transition"
        >
          {deck.coverImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={deck.coverImage}
                alt={deck.title || "Deck preview"}
                className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10 pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-1.5 z-10" style={{ background: themeColor }} />
            </>
          ) : (
            <div 
              className="flex h-full w-full flex-col items-center justify-center p-4 text-center select-none"
              style={{
                background: `linear-gradient(135deg, ${themeColor}15 0%, #F4F6FB 100%)`
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: themeColor }} />
              <Presentation size={34} style={{ color: themeColor }} className="mb-2 opacity-80" />
              <p className="line-clamp-1 text-xs font-semibold text-[#101A3A]/70 max-w-[80%]">
                {deck.title || "Presentation"}
              </p>
              {Boolean(deck.slideCount) && (
                <span className="mt-1 text-[10px] font-medium text-[#5a6384]">
                  {deck.slideCount} slides
                </span>
              )}
            </div>
          )}
        </div>

        {/* Content with reserved height for title to guarantee all cards match */}
        <div className="flex flex-1 flex-col justify-between">
          <div className="min-h-[2.75rem] flex items-start">
            <h3 className="line-clamp-2 text-sm sm:text-base font-bold text-[#101A3A] [font-family:var(--font-display)] leading-snug">
              {deck.title || "Untitled"}
            </h3>
          </div>
          
          <div className="mt-3.5 flex items-center justify-between text-[11px] font-medium text-[#5a6384] pt-2.5 border-t border-[#101A3A]/5">
            <span className="truncate max-w-[130px] uppercase tracking-wider">{deck.sourceName || "No Source"}</span>
            <span className="shrink-0">{date}</span>
          </div>
        </div>
      </Link>

      {/* Status Badge - Floating */}
      <div className="absolute top-7 left-7">
        <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur-md bg-white/95 border border-[#101A3A]/5 ${meta.color}`}>
          <Icon size={12} className={clsx((status === "outlining" || status === "generating") && "animate-spin")} />
          {meta.label}
        </span>
      </div>

      {/* 3-Dot Menu */}
      <div className="absolute top-7 right-7" ref={menuRef}>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(!menuOpen); }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-sm backdrop-blur-md text-[#101A3A]/60 hover:text-[#101A3A] hover:bg-white border border-[#101A3A]/5 transition opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
          data-state={menuOpen ? "open" : "closed"}
        >
          {deleting || downloading ? <Loader2 size={16} className="animate-spin" /> : <MoreVertical size={16} />}
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-10 z-10 w-44 rounded-xl border border-[#101A3A]/10 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(false);
                setEditTitle(deck.title);
                setRenameOpen(true);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#101A3A] hover:bg-[#F4F6FB] transition"
            >
              <Pen size={14} className="text-[#5a6384]" /> Rename
            </button>
            {status === "ready" && (
              <button
                onClick={handleDownload}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#101A3A] hover:bg-[#F4F6FB] transition"
              >
                <Download size={14} className="text-[#5a6384]" /> Download
              </button>
            )}
            <div className="my-1 h-px bg-[#101A3A]/5" />
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(false);
                setDeleteOpen(true);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 transition"
            >
              <Trash2 size={14} className="text-red-500" /> Delete
            </button>
          </div>
        )}
      </div>

      {/* Rename Dialog Modal */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md bg-white border border-[#101A3A]/10 shadow-2xl">
          <form onSubmit={handleRenameSubmit}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#101A3A] [font-family:var(--font-display)]">
                Rename Presentation
              </DialogTitle>
              <DialogDescription className="text-sm text-[#5a6384]">
                Enter a new title for this presentation deck.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Presentation title"
                className="w-full text-sm"
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
                disabled={renaming}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#2F5BFF] text-white hover:bg-[#2449d6]"
                disabled={renaming}
              >
                {renaming ? <Loader2 size={16} className="animate-spin" /> : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md bg-white border border-[#101A3A]/10 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-600 [font-family:var(--font-display)]">
              Delete Presentation?
            </DialogTitle>
            <DialogDescription className="text-sm text-[#5a6384]">
              This action cannot be undone. Are you sure you want to permanently delete &ldquo;{deck.title}&rdquo;?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? <Loader2 size={16} className="animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
