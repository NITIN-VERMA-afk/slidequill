import { getSessionUser } from "@/lib/auth";
import { LayoutDashboard, Plus } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await getSessionUser();

  return (
    <div>
      {/* Welcome header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-[#101A3A] [font-family:var(--font-display)]">
            Good to see you, {user?.name?.split(" ")[0]} 👋
          </h2>
          <p className="mt-1 text-sm text-[#5a6384]">
            You have{" "}
            <span className="font-semibold text-[#101A3A]">
              {user?.credits} credit{user?.credits !== 1 ? "s" : ""}
            </span>{" "}
            remaining.
          </p>
        </div>
        <Link
          href="/decks/new"
          className="flex items-center gap-2 rounded-xl bg-[#2F5BFF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2449d6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5BFF]"
        >
          <Plus size={16} /> New deck
        </Link>
      </div>

      {/* Empty state */}
      <div className="mt-16 flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#101A3A]/5">
          <LayoutDashboard size={28} className="text-[#5a6384]" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-[#101A3A] [font-family:var(--font-display)]">
          No activity yet
        </h3>
        <p className="mt-2 max-w-sm text-sm text-[#5a6384]">
          Create your first deck to get started. It takes about a minute.
        </p>
        <Link
          href="/decks/new"
          className="mt-6 rounded-xl bg-[#101A3A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1d2c5e]"
        >
          Make your first deck
        </Link>
      </div>
    </div>
  );
}
