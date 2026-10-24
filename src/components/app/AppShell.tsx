"use client";

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import type { SessionUser } from "@/lib/auth";

interface AppShellProps {
  user: SessionUser;
  children: React.ReactNode;
}

export default function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const handleDrawerClose = useCallback(() => setDrawerOpen(false), []);
  const handleDrawerOpen = useCallback(() => setDrawerOpen(true), []);

  return (
    <div className="flex h-screen h-[100dvh] w-full overflow-hidden bg-[#F4F6FB] [font-family:var(--font-body)]">
      {/* Sidebar (desktop fixed + mobile drawer) */}
      <Sidebar
        user={user}
        drawerOpen={drawerOpen}
        onDrawerClose={handleDrawerClose}
      />

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0 h-full overflow-hidden relative">
        {user.emailVerified === false && (
          <div className="shrink-0 bg-amber-100 text-amber-900 px-4 py-2 text-sm flex items-center justify-center gap-3 z-20">
            <span>Verify your email to generate decks.</span>
            <button 
              onClick={async (e) => {
                const btn = e.currentTarget;
                btn.disabled = true;
                btn.innerText = "Sending...";
                try {
                  const res = await fetch("/api/auth/resend-verification", { method: "POST" });
                  if (res.ok) btn.innerText = "Sent!";
                  else btn.innerText = "Error (Rate limit?)";
                } catch {
                  btn.innerText = "Error";
                }
              }}
              className="bg-amber-900 text-amber-50 px-3 py-1 rounded text-xs font-bold hover:bg-amber-800 transition disabled:opacity-50"
            >
              Resend email
            </button>
          </div>
        )}
        <Topbar
          user={user}
          credits={user.credits}
          onMenuOpen={handleDrawerOpen}
        />

        {/* Dynamic Ambient Color & Animation Background Layer across the whole dashboard */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
          {/* Soft geometric technical grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#2f5bff0f_1px,transparent_1px),linear-gradient(to_bottom,#2f5bff0f_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_35%,#000_60%,transparent_100%)]" />

          {/* Ambient dot matrix */}
          <div className="absolute inset-0 bg-[radial-gradient(#2F5BFF_1.2px,transparent_1.2px)] [background-size:24px_24px] opacity-20 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_30%,transparent_85%)]" />

          {/* Glowing floating color orb 1: Electric Blue / Indigo (Top Left) */}
          <div className="absolute -top-16 -left-20 h-[520px] w-[520px] rounded-full bg-gradient-to-tr from-blue-600/25 via-indigo-500/20 to-sky-400/15 blur-[95px] animate-blob" />

          {/* Glowing floating color orb 2: Luminous Purple / Violet (Top Right) */}
          <div className="absolute top-10 -right-24 h-[480px] w-[480px] rounded-full bg-gradient-to-bl from-purple-600/25 via-fuchsia-500/18 to-indigo-500/15 blur-[95px] animate-blob-delayed" />

          {/* Glowing floating color orb 3: Vibrant Cyan / Emerald (Bottom Center / Left) */}
          <div className="absolute -bottom-24 left-1/4 h-[460px] w-[460px] rounded-full bg-gradient-to-r from-cyan-400/20 via-blue-500/15 to-indigo-600/15 blur-[85px] animate-blob-slow" />

          {/* Glowing pulsing accent 4: Soft Rose / Amber glow (Center) */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[340px] w-[340px] rounded-full bg-gradient-to-r from-pink-500/12 via-rose-400/12 to-amber-300/12 blur-[80px] animate-pulse-glow" />
        </div>

        <main
          id="main-content"
          className={clsx(
            "relative z-10 flex-1 min-h-0 flex flex-col",
            isDashboard
              ? "overflow-y-auto md:overflow-hidden p-4 sm:p-6 md:p-8"
              : "overflow-y-auto p-4 sm:p-6 md:p-8"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
