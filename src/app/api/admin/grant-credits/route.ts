import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkOrigin } from "@/lib/csrf";
import { executeAdminCreditGrant } from "@/lib/services/admin-credit-grant";

export async function POST(req: NextRequest) {
  const csrfError = checkOrigin(req);
  if (csrfError) return csrfError;

  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await executeAdminCreditGrant({
    adminId: session.sub,
    email: body.email,
    amount: body.amount,
    note: body.note,
  });

  return NextResponse.json(result.data, { status: result.status });
}
