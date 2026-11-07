import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getOutlineMinuteLimiter, getOutlineDailyLimiter } from "@/lib/ratelimit";
import { checkOrigin } from "@/lib/csrf";
import { isValidObjectId } from "@/lib/validation";
import { processOutlineStep } from "@/lib/services/outline-step";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = checkOrigin(req);
  if (csrfError) return csrfError;

  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const minLimit = await getOutlineMinuteLimiter().limit(session.sub);
    if (!minLimit.success) {
      return NextResponse.json(
        { error: "Too many outline requests. Please wait a minute." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const dayLimit = await getOutlineDailyLimiter().limit(session.sub);
    if (!dayLimit.success) {
      return NextResponse.json(
        { error: "Daily outline generation limit reached. Please try again tomorrow." },
        { status: 429, headers: { "Retry-After": "86400" } }
      );
    }
  } catch {
    // If ratelimiter is unavailable, do not block
  }

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid deck ID." }, { status: 400 });
  }
  let body: { regenerate?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const result = await processOutlineStep(id, session.sub, body);
  return NextResponse.json(result.data, { status: result.status });
}
