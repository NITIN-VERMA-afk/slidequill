import { LayoutTemplate } from "lucide-react";

export default function TemplatesPage() {
  return (
    <div>
      <h2 className="text-2xl font-extrabold text-[#101A3A] [font-family:var(--font-display)]">
        Templates
      </h2>
      <p className="mt-1 text-sm text-[#5a6384]">
        Choose a style for your next deck
      </p>

      <div className="mt-16 flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#101A3A]/5">
          <LayoutTemplate size={28} className="text-[#5a6384]" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-[#101A3A] [font-family:var(--font-display)]">
          Templates coming soon
        </h3>
        <p className="mt-2 max-w-sm text-sm text-[#5a6384]">
          Pick from professionally designed slide themes when you create a deck.
        </p>
      </div>
    </div>
  );
}
