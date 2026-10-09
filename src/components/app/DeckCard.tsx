"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, CheckCircle2, AlertCircle, Loader2, MoreVertical, Trash2, Download, Pen, Presentation } from "lucide-react";
import { clsx } from "clsx";
import type { DeckStatus } from "@/app/models/Deck";
import { themes } from "@/lib/themes";

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
  };
  onDelete?: (id: string) => void;
  onRename?: (id: string, newTitle: string) => void;
}

export default function DeckCard({ deck, onDelete, onRename }: DeckCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
    try {
      const res = await fetch(`/api/decks/${deck._id}/export`);
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
      setDownloading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    if (!confirm("Delete this deck? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/decks/${deck._id}`, { method: "DELETE" });
    if (onDelete) {
      onDelete(deck._id);
    } else {
      router.refresh();
    }
    setDeleting(false);
  };

  const handleRename = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    const newTitle = prompt("Enter new title:", deck.title);
    if (newTitle && newTitle.trim() !== "" && newTitle !== deck.title) {
      try {
        await fetch(`/api/decks/${deck._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle }),
        });
        if (onRename) {
          onRename(deck._id, newTitle);
        } else {
          router.refresh();
        }
      } catch (err) {
        alert("Failed to rename deck.");
      }
    }
  };

  return (
    <div className="relative group rounded-2xl border border-[#101A3A]/10 bg-white shadow-sm transition hover:border-[#2F5BFF]/30 hover:shadow-md">
      <Link href={`/decks/${deck._id}`} className="block p-5 outline-none focus-visible:ring-2 focus-visible:ring-[#2F5BFF] rounded-2xl">
        {/* Thumbnail Placeholder */}
        <div 
          className="mb-4 flex aspect-[4/3] w-full flex-col items-center justify-center rounded-xl bg-gradient-to-br from-[#F4F6FB] to-white border border-[#101A3A]/5 overflow-hidden relative shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]"
        >
          <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: themeColor }} />
          <Presentation size={36} className="text-[#101A3A]/20 mb-2" />
          <div className="h-1.5 w-12 rounded-full bg-[#101A3A]/10" />
          <div className="h-1.5 w-8 rounded-full bg-[#101A3A]/10 mt-1.5" />
        </div>

        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-bold text-[#101A3A] [font-family:var(--font-display)] leading-snug">
            {deck.title || "Untitled"}
          </h3>
        </div>
        
        <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-[#5a6384]">
          <span className="truncate max-w-[120px] uppercase tracking-wider">{deck.sourceName || "No Source"}</span>
          <span className="shrink-0">{date}</span>
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
              onClick={handleRename}
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
              onClick={handleDelete}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 transition"
            >
              <Trash2 size={14} className="text-red-500" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
