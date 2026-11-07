import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { checkOrigin } from "@/lib/csrf";
import { getLoginLimiter } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip";
import { executeAccountDelete } from "@/lib/services/account-delete";

export async function POST(req: NextRequest) {
  const csrfError = checkOrigin(req);
  if (csrfError) return csrfError;

  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(req);
  const limiterKey = `${session.sub}:${ip}`;
  const rateLimit = await getLoginLimiter().limit(limiterKey);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password : "";
  const emailConfirmation = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  const result = await executeAccountDelete({
    userId: session.sub,
    password,
    emailConfirmation,
  });

  if (result.status === 200) {
    const jar = await cookies();
    jar.delete("sq_at");
    jar.delete("sq_rt");
  }

  return NextResponse.json(result.data, { status: result.status });
}
