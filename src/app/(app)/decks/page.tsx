"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderOpen, Plus, Clock, CheckCircle2, AlertCircle, Loader2, Trash2, Download } from "lucide-react";
import { clsx } from "clsx";
import DeckCard from "@/components/app/DeckCard";
import type { DeckStatus } from "@/app/models/Deck";

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

  useEffect(() => {
    fetch("/api/decks")
      .then((r) => r.json())
      .then((d) => setDecks(d.decks ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = (id: string) => {
    setDecks((prev) => prev.filter((d) => d._id !== id));
  };

  const handleRename = (id: string, newTitle: string) => {
    setDecks((prev) =>
      prev.map((d) => (d._id === id ? { ...d, title: newTitle } : d))
    );
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
          <h2 className="text-3xl font-extrabold text-[#101A3A] [font-family:var(--font-display)]">My Decks</h2>
          <p className="mt-1.5 text-base text-[#5a6384]">{decks.length} deck{decks.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href="/decks/new"
          className="flex items-center gap-2 rounded-xl bg-[#2F5BFF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2449d6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5BFF]"
        >
          <Plus size={16} /> New deck
        </Link>
      </div>

      {decks.length === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center rounded-2xl border border-[#101A3A]/10 bg-white py-20 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4F6FB] border border-[#101A3A]/5 shadow-sm">
            <FolderOpen size={28} className="text-[#2F5BFF]" />
          </div>
          <h3 className="mt-5 text-xl font-extrabold text-[#101A3A] [font-family:var(--font-display)]">No decks yet</h3>
          <p className="mt-2 max-w-sm text-sm text-[#5a6384]">Upload a PDF or DOCX, let our AI generate your slides, and export an editable PowerPoint in seconds.</p>
          <Link href="/decks/new" className="mt-6 rounded-xl bg-[#101A3A] px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#1d2c5e] hover:shadow-lg">
            Create your first deck
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <li key={deck._id}>
              <DeckCard deck={deck} onDelete={handleDelete} onRename={handleRename} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
