"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    if (res.ok) {
      alert("Password reset successful. Please log in.");
      router.push("/login");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to reset password.");
      setLoading(false);
    }
  };

  if (!token) {
    return <div className="text-center p-8">Invalid link. No token provided.</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F6FB]">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-sm">
        <h1 className="text-2xl font-bold text-[#101A3A] mb-6 text-center">Enter New Password</h1>
        
        {error && <div className="mb-4 text-red-600 text-sm text-center">{error}</div>}

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="New password (min 8 chars)"
            className="w-full rounded-xl border border-[#101A3A]/15 px-4 py-3 text-sm outline-none focus:border-[#2F5BFF]"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#2F5BFF] py-3 text-sm font-semibold text-white hover:bg-[#2548cc] transition disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
