import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/ratelimit";


const schema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100, "Name cannot exceed 100 characters."),
  email: z.string().trim().email("Please provide a valid email address."),
  message: z.string().trim().min(10, "Message must be at least 10 characters long.").max(2000, "Message is too long."),
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

  const resend = new Resend(process.env.RESEND_API_KEY);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || "Invalid form data.";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  const supportEmail = process.env.SUPPORT_EMAIL;
  if (!supportEmail) {
    console.error("SUPPORT_EMAIL not configured");
    return NextResponse.json({ error: "Configuration error" }, { status: 500 });
  }

  const emailFrom = process.env.EMAIL_FROM || "Slidequill Contact <hello@slidequill.in>";

  try {
    await resend.emails.send({
      from: emailFrom,
      to: supportEmail,
      replyTo: parsed.data.email,
      subject: `New message from ${parsed.data.name}`,
      text: `Name: ${parsed.data.name}\nEmail: ${parsed.data.email}\n\nMessage:\n${parsed.data.message}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json({ error: "Failed to send message." }, { status: 500 });
  }
}
