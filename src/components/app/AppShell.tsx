"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import type { SessionUser } from "@/lib/auth";

interface AppShellProps {
  user: SessionUser;
  children: React.ReactNode;
}

export default function AppShell({ user, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F6FB] [font-family:var(--font-body)]">
      {/* Sidebar (desktop fixed + mobile drawer) */}
      <Sidebar
        user={user}
        drawerOpen={drawerOpen}
        onDrawerClose={() => setDrawerOpen(false)}
      />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden relative">
        {user.emailVerified === false && (
          <div className="bg-amber-100 text-amber-900 px-4 py-2 text-sm flex items-center justify-center gap-3">
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
          onMenuOpen={() => setDrawerOpen(true)}
        />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-6 md:p-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
