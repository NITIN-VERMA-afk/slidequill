import { connectDB } from "@/app/lib/db";
import User from "@/app/models/User";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, BarChart3, AlertTriangle, ArrowRight } from "lucide-react";
import GrantCreditsForm from "@/components/admin/GrantCreditsForm";

export default async function AdminPage() {
  const session = await getSession();
  if (!session?.sub) {
    redirect("/login?next=/admin");
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
            You must have an administrator account to access the administration portal.
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

  return (
    <div className="min-h-screen bg-[#F4F6FB] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#2F5BFF] mb-1">
              <ShieldCheck size={14} /> Admin Administration
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101A3A] tracking-tight">
              Platform Controls
            </h1>
          </div>
          <Link
            href="/admin/funnel"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#101A3A]/15 text-sm font-semibold text-[#101A3A] hover:bg-[#F4F6FB] shadow-sm transition"
          >
            <BarChart3 size={16} className="text-[#2F5BFF]" />
            Funnel Analytics
            <ArrowRight size={14} />
          </Link>
        </div>

        {/* Grant Credits Tool */}
        <GrantCreditsForm />
      </div>
    </div>
  );
}
