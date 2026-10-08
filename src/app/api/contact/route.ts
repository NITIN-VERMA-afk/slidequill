import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/ratelimit";

const resend = new Resend(process.env.RESEND_API_KEY);

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  message: z.string().min(10).max(2000),
});

export async function POST(req: NextRequest) {
  // IP rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(3, "1 h"),
    prefix: "sq:rl:contact",
  });
  const { success } = await limiter.limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Too many messages. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const supportEmail = process.env.SUPPORT_EMAIL;
  if (!supportEmail) {
    console.error("SUPPORT_EMAIL not configured");
    return NextResponse.json({ error: "Configuration error" }, { status: 500 });
  }

  try {
    await resend.emails.send({
      from: "Slidequill Contact <contact@updates.slidequill.com>", // Update with verified sender
      to: supportEmail,
      subject: `New message from ${parsed.data.name}`,
      text: `Name: ${parsed.data.name}\nEmail: ${parsed.data.email}\n\nMessage:\n${parsed.data.message}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json({ error: "Failed to send message." }, { status: 500 });
  }
}
