"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, Zap } from "lucide-react";
import UserMenu from "./UserMenu";
import type { SessionUser } from "@/lib/auth";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":  "Dashboard",
  "/decks":      "My Decks",
  "/decks/new":  "New Deck",
  "/templates":  "Templates",
  "/billing":    "Billing",
  "/settings":   "Settings",
};

interface TopbarProps {
  user: SessionUser;
  credits: number;
  onMenuOpen: () => void;
}

export default function Topbar({ user, credits, onMenuOpen }: TopbarProps) {
  const pathname = usePathname();

  // Resolve title: exact match first, then longest prefix
  const title =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES)
      .filter(([k]) => pathname.startsWith(k) && k !== "/")
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ??
    "Slidequill";

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-[#101A3A]/[0.12] bg-white px-4 md:px-6">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuOpen}
        aria-label="Open navigation menu"
        aria-controls="mobile-drawer"
        className="flex h-8 w-8 items-center justify-center rounded-md text-[#101A3A] hover:bg-[#F4F6FB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2F5BFF] md:hidden"
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <h1 className="flex-1 truncate text-base font-semibold text-[#101A3A] [font-family:var(--font-display)]">
        {title}
      </h1>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Credits pill */}
        <Link
          href="/billing"
          className="hidden items-center gap-1.5 rounded-full border border-[#101A3A]/10 bg-[#F4F6FB] px-3 py-1 text-xs font-semibold text-[#101A3A] transition hover:border-[#2F5BFF]/40 hover:bg-[#2F5BFF]/5 hover:text-[#2F5BFF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2F5BFF] sm:flex"
        >
          <Zap size={11} className="text-[#2F5BFF]" />
          {credits} credits
        </Link>

        {/* User menu */}
        <UserMenu user={user} />
      </div>
    </header>
  );
}
