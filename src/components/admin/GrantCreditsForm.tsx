"use client";

import { useState } from "react";
import { Loader2, Coins, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function GrantCreditsForm() {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState<number>(10);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    newBalance?: number;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !amount || amount <= 0) {
      toast.error("Please enter a valid user email and positive credit amount.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/grant-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          amount: Number(amount),
          note: note.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to grant credits.");
      }

      setResult({
        success: true,
        message: `Successfully granted ${amount} credits to ${data.email}.`,
        newBalance: data.credits,
      });
      toast.success(`Granted ${amount} credits to ${data.email}. New balance: ${data.credits}`);
      setNote("");
    } catch (err: any) {
      setResult({
        success: false,
        error: err.message || "Failed to grant credits.",
      });
      toast.error(err.message || "Failed to grant credits.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#101A3A]/10 p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2F5BFF]/10 text-[#2F5BFF]">
          <Coins size={18} />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#101A3A]">Grant User Credits</h2>
          <p className="text-xs text-[#5a6384]">
            Atomically add credits to any user by email with audited ledger tracking.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#101A3A] mb-1">
            User Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@example.com"
            className="w-full rounded-xl border border-[#101A3A]/15 bg-[#F4F6FB] px-3.5 py-2 text-sm text-[#101A3A] outline-none transition focus:border-[#2F5BFF] focus:bg-white"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#101A3A] mb-1">
              Credit Amount
            </label>
            <input
              type="number"
              min="1"
              max="100"
              required
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-xl border border-[#101A3A]/15 bg-[#F4F6FB] px-3.5 py-2 text-sm text-[#101A3A] outline-none transition focus:border-[#2F5BFF] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#101A3A] mb-1">
              Audit Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Compensation for timeout"
              className="w-full rounded-xl border border-[#101A3A]/15 bg-[#F4F6FB] px-3.5 py-2 text-sm text-[#101A3A] outline-none transition focus:border-[#2F5BFF] focus:bg-white"
            />
          </div>
        </div>

        {result && (
          <div
            className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium ${
              result.success
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {result.success ? (
              <>
                <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                <span>
                  {result.message} New balance: <strong>{result.newBalance} credits</strong>.
                </span>
              </>
            ) : (
              <>
                <AlertCircle size={15} className="text-red-600 shrink-0" />
                <span>{result.error}</span>
              </>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2F5BFF] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2548cc] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Granting…
            </>
          ) : (
            <>
              <Coins size={16} />
              Grant Credits
            </>
          )}
        </button>
      </form>
    </div>
  );
}
