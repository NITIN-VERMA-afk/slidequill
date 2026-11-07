import { NextRequest, NextResponse } from "next/server";
import { executeCleanupJob } from "@/lib/services/cleanup-job";

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { decksCleaned, stuckDecksRecovered } = await executeCleanupJob();

  return NextResponse.json({ success: true, decksCleaned, stuckDecksRecovered });
}
