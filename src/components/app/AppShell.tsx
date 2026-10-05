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
      <div className="flex flex-1 flex-col overflow-hidden">
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
