"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  FolderOpen,
  Plus,
  LayoutTemplate,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";
import { clsx } from "clsx";
import NavLink from "./NavLink";
import type { SessionUser } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/dashboard",  label: "Dashboard",  Icon: LayoutDashboard },
  { href: "/decks",      label: "My Decks",   Icon: FolderOpen },
  { href: "/templates",  label: "Templates",  Icon: LayoutTemplate },
  { href: "/billing",    label: "Billing",    Icon: CreditCard },
  { href: "/settings",   label: "Settings",   Icon: Settings },
] as const;

const STORAGE_KEY = "sq_sidebar_collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}
function writeCollapsed(v: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(v));
  } catch { /* ignore */ }
}

interface SidebarProps {
  user: SessionUser;
  drawerOpen: boolean;
  onDrawerClose: () => void;
}

export default function Sidebar({ user, drawerOpen, onDrawerClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const drawerRef = useRef<HTMLElement>(null);

  // Hydrate collapsed state from localStorage after mount
  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      writeCollapsed(!c);
      return !c;
    });
  };

  // Close drawer on route change
  useEffect(() => {
    onDrawerClose();
  }, [pathname, onDrawerClose]);

  // Escape key closes drawer
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && drawerOpen) onDrawerClose();
    },
    [drawerOpen, onDrawerClose]
  );
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Focus trap while drawer open
  useEffect(() => {
    if (!drawerOpen) return;
    const el = drawerRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    el.addEventListener("keydown", trap);
    first?.focus();
    return () => el.removeEventListener("keydown", trap);
  }, [drawerOpen]);

  const sidebarContent = (isMobile = false) => (
    <nav
      ref={isMobile ? drawerRef : undefined}
      aria-label="Main navigation"
      className={clsx(
        "flex h-full flex-col bg-[#101A3A] text-white transition-[width]",
        !isMobile && (collapsed ? "w-16" : "w-64"),
        isMobile && "w-72"
      )}
      style={
        !isMobile
          ? { transitionDuration: "200ms", transitionTimingFunction: "ease" }
          : undefined
      }
    >
      {/* Logo + collapse toggle */}
      <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-lg font-extrabold tracking-tight [font-family:var(--font-display)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2F5BFF]"
        >
          <Image src="/logo-icon.png" alt="SlideQuill" width={28} height={28} className="shrink-0 rounded-sm" />
          {(!collapsed || isMobile) && <span>Slidequill</span>}
        </Link>
        {!isMobile && (
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2F5BFF]"
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        )}
      </div>

      {/* New deck button */}
      <div className="px-3 pt-4">
        <Link
          href="/decks/new"
          className={clsx(
            "flex items-center justify-center gap-2 rounded-lg bg-[#2F5BFF] py-2 text-sm font-semibold text-white transition hover:bg-[#2449d6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white",
            collapsed && !isMobile ? "px-2" : "px-3"
          )}
          title={collapsed && !isMobile ? "New deck" : undefined}
        >
          <Plus size={16} className="shrink-0" />
          {(!collapsed || isMobile) && <span>New deck</span>}
        </Link>
      </div>

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, Icon }) => (
          <NavLink
            key={href}
            href={href}
            icon={<Icon size={18} />}
            label={label}
            collapsed={collapsed && !isMobile}
          />
        ))}
      </div>

      {/* Credits card */}
      <div className="border-t border-white/10 p-3">
        <Link
          href="/billing"
          className={clsx(
            "flex items-center gap-3 rounded-lg bg-white/8 px-3 py-2.5 transition hover:bg-white/12 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2F5BFF]",
            collapsed && !isMobile && "justify-center"
          )}
          title={collapsed && !isMobile ? `${user.credits} credits` : undefined}
        >
          <Zap size={16} className="shrink-0 text-[#2F5BFF]" />
          {(!collapsed || isMobile) && (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">
                {user.credits} credits
              </p>
              <p className="text-xs text-white/50">Buy more</p>
            </div>
          )}
        </Link>
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:block h-full shrink-0">
        {sidebarContent(false)}
      </aside>

      {/* Mobile backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          aria-hidden="true"
          onClick={onDrawerClose}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 h-full md:hidden",
          "@media (prefers-reduced-motion: no-preference) transition-transform duration-200 ease-out",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Mobile navigation"
        aria-modal="true"
        role="dialog"
        hidden={!drawerOpen}
        style={{
          transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 175ms ease-out",
        }}
      >
        {drawerOpen && sidebarContent(true)}
      </aside>
    </>
  );
}
