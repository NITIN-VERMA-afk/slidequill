import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy | Slidequill",
};

export default function RefundPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 md:py-20 text-[#101A3A]">
      <h1 className="text-3xl md:text-5xl font-extrabold [font-family:var(--font-display)] mb-4">
        Refund Policy
      </h1>
      <p className="text-sm text-[#5a6384] mb-8">Last updated: October 7, 2026</p>

      <div className="prose prose-slate max-w-none prose-a:text-[#2F5BFF]">
        <p>
          We want you to be completely satisfied with Slidequill. Here is how our refunds work.
        </p>

        <h2>1. Failed Generations</h2>
        <p>
          If the AI fails to generate your presentation due to an error on our end, the credit is automatically refunded to your account immediately.
        </p>

        <h2>2. Purchases</h2>
        <p>
          Unused credits are refundable within 7 days of purchase. If you have already spent some of the credits from a specific purchase, we cannot refund that transaction.
        </p>

        <h2>3. Requesting a Refund</h2>
        <p>
          To request a refund, please reach out to our support team with your account email and purchase details.
        </p>

        <h2>4. Contact</h2>
        <p>
          <strong>Email:</strong> nitinvermanv61506@gmail.com
        </p>
      </div>
    </main>
  );
}
