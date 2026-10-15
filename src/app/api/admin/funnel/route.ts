import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import AnalyticsEvent from "@/app/models/AnalyticsEvent";
import User from "@/app/models/User";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await connectDB();
  const user = await User.findById(session.sub).select("role email").lean();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") || "30", 10)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Aggregate event counts in the time window
  const counts = await AnalyticsEvent.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: "$event", count: { $sum: 1 } } },
  ]);

  const funnelMap: Record<string, number> = {};
  for (const c of counts) {
    funnelMap[c._id] = c.count;
  }

  // Calculate funnel conversion rates
  const signups = funnelMap["signup"] || 0;
  const decksCreated = funnelMap["deck_created"] || 0;
  const outlinesGenerated = funnelMap["outline_generated"] || 0;
  const decksGenerated = funnelMap["deck_generated"] || 0;
  const pptxExported = funnelMap["pptx_exported"] || 0;
  const purchaseStarted = funnelMap["credit_purchase_started"] || 0;
  const purchased = funnelMap["credit_purchased"] || 0;
  const failures = funnelMap["generation_failed"] || 0;

  return NextResponse.json({
    days,
    since: since.toISOString(),
    metrics: {
      signups,
      decksCreated,
      outlinesGenerated,
      decksGenerated,
      pptxExported,
      purchaseStarted,
      purchased,
      failures,
    },
    conversion: {
      signupToDeckCreated: signups > 0 ? Math.round((decksCreated / signups) * 100) : 0,
      deckCreatedToGenerated: decksCreated > 0 ? Math.round((decksGenerated / decksCreated) * 100) : 0,
      generatedToExported: decksGenerated > 0 ? Math.round((pptxExported / decksGenerated) * 100) : 0,
      purchaseConversion: purchaseStarted > 0 ? Math.round((purchased / purchaseStarted) * 100) : 0,
    },
  });
}
