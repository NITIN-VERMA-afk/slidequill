"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email");

    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);
    setDone(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F6FB]">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-sm text-center">
        <h1 className="text-2xl font-bold text-[#101A3A] mb-2">Reset Password</h1>
        {done ? (
          <p className="text-[#5a6384]">If that account exists, we have sent a password reset link to your email.</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <p className="text-[#5a6384] text-sm mb-4">Enter your email and we will send you a reset link.</p>
            <input
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="w-full rounded-xl border border-[#101A3A]/15 px-4 py-3 text-sm outline-none focus:border-[#2F5BFF]"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#2F5BFF] py-3 text-sm font-semibold text-white hover:bg-[#2548cc] transition disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Send Reset Link"}
            </button>
          </form>
        )}
        <div className="mt-6 text-sm text-[#5a6384]">
          <Link href="/login" className="hover:underline">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
