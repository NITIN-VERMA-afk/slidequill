"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

const schema = z
  .object({
    name: z.string().min(1, "Name is required").max(100),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "At least 8 characters").max(128),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
type FormData = z.infer<typeof schema>;

const features = [
  { icon: "📄", text: "Upload PDF, DOCX or paste text" },
  { icon: "✦", text: "AI drafts slides in under a minute" },
  { icon: "⬇︎", text: "Download editable .pptx files" },
  { icon: "🎨", text: "Apply your own branding & template" },
];

export default function SignupPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const password = watch("password", "");
  const strength = password.length === 0 ? 0 : password.length < 8 ? 1 : password.length < 12 ? 2 : 3;
  const strengthLabel = ["", "Weak", "Good", "Strong"][strength];
  const strengthColor = ["", "bg-red-400", "bg-yellow-400", "bg-emerald-500"][strength];

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setServerError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
        }),
      });
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        const body = await res.json();
        setServerError(body.error ?? "Something went wrong.");
      }
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen [font-family:var(--font-body)]">

      {/* ── Left panel: brand + image ───────────────────────────── */}
      <div className="relative hidden lg:flex lg:w-[48%] flex-col overflow-hidden">
        <Image
          src="/auth-bg.jpg"
          alt=""
          fill
          sizes="48vw"
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#101A3A]/85 via-[#101A3A]/50 to-[#2F5BFF]/25" />

        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          {/* Logo */}
          <Link
            href="/"
            className="text-2xl font-extrabold tracking-tight text-white [font-family:var(--font-display)]"
          >
            Slidequill
          </Link>

          {/* Centre */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#2F5BFF]/20 border border-[#2F5BFF]/40 px-3 py-1 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2F5BFF] animate-pulse" />
              <span className="text-xs font-semibold text-[#2F5BFF]">Free — no card required</span>
            </div>
            <h2 className="text-4xl font-extrabold leading-tight text-white [font-family:var(--font-display)]">
              Start making decks in seconds.
            </h2>
            <p className="mt-4 text-white/60 leading-relaxed max-w-sm">
              Join thousands of people turning their documents into polished presentations.
            </p>

            {/* Feature list */}
            <ul className="mt-10 space-y-4">
              {features.map((f) => (
                <li
                  key={f.text}
                  className="flex items-center gap-3 text-sm text-white/80"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm border border-white/15 text-base">
                    {f.icon}
                  </span>
                  {f.text}
                </li>
              ))}
            </ul>

            {/* Social proof pill */}
            <div className="mt-10 inline-flex items-center gap-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 px-5 py-3">
              <div className="flex -space-x-2">
                {["#2F5BFF", "#4a70ff", "#7a9bff"].map((c) => (
                  <div
                    key={c}
                    style={{ backgroundColor: c }}
                    className="h-7 w-7 rounded-full border-2 border-white/20"
                  />
                ))}
              </div>
              <p className="text-xs text-white/70">
                <span className="font-semibold text-white">2,400+</span> decks created this week
              </p>
            </div>
          </div>

          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} Slidequill
          </p>
        </div>
      </div>

      {/* ── Right panel: form ───────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#F4F6FB] px-6 py-12 overflow-y-auto">
        {/* Mobile logo */}
        <Link
          href="/"
          className="mb-8 text-xl font-extrabold tracking-tight text-[#101A3A] [font-family:var(--font-display)] lg:hidden"
        >
          Slidequill
        </Link>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-[#101A3A] [font-family:var(--font-display)]">
              Create your account
            </h1>
            <p className="mt-2 text-[#5a6384]">
              3 free decks to start — no card required
            </p>
          </div>

          <form
            id="signup-form"
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="signup-name" className="text-sm font-semibold text-[#101A3A]">
                Full name
              </label>
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                placeholder="Alex Johnson"
                {...register("name")}
                className="w-full rounded-xl border border-[#101A3A]/15 bg-white px-4 py-3 text-sm text-[#101A3A] placeholder:text-[#9aa3bf] shadow-sm outline-none transition focus:border-[#2F5BFF] focus:ring-3 focus:ring-[#2F5BFF]/15"
              />
              {errors.name && (
                <p className="flex items-center gap-1 text-xs text-red-500">
                  <span>⚠</span> {errors.name.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="signup-email" className="text-sm font-semibold text-[#101A3A]">
                Email address
              </label>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...register("email")}
                className="w-full rounded-xl border border-[#101A3A]/15 bg-white px-4 py-3 text-sm text-[#101A3A] placeholder:text-[#9aa3bf] shadow-sm outline-none transition focus:border-[#2F5BFF] focus:ring-3 focus:ring-[#2F5BFF]/15"
              />
              {errors.email && (
                <p className="flex items-center gap-1 text-xs text-red-500">
                  <span>⚠</span> {errors.email.message}
                </p>
              )}
            </div>

            {/* Password + strength meter */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="signup-password" className="text-sm font-semibold text-[#101A3A]">
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                {...register("password")}
                className="w-full rounded-xl border border-[#101A3A]/15 bg-white px-4 py-3 text-sm text-[#101A3A] placeholder:text-[#9aa3bf] shadow-sm outline-none transition focus:border-[#2F5BFF] focus:ring-3 focus:ring-[#2F5BFF]/15"
              />
              {/* Strength bar */}
              {password.length > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                          n <= strength ? strengthColor : "bg-[#101A3A]/10"
                        }`}
                      />
                    ))}
                  </div>
                  <span className={`text-xs font-medium ${strength === 1 ? "text-red-400" : strength === 2 ? "text-yellow-500" : "text-emerald-600"}`}>
                    {strengthLabel}
                  </span>
                </div>
              )}
              {errors.password && (
                <p className="flex items-center gap-1 text-xs text-red-500">
                  <span>⚠</span> {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="signup-confirm" className="text-sm font-semibold text-[#101A3A]">
                Confirm password
              </label>
              <input
                id="signup-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                {...register("confirmPassword")}
                className="w-full rounded-xl border border-[#101A3A]/15 bg-white px-4 py-3 text-sm text-[#101A3A] placeholder:text-[#9aa3bf] shadow-sm outline-none transition focus:border-[#2F5BFF] focus:ring-3 focus:ring-[#2F5BFF]/15"
              />
              {errors.confirmPassword && (
                <p className="flex items-center gap-1 text-xs text-red-500">
                  <span>⚠</span> {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Server error */}
            {serverError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                <span className="mt-0.5 shrink-0">✕</span>
                <span>{serverError}</span>
              </div>
            )}

            {/* Submit */}
            <button
              id="signup-submit"
              type="submit"
              disabled={loading}
              className="group relative mt-2 w-full overflow-hidden rounded-xl bg-[#2F5BFF] py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#2F5BFF]/25 transition hover:bg-[#2449d6] hover:shadow-[#2F5BFF]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5BFF] disabled:opacity-60"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Creating account…
                  </span>
                ) : (
                  "Create free account →"
                )}
              </span>
            </button>

            <p className="text-center text-xs text-[#9aa3bf]">
              By signing up you agree to our{" "}
              <Link href="/terms" className="underline hover:text-[#101A3A]">Terms</Link>{" "}
              &amp;{" "}
              <Link href="/privacy" className="underline hover:text-[#101A3A]">Privacy Policy</Link>.
            </p>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#101A3A]/10" />
            <span className="text-xs text-[#9aa3bf]">or</span>
            <div className="h-px flex-1 bg-[#101A3A]/10" />
          </div>

          <p className="text-center text-sm text-[#5a6384]">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-[#2F5BFF] hover:underline">
              Sign in →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
