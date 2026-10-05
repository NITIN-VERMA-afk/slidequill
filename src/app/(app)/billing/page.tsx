import { CreditCard, Zap } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "₹0",
    desc: "3 decks to try",
    highlight: false,
  },
  {
    name: "Credits",
    price: "₹199",
    desc: "20 decks, never expire",
    highlight: true,
  },
];

export default function BillingPage() {
  return (
    <div>
      <h2 className="text-2xl font-extrabold text-[#101A3A] [font-family:var(--font-display)]">
        Billing
      </h2>
      <p className="mt-1 text-sm text-[#5a6384]">
        Manage your credits and plan
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 max-w-2xl">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`rounded-2xl border p-6 ${
              p.highlight
                ? "border-[#2F5BFF]/40 bg-[#2F5BFF]/5"
                : "border-[#101A3A]/10 bg-white"
            }`}
          >
            <div className="flex items-center gap-2">
              {p.highlight ? (
                <Zap size={18} className="text-[#2F5BFF]" />
              ) : (
                <CreditCard size={18} className="text-[#5a6384]" />
              )}
              <span className="font-semibold text-[#101A3A] [font-family:var(--font-display)]">
                {p.name}
              </span>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-[#101A3A] [font-family:var(--font-display)]">
              {p.price}
            </p>
            <p className="mt-1 text-sm text-[#5a6384]">{p.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
