"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(res => {
        if (res.ok) {
          setStatus("success");
          setTimeout(() => {
            router.push("/dashboard");
            router.refresh();
          }, 2000);
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [token, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F6FB]">
      <div className="p-8 bg-white rounded-2xl shadow-sm text-center max-w-sm">
        {status === "loading" && <><Loader2 className="animate-spin mx-auto text-[#2F5BFF] mb-4" /> <p>Verifying email...</p></>}
        {status === "success" && <p className="text-emerald-600 font-bold">Email verified! Redirecting...</p>}
        {status === "error" && <p className="text-red-600 font-bold">Invalid or expired link.</p>}
      </div>
    </div>
  );
}
