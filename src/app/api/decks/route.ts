/**
 * POST /api/decks
 * Accepts multipart (file) or JSON ({ text }).
 * Extracts text, creates deck with status "outlining", returns { id }.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/app/lib/db";
import Deck from "@/app/models/Deck";
import { getSession } from "@/lib/auth";
import { extractText } from "@/lib/extract";
import { getDeckLimiter } from "@/lib/ratelimit";

import { themes, defaultThemeId } from "@/lib/themes";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_TEXT_CHARS = 50_000;

const textSchema = z.object({
  title: z.string().max(200).optional(),
  text: z.string().min(1, "Text is required").max(MAX_TEXT_CHARS),
  theme: z.string().optional(),
});

function sanitiseName(name: string): string {
  return name.replace(/[^\w.\-\s]/g, "_").slice(0, 200);
}

export async function POST(req: NextRequest) {
  // Auth
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const userId = session.sub;

  // Rate limit per user
  const { success } = await getDeckLimiter().limit(userId);
  if (!success) {
    return NextResponse.json(
      { error: "Too many decks created recently. Try again later." },
      { status: 429 }
    );
  }

  const ct = req.headers.get("content-type") ?? "";
  let sourceText: string;
  let sourceName: string;
  let title: string | undefined;
  let theme: string = defaultThemeId;

  // ── File upload path ──────────────────────────────────────────────────────
  if (ct.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "File is too large. Maximum size is 10 MB." },
        { status: 413 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const result = await extractText(buf);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    sourceText = result.text;
    sourceName = sanitiseName(file.name);
    title = (form.get("title") as string | null) ?? sourceName;
    const themeParam = form.get("theme") as string | null;
    if (themeParam && themes[themeParam]) theme = themeParam;

  // ── JSON text path ─────────────────────────────────────────────────────────
  } else {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = textSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    sourceText = parsed.data.text;
    sourceName = "pasted text";
    title = parsed.data.title;
    if (parsed.data.theme && themes[parsed.data.theme]) theme = parsed.data.theme;
  }

  await connectDB();
  const deck = await Deck.create({
    userId,
    title: title?.trim() || "Untitled deck",
    sourceText,   // stored, select:false, never returned
    sourceName,
    status: "outlining",
    theme,
  });

  return NextResponse.json({ id: deck._id.toString() }, { status: 201 });
}

// ── GET /api/decks — list own decks ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await connectDB();
  const decks = await Deck.find({ userId: session.sub })
    .select("title status sourceName theme createdAt updatedAt")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ decks });
}
