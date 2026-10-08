"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { CreditCard, Zap, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { PLANS } from "@/lib/plans";
import { clsx } from "clsx";
import Link from "next/link";

interface PaymentRecord {
  _id: string;
  planId: string;
  amountPaise: number;
  credits: number;
  status: string;
  createdAt: string;
}

export default function BillingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [buyingPlan, setBuyingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);
  const [history, setHistory] = useState<PaymentRecord[]>([]);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/billing/history");
      if (res.ok) {
        const data = await res.json();
        setCredits(data.credits);
        setHistory(data.payments);
      }
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleBuy = async (planId: string) => {
    if (typeof window === "undefined" || !(window as any).Razorpay) {
      setError("Razorpay SDK failed to load. Please refresh.");
      return;
    }
    
    setError(null);
    setBuyingPlan(planId);

    try {
      const orderRes = await fetch("/api/billing/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const orderData = await orderRes.json();
      
      if (!orderRes.ok) {
        throw new Error(orderData.error || "Failed to create order");
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: "INR",
        name: "Slidequill",
        description: PLANS[planId]?.name || "Credits",
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch("/api/billing/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            if (verifyRes.ok) {
              await fetchHistory(); // refresh credits & history
              router.refresh();
              alert("Payment successful! Credits added.");
            } else {
              alert("Payment verification failed. Please contact support.");
            }
          } catch (e) {
            alert("Error verifying payment.");
          } finally {
            setBuyingPlan(null);
          }
        },
        prefill: {
          name: "User",
        },
        theme: {
          color: "#2F5BFF",
        },
        modal: {
          ondismiss: function () {
            setBuyingPlan(null);
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        setError(`Payment failed: ${response.error.description}`);
        setBuyingPlan(null);
      });
      rzp.open();
      
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      setBuyingPlan(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[#5a6384]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] h-full">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      
      <div className="flex-1">
        <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-[#101A3A] [font-family:var(--font-display)]">
            Billing
          </h2>
          <p className="mt-1 text-sm text-[#5a6384]">
            Manage your credits and plan
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[#2F5BFF]/10 text-[#2F5BFF] px-4 py-2 rounded-xl font-bold">
          <Zap size={18} />
          <span>{credits} Credits</span>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
        {Object.values(PLANS).map((p) => {
          const isBuying = buyingPlan === p.id;
          return (
            <div
              key={p.id}
              className={clsx(
                "rounded-2xl border p-6 flex flex-col justify-between",
                "border-[#101A3A]/10 bg-white shadow-sm"
              )}
            >
              <div>
                <div className="flex items-center gap-2">
                  <Zap size={18} className="text-[#2F5BFF]" />
                  <span className="font-semibold text-[#101A3A] [font-family:var(--font-display)]">
                    {p.name}
                  </span>
                </div>
                <p className="mt-3 text-3xl font-extrabold text-[#101A3A] [font-family:var(--font-display)]">
                  ₹{p.amountPaise / 100}
                </p>
                <p className="mt-1 text-sm text-[#5a6384] mb-6">{p.desc}</p>
              </div>
              <button
                onClick={() => handleBuy(p.id)}
                disabled={!!buyingPlan}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2F5BFF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2548cc] transition disabled:opacity-50"
              >
                {isBuying ? <Loader2 size={16} className="animate-spin" /> : "Buy Now"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-12 max-w-3xl">
        <h3 className="text-lg font-bold text-[#101A3A] [font-family:var(--font-display)] mb-4">
          Payment History
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-[#5a6384]">No payments yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#101A3A]/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F4F6FB] text-[#5a6384]">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#101A3A]/5 text-[#101A3A]">
                {history.map((h) => (
                  <tr key={h._id}>
                    <td className="px-4 py-3">
                      {new Date(h.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{PLANS[h.planId]?.name || h.planId}</td>
                    <td className="px-4 py-3">₹{h.amountPaise / 100}</td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                          h.status === "paid"
                            ? "bg-emerald-50 text-emerald-700"
                            : h.status === "failed"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                        )}
                      >
                        {h.status === "paid" && <CheckCircle2 size={12} />}
                        {h.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
      
      <footer className="mt-auto border-t border-[#101A3A]/5 pt-8 pb-4 flex flex-wrap items-center justify-between gap-4 text-xs text-[#5a6384]">
        <span>© {new Date().getFullYear()} Slidequill</span>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:underline">Privacy</Link>
          <Link href="/terms" className="hover:underline">Terms</Link>
          <Link href="/refund" className="hover:underline">Refund</Link>
          <Link href="/contact" className="hover:underline">Contact</Link>
        </div>
      </footer>
    </div>
  );
}
