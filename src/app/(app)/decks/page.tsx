"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderOpen, Plus, Clock, CheckCircle2, AlertCircle, Loader2, Trash2, Download } from "lucide-react";
import { clsx } from "clsx";
import type { DeckStatus } from "@/app/models/Deck";
import { themes } from "@/lib/themes";

const STATUS_META: Record<DeckStatus, { label: string; color: string; Icon: React.ElementType }> = {
  draft:      { label: "Draft",      color: "text-[#5a6384] bg-[#F4F6FB]",    Icon: Clock },
  outlining:  { label: "Outlining",  color: "text-[#2F5BFF] bg-[#2F5BFF]/10", Icon: Loader2 },
  outlined:   { label: "Outlined",   color: "text-emerald-700 bg-emerald-50",  Icon: CheckCircle2 },
  generating: { label: "Generating", color: "text-amber-700 bg-amber-50",      Icon: Loader2 },
  ready:      { label: "Ready",      color: "text-emerald-700 bg-emerald-50",  Icon: CheckCircle2 },
  failed:     { label: "Failed",     color: "text-red-600 bg-red-50",          Icon: AlertCircle },
};

interface Deck {
  _id: string;
  title: string;
  status: DeckStatus;
  sourceName: string;
  theme: string;
  createdAt: string;
}

export default function DecksPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/decks")
      .then((r) => r.json())
      .then((d) => setDecks(d.decks ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm("Delete this deck? This cannot be undone.")) return;
    setDeleting(id);
    await fetch(`/api/decks/${id}`, { method: "DELETE" });
    setDecks((prev) => prev.filter((d) => d._id !== id));
    setDeleting(null);
  };

  const handleDownload = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setDownloading(id);
    try {
      const res = await fetch(`/api/decks/${id}/export`);
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
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[#5a6384]" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-[#101A3A] [font-family:var(--font-display)]">My Decks</h2>
          <p className="mt-1 text-sm text-[#5a6384]">{decks.length} deck{decks.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href="/decks/new"
          className="flex items-center gap-2 rounded-xl bg-[#2F5BFF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2449d6]"
        >
          <Plus size={16} /> New deck
        </Link>
      </div>

      {decks.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#101A3A]/5">
            <FolderOpen size={28} className="text-[#5a6384]" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[#101A3A] [font-family:var(--font-display)]">No decks yet</h3>
          <p className="mt-2 max-w-sm text-sm text-[#5a6384]">Create your first deck by uploading a PDF, DOCX, or pasting text.</p>
          <Link href="/decks/new" className="mt-6 rounded-xl bg-[#101A3A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1d2c5e]">
            Make your first deck
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => {
            const meta = STATUS_META[deck.status] ?? STATUS_META.draft;
            const { Icon } = meta;
            const themeColor = themes[deck.theme]?.colors.accent ?? "#2F5BFF";
            const date = new Date(deck.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
            return (
              <li key={deck._id} className="relative group">
                <Link
                  href={`/decks/${deck._id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-[#101A3A]/10 bg-white p-5 shadow-sm transition hover:border-[#2F5BFF]/30 hover:shadow-md"
                >
                  {/* Theme accent strip */}
                  <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: themeColor }} />

                  <div className="flex items-start justify-between gap-2 mt-1">
                    <h3 className="line-clamp-2 font-semibold text-[#101A3A] [font-family:var(--font-display)]">
                      {deck.title || "Untitled"}
                    </h3>
                    <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.color}`}>
                      <Icon size={10} className={clsx((deck.status === "outlining" || deck.status === "generating") && "animate-spin")} />
                      {meta.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#5a6384]">
                    <span className="truncate">{deck.sourceName || "—"}</span>
                    <span className="shrink-0">{date}</span>
                  </div>
                </Link>

                {/* Actions */}
                <div className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1">
                  {deck.status === "ready" && (
                    <button
                      onClick={(e) => handleDownload(deck._id, e)}
                      disabled={downloading === deck._id}
                      className="flex items-center justify-center h-7 w-7 rounded-lg bg-white border border-[#101A3A]/10 text-[#2F5BFF] hover:bg-[#F4F6FB] shadow-sm transition disabled:opacity-50"
                      title="Download PPTX"
                    >
                      {downloading === deck._id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(deck._id, e)}
                    disabled={deleting === deck._id}
                    className="flex items-center justify-center h-7 w-7 rounded-lg bg-white border border-red-200 text-red-500 hover:bg-red-50 shadow-sm transition disabled:opacity-50"
                    title="Delete deck"
                  >
                    {deleting === deck._id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
