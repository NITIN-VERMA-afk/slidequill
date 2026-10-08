import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Deprecated. Use /api/billing/order for billing." },
    { status: 404 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "Deprecated. Use /api/billing/order for billing." },
    { status: 404 }
  );
}
