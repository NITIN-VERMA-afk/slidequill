import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Slidequill",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 md:py-20 text-[#101A3A]">
      <h1 className="text-3xl md:text-5xl font-extrabold [font-family:var(--font-display)] mb-4">
        Terms of Service
      </h1>
      <p className="text-sm text-[#5a6384] mb-8">Last updated: October 7, 2026</p>

      <div className="prose prose-slate max-w-none prose-a:text-[#2F5BFF]">
        <p>
          Welcome to Slidequill. By accessing or using our service, you agree to these Terms of Service.
        </p>

        <h2>1. Acceptable Use</h2>
        <p>
          You agree to use Slidequill only for lawful purposes. You must not upload content that is illegal, abusive, or infringes on the intellectual property rights of others.
        </p>

        <h2>2. Content Ownership</h2>
        <p>
          You retain full ownership of all documents you upload and the generated slide decks. Slidequill claims no ownership over your content.
        </p>

        <h2>3. Credits and Payments</h2>
        <p>
          Purchased credits are non-transferable and can only be used on the account they were purchased for.
        </p>

        <h2>4. Disclaimer of Warranties</h2>
        <p>
          Slidequill is provided "as is" and "as available". We do not guarantee that the service will be error-free or uninterrupted.
        </p>

        <h2>5. Governing Law</h2>
        <p>
          These Terms of Service are governed by the laws of India.
        </p>

        <h2>6. Contact</h2>
        <p>
          {/* TODO: Add company legal name here */}
          <strong>Legal Entity:</strong> Slidequill Inc.
          <br />
          <strong>Email:</strong> nitinvermanv61506@gmail.com
        </p>
      </div>
    </main>
  );
}
