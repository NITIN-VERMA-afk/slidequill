import { connectDB } from "@/app/lib/db";
import User from "@/app/models/User";
import AnalyticsEvent from "@/app/models/AnalyticsEvent";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Users,
  FilePlus,
  ListOrdered,
  Sparkles,
  Download,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react";

function getSinceDate(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export default async function AdminFunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const session = await getSession();
  if (!session?.sub) {
    redirect("/login?next=/admin/funnel");
  }

  await connectDB();
  const user = await User.findById(session.sub).select("role email").lean();
  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#F4F6FB] flex items-center justify-center p-6 text-[#101A3A]">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#101A3A]/10 max-w-md text-center">
          <AlertTriangle size={36} className="text-amber-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold mb-2">Access Restricted</h1>
          <p className="text-sm text-[#5a6384] mb-4">
            You must have an administrator account to view funnel metrics and system analytics.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-[#2F5BFF] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#2449d6]"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { days: rawDays } = await searchParams;
  const days = Math.min(90, Math.max(1, parseInt(rawDays || "30", 10)));
  const since = getSinceDate(days);

  const counts = await AnalyticsEvent.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: "$event", count: { $sum: 1 } } },
  ]);

  const funnelMap: Record<string, number> = {};
  for (const c of counts) {
    funnelMap[c._id] = c.count;
  }

  const signups = funnelMap["signup"] || 0;
  const decksCreated = funnelMap["deck_created"] || 0;
  const outlinesGenerated = funnelMap["outline_generated"] || 0;
  const decksGenerated = funnelMap["deck_generated"] || 0;
  const pptxExported = funnelMap["pptx_exported"] || 0;
  const purchaseStarted = funnelMap["credit_purchase_started"] || 0;
  const purchased = funnelMap["credit_purchased"] || 0;
  const failures = funnelMap["generation_failed"] || 0;

  const funnelSteps = [
    { label: "New Signups", count: signups, icon: Users, color: "text-blue-600 bg-blue-50" },
    { label: "Decks Created", count: decksCreated, icon: FilePlus, color: "text-indigo-600 bg-indigo-50" },
    { label: "Outlines Generated", count: outlinesGenerated, icon: ListOrdered, color: "text-purple-600 bg-purple-50" },
    { label: "Full Decks Generated", count: decksGenerated, icon: Sparkles, color: "text-emerald-600 bg-emerald-50" },
    { label: "PPTX Exported", count: pptxExported, icon: Download, color: "text-amber-600 bg-amber-50" },
    { label: "Purchase Started", count: purchaseStarted, icon: CreditCard, color: "text-sky-600 bg-sky-50" },
    { label: "Credits Purchased", count: purchased, icon: CheckCircle2, color: "text-teal-600 bg-teal-50" },
  ];

  const convSignupToDeck = signups > 0 ? Math.round((decksCreated / signups) * 100) : 0;
  const convDeckToGen = decksCreated > 0 ? Math.round((decksGenerated / decksCreated) * 100) : 0;
  const convGenToExport = decksGenerated > 0 ? Math.round((pptxExported / decksGenerated) * 100) : 0;
  const convPurchase = purchaseStarted > 0 ? Math.round((purchased / purchaseStarted) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#F4F6FB] p-8 text-[#101A3A]">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-[#5a6384] hover:text-[#101A3A] mb-2 font-medium"
            >
              <ChevronLeft size={14} /> Back to Dashboard
            </Link>
            <h1 className="text-2xl font-black tracking-tight">Analytics Funnel & Growth</h1>
            <p className="text-sm text-[#5a6384]">
              Real-time pipeline conversion metrics and export throughput.
            </p>
          </div>

          {/* Time range selector */}
          <div className="flex items-center gap-2 bg-white border border-[#101A3A]/10 p-1 rounded-xl shadow-sm">
            <Link
              href="/admin/funnel?days=7"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                days === 7
                  ? "bg-[#2F5BFF] text-white"
                  : "text-[#5a6384] hover:text-[#101A3A]"
              }`}
            >
              Last 7 days
            </Link>
            <Link
              href="/admin/funnel?days=30"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                days === 30
                  ? "bg-[#2F5BFF] text-white"
                  : "text-[#5a6384] hover:text-[#101A3A]"
              }`}
            >
              Last 30 days
            </Link>
            <Link
              href="/admin/funnel?days=90"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                days === 90
                  ? "bg-[#2F5BFF] text-white"
                  : "text-[#5a6384] hover:text-[#101A3A]"
              }`}
            >
              Last 90 days
            </Link>
          </div>
        </div>

        {/* Funnel Pipeline Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-[#101A3A]/10 shadow-sm">
            <span className="text-xs font-bold text-[#5a6384] uppercase tracking-wider">Signup to Deck Created</span>
            <div className="text-2xl font-black mt-2 text-[#101A3A]">{convSignupToDeck}%</div>
            <p className="text-xs text-[#5a6384] mt-1">{decksCreated} decks from {signups} signups</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-[#101A3A]/10 shadow-sm">
            <span className="text-xs font-bold text-[#5a6384] uppercase tracking-wider">Created to Generated</span>
            <div className="text-2xl font-black mt-2 text-[#101A3A]">{convDeckToGen}%</div>
            <p className="text-xs text-[#5a6384] mt-1">{decksGenerated} completed generations</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-[#101A3A]/10 shadow-sm">
            <span className="text-xs font-bold text-[#5a6384] uppercase tracking-wider">Generated to PPTX Export</span>
            <div className="text-2xl font-black mt-2 text-[#101A3A]">{convGenToExport}%</div>
            <p className="text-xs text-[#5a6384] mt-1">{pptxExported} PPTX downloads</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-[#101A3A]/10 shadow-sm">
            <span className="text-xs font-bold text-[#5a6384] uppercase tracking-wider">Checkout Conversion</span>
            <div className="text-2xl font-black mt-2 text-[#101A3A]">{convPurchase}%</div>
            <p className="text-xs text-[#5a6384] mt-1">{purchased} paid orders from {purchaseStarted} checkouts</p>
          </div>
        </div>

        {/* Step-by-Step Funnel List */}
        <div className="bg-white rounded-2xl border border-[#101A3A]/10 p-6 shadow-sm flex flex-col gap-4">
          <h2 className="text-base font-bold text-[#101A3A]">Event Volume Across Funnel</h2>
          <div className="flex flex-col divide-y divide-[#101A3A]/5">
            {funnelSteps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={idx} className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${step.color}`}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#101A3A]">{step.label}</div>
                      <div className="text-xs text-[#5a6384]">Funnel Stage {idx + 1}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-[#101A3A]">{step.count.toLocaleString()}</div>
                    <div className="text-[11px] text-[#5a6384]">events recorded</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Failure & Reliability Rate */}
        <div className="bg-white rounded-2xl border border-[#101A3A]/10 p-6 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#101A3A]">Generation Failures & Fallbacks</h3>
              <p className="text-xs text-[#5a6384]">
                Total failed generation events in the last {days} days: <span className="font-semibold text-red-600">{failures}</span>
              </p>
            </div>
          </div>
          <span className="text-xs px-3 py-1.5 rounded-full font-semibold bg-emerald-50 text-emerald-700">
            {decksGenerated + failures > 0
              ? `${(100 - (failures / (decksGenerated + failures)) * 100).toFixed(1)}% Success Rate`
              : "100% Reliability"}
          </span>
        </div>

      </div>
    </div>
  );
}
