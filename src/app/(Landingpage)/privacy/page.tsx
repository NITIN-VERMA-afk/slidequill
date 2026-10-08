import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Slidequill",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 md:py-20 text-[#101A3A]">
      <h1 className="text-3xl md:text-5xl font-extrabold [font-family:var(--font-display)] mb-4">
        Privacy Policy
      </h1>
      <p className="text-sm text-[#5a6384] mb-8">Last updated: October 7, 2026</p>

      <div className="prose prose-slate max-w-none prose-a:text-[#2F5BFF]">
        <p>
          At Slidequill, your privacy is a top priority. This Privacy Policy explains how we collect, use, and protect your information when you use our service.
        </p>

        <h2>1. Information We Collect</h2>
        <p>
          We collect your name and email address when you create an account. We also collect the documents (PDFs, DOCX, text) that you upload to generate slides, as well as the resulting slide decks. 
          We use cookies solely for login and session management.
        </p>

        <h2>2. How We Use Your Information</h2>
        <p>
          Your documents and text are sent to an external AI provider (OpenAI) strictly for the purpose of generating your slides. We do not use your documents to train our own models. 
          Payment processing is handled securely by Razorpay. We do not collect or store your credit card details.
        </p>

        <h2>3. Data Retention</h2>
        <p>
          Uploaded source documents and text are automatically deleted after a brief period (configurable by our system, typically within 7 days). Generated slide decks are kept until you choose to delete them.
        </p>

        <h2>4. Your Rights</h2>
        <p>
          You can request the deletion of your account and all associated data at any time by contacting us.
        </p>

        <h2>5. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy, please contact us at:
          <br />
          <strong>Email:</strong> nitinvermanv61506@gmail.com 
          <br />
          <strong>Phone:</strong> +91 9015308881
        </p>
      </div>
    </main>
  );
}
