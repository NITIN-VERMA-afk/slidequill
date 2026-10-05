"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type FormData = z.infer<typeof schema>;

const slides = [
  { title: "Q3 Earnings", sub: "Financial Overview" },
  { title: "Product Roadmap", sub: "2026 Strategy" },
  { title: "Team Metrics", sub: "Performance Report" },
];

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setServerError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        router.push(next);
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
      <div className="relative hidden lg:flex lg:w-[52%] flex-col overflow-hidden">
        {/* Background image */}
        <Image
          src="/auth-bg.jpg"
          alt=""
          fill
          sizes="52vw"
          className="object-cover object-center"
          priority
        />
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#101A3A]/80 via-[#101A3A]/40 to-[#2F5BFF]/30" />

        {/* Content layer */}
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          {/* Logo */}
          <Link
            href="/"
            className="text-2xl font-extrabold tracking-tight text-white [font-family:var(--font-display)]"
          >
            Slidequill
          </Link>

          {/* Centre copy */}
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-[#2F5BFF] mb-4">
              Your document → slides
            </p>
            <h2 className="text-4xl font-extrabold leading-tight text-white [font-family:var(--font-display)]">
              Turn any document into a stunning presentation.
            </h2>
            <p className="mt-4 text-white/60 leading-relaxed max-w-sm">
              Upload a PDF or Word file. Get an editable PowerPoint deck in about a minute.
            </p>

            {/* Floating mini slide deck */}
            <div className="mt-10 flex flex-col gap-3 max-w-xs">
              {slides.map((s, i) => (
                <div
                  key={s.title}
                  style={{
                    transform: `translateX(${i * 8}px)`,
                    opacity: 1 - i * 0.2,
                  }}
                  className="flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 px-4 py-3 shadow-lg transition-transform"
                >
                  <div className="h-8 w-11 rounded bg-[#2F5BFF]/40 border border-[#2F5BFF]/50 flex items-center justify-center shrink-0">
                    <div className="space-y-1">
                      <div className="h-0.5 w-5 rounded bg-white/60" />
                      <div className="h-0.5 w-3 rounded bg-white/40" />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">{s.title}</div>
                    <div className="text-[10px] text-white/50">{s.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer quote */}
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} Slidequill
          </p>
        </div>
      </div>

      {/* ── Right panel: form ───────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#F4F6FB] px-6 py-16">
        {/* Mobile logo */}
        <Link
          href="/"
          className="mb-8 text-xl font-extrabold tracking-tight text-[#101A3A] [font-family:var(--font-display)] lg:hidden"
        >
          Slidequill
        </Link>

        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-[#101A3A] [font-family:var(--font-display)]">
              Welcome back
            </h1>
            <p className="mt-2 text-[#5a6384]">
              Sign in to continue creating decks
            </p>
          </div>

          <form
            id="login-form"
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
          >
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-email" className="text-sm font-semibold text-[#101A3A]">
                Email address
              </label>
              <input
                id="login-email"
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

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-sm font-semibold text-[#101A3A]">
                  Password
                </label>
                <a href="#" className="text-xs text-[#2F5BFF] hover:underline">
                  Forgot password?
                </a>
              </div>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                {...register("password")}
                className="w-full rounded-xl border border-[#101A3A]/15 bg-white px-4 py-3 text-sm text-[#101A3A] placeholder:text-[#9aa3bf] shadow-sm outline-none transition focus:border-[#2F5BFF] focus:ring-3 focus:ring-[#2F5BFF]/15"
              />
              {errors.password && (
                <p className="flex items-center gap-1 text-xs text-red-500">
                  <span>⚠</span> {errors.password.message}
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
              id="login-submit"
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-xl bg-[#101A3A] py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#1d2c5e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5BFF] disabled:opacity-60"
            >
              {/* Shimmer effect */}
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  "Sign in"
                )}
              </span>
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#101A3A]/10" />
            <span className="text-xs text-[#9aa3bf]">or</span>
            <div className="h-px flex-1 bg-[#101A3A]/10" />
          </div>

          <p className="text-center text-sm text-[#5a6384]">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-[#2F5BFF] hover:underline"
            >
              Sign up free →
            </Link>
          </p>

          {/* Trust signals */}
          <div className="mt-8 flex items-center justify-center gap-5 text-xs text-[#9aa3bf]">
            <span className="flex items-center gap-1">🔒 Encrypted</span>
            <span className="flex items-center gap-1">✦ 3 free decks</span>
            <span className="flex items-center gap-1">⚡ No card needed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
