"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Settings, CreditCard, ChevronDown } from "lucide-react";
import { clsx } from "clsx";
import type { SessionUser } from "@/lib/auth";

interface UserMenuProps {
  user: SessionUser;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape, return focus to trigger
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  const menuItems = [
    {
      type: "link" as const,
      href: "/settings",
      label: "Settings",
      Icon: Settings,
    },
    {
      type: "link" as const,
      href: "/billing",
      label: "Billing",
      Icon: CreditCard,
    },
  ];

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger */}
      <button
        ref={triggerRef}
        id="user-menu-button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="user-menu"
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-[#101A3A]/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2F5BFF]"
      >
        {/* Avatar */}
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2F5BFF] text-xs font-bold text-white">
          {initials(user.name)}
        </span>
        <span className="hidden max-w-[120px] truncate font-medium text-[#101A3A] sm:block">
          {user.name}
        </span>
        <ChevronDown
          size={14}
          className={clsx(
            "hidden text-[#5a6384] transition-transform sm:block",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          id="user-menu"
          role="menu"
          aria-labelledby="user-menu-button"
          className="absolute right-0 top-full z-50 mt-1.5 w-56 origin-top-right rounded-xl border border-[#101A3A]/10 bg-white py-1 shadow-lg shadow-[#101A3A]/10 focus:outline-none"
        >
          {/* User info header */}
          <div className="border-b border-[#101A3A]/8 px-4 py-3">
            <p className="truncate text-sm font-semibold text-[#101A3A]">
              {user.name}
            </p>
            <p className="truncate text-xs text-[#5a6384]">{user.email}</p>
          </div>

          {/* Menu items */}
          {menuItems.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-[#101A3A] hover:bg-[#F4F6FB] focus-visible:bg-[#F4F6FB] focus-visible:outline-none"
            >
              <Icon size={15} className="text-[#5a6384]" />
              {label}
            </Link>
          ))}

          <div className="my-1 border-t border-[#101A3A]/8" />

          {/* Logout */}
          <button
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
