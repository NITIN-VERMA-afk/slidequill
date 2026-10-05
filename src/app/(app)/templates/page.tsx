import Link from "next/link";
import { LayoutTemplate, Sparkles, ArrowRight } from "lucide-react";
import { themes } from "@/lib/themes";

const THEME_DESCRIPTIONS: Record<string, string> = {
  modern: "Clean, spacious slides with beautiful typography and a crisp white palette.",
  corporate: "Professional and structured with serif fonts. Perfect for reports and executive decks.",
  creative: "Warm tones, bold rose accents, and expressive typography for creative work.",
  dark: "High-contrast dark background with bright blue accents. Great for pitch decks.",
  playful: "Fuchsia accents and rounded fonts. Ideal for startups and product launches.",
  elegant: "Earthy tones with forest green accents and classic serif fonts for polished reports.",
};

export default function TemplatesPage() {
  const themeList = Object.values(themes);

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h2 className="text-3xl font-extrabold text-[#101A3A] [font-family:var(--font-display)] flex items-center gap-3">
          <LayoutTemplate size={28} className="text-[#2F5BFF]" />
          Templates
        </h2>
        <p className="mt-2 max-w-2xl text-[#5a6384] leading-relaxed">
          Choose a style for your next presentation. Slidequill will apply the theme when generating your deck.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {themeList.map((theme) => (
          <div
            key={theme.id}
            className="group flex flex-col overflow-hidden rounded-2xl border border-[#101A3A]/10 bg-white shadow-sm transition hover:shadow-xl hover:-translate-y-1 hover:border-[#2F5BFF]/30"
          >
            {/* Slide preview */}
            <div
              className="relative aspect-[16/9] w-full overflow-hidden"
              style={{ background: theme.colors.bg }}
            >
              {/* Accent bar */}
              <div
                className="absolute left-0 top-0 h-1.5 w-full"
                style={{ background: theme.colors.accent }}
              />
              {/* Fake slide content */}
              <div className="absolute inset-x-6 top-6 bottom-6 flex flex-col gap-3">
                <div
                  className="h-5 w-2/3 rounded"
                  style={{ background: theme.colors.text, opacity: 0.15 }}
                />
                <div
                  className="h-3 w-1/2 rounded"
                  style={{ background: theme.colors.mutedText, opacity: 0.2 }}
                />
                <div className="mt-2 flex gap-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-lg"
                      style={{
                        height: 48,
                        background: theme.colors.surface,
                        border: `1px solid ${theme.colors.accent}22`,
                      }}
                    />
                  ))}
                </div>
              </div>
              {/* Accent dot */}
              <div
                className="absolute bottom-3 right-4 h-2 w-2 rounded-full"
                style={{ background: theme.colors.accent }}
              />
            </div>

            <div className="flex flex-1 flex-col p-5">
              <h3 className="text-lg font-bold text-[#101A3A] [font-family:var(--font-display)]">
                {theme.name}
              </h3>
              <p className="mt-1 text-sm text-[#5a6384] flex-1">
                {THEME_DESCRIPTIONS[theme.id] ?? "A professionally designed presentation theme."}
              </p>
              <div className="mt-4 flex items-center justify-between pt-4 border-t border-[#101A3A]/5">
                {/* Color swatches */}
                <div className="flex gap-1.5">
                  {[theme.colors.bg, theme.colors.accent, theme.colors.surface, theme.colors.text].map((c, i) => (
                    <span
                      key={i}
                      className="h-4 w-4 rounded-full border border-black/10"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <Link
                  href={`/decks/new?theme=${theme.id}`}
                  className="flex items-center gap-1.5 text-sm font-semibold text-[#2F5BFF] hover:text-[#1d44c8] transition-colors"
                >
                  Use template <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        ))}

        {/* Request Template */}
        <div className="group flex flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#101A3A]/15 bg-[#F4F6FB]/50 p-8 text-center transition hover:border-[#2F5BFF]/40 hover:bg-[#2F5BFF]/5">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-[#101A3A]/5">
            <Sparkles size={24} className="text-[#2F5BFF]" />
          </div>
          <h3 className="text-lg font-bold text-[#101A3A] [font-family:var(--font-display)]">
            Need a custom template?
          </h3>
          <p className="mt-2 text-sm text-[#5a6384] max-w-[200px]">
            Have a specific brand guide? We can build a custom layout for your team.
          </p>
          <button className="mt-6 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#101A3A] shadow-sm ring-1 ring-[#101A3A]/10 transition hover:bg-slate-50 hover:ring-[#101A3A]/20">
            Contact us
          </button>
        </div>
      </div>
    </div>
  );
}
