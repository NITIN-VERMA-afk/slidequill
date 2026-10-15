"use client";

import { clsx } from "clsx";
import type { SlideData } from "@/lib/slides-schema";
import { getTheme } from "@/lib/themes";
import { SlideIcon } from "./SlideIcon";
import { SlideChart } from "./SlideCharts";

interface SlideRendererProps {
  slide: SlideData;
  theme?: string;
  className?: string;
}

export default function SlideRenderer({
  slide,
  theme = "modern",
  className,
}: SlideRendererProps) {
  const t = getTheme(theme);

  const styleHeading = {
    fontFamily: `"${t.headingFont.name}", ${t.headingFont.fallback}`,
    color: t.colors.accent,
  };

  const styleBody = {
    fontFamily: `"${t.bodyFont.name}", ${t.bodyFont.fallback}`,
    color: t.colors.text,
  };

  const roundedStyle = { borderRadius: `${t.cornerRadius}cqw` };

  if (!slide?.content) {
    return (
      <div
        className={clsx(
          "relative w-full aspect-video overflow-hidden @container shadow-sm border border-black/10 flex items-center justify-center p-[10cqw] text-center",
          className
        )}
        style={{ backgroundColor: t.colors.bg, ...styleBody }}
      >
        <div>
          <h1 className="text-[5cqw] font-bold mb-[2cqw]" style={{ color: t.colors.text }}>{slide?.title || "Slide"}</h1>
          <p className="text-[3cqw]" style={{ color: t.colors.mutedText }}>Content is missing or failed to generate.</p>
        </div>
      </div>
    );
  }

  const isFullBleedImage = slide.layout === "image" && slide.content.variant === "full_bleed";

  return (
    <div
      className={clsx(
        "relative w-full aspect-video overflow-hidden @container shadow-sm border border-black/10 transition-colors duration-300",
        className
      )}
      style={{ backgroundColor: t.colors.bg, ...styleBody }}
    >
      {/* Title Layout */}
      {slide.layout === "title" && (() => {
        const hasBgImage = Boolean(slide.content.imageUrl && (slide.content.imagePlacement === "background" || (!slide.content.imagePlacement && t.titleSlideStyle !== "split")));
        const hasRightImage = Boolean(slide.content.imageUrl && (slide.content.imagePlacement === "right" || t.titleSlideStyle === "split"));

        if (hasBgImage) {
          return (
            <div className="absolute inset-0">
              <img
                src={slide.content.imageUrl}
                alt={slide.content.imageQuery || slide.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/35 flex flex-col justify-center px-[10cqw]">
                <h1 className="text-[6.5cqw] font-extrabold leading-tight mb-[2.5cqw] text-white">
                  {slide.title}
                </h1>
                {slide.content.subtitle && (
                  <p className="text-[3.2cqw] text-white/85 max-w-3xl">{slide.content.subtitle}</p>
                )}
                {slide.content.photographer && (
                  <div className="absolute bottom-2 right-3 text-white/50 text-[1.2cqw]">
                    Photo: {slide.content.photographer}
                  </div>
                )}
              </div>
            </div>
          );
        }

        if (t.titleSlideStyle === "split" || hasRightImage) {
          return (
            <div className="absolute inset-0 flex">
              <div className="w-1/2 flex flex-col justify-center px-[8cqw]" style={{ backgroundColor: t.colors.surface }}>
                <h1 className="text-[6cqw] font-extrabold leading-tight mb-[2cqw]" style={styleHeading}>
                  {slide.title}
                </h1>
                {slide.content.subtitle && (
                  <p className="text-[3cqw]" style={{ color: t.colors.mutedText }}>{slide.content.subtitle}</p>
                )}
              </div>
              <div className="w-1/2 flex items-center justify-center p-[5cqw]">
                {slide.content.imageUrl ? (
                  <div className="w-full h-full relative rounded-2xl overflow-hidden shadow-md">
                    <img
                      src={slide.content.imageUrl}
                      alt={slide.content.imageQuery || slide.title}
                      className="w-full h-full object-cover"
                    />
                    {slide.content.photographer && (
                      <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[1cqw] px-1.5 py-0.5 rounded">
                        Photo: {slide.content.photographer}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-[20cqw] h-[20cqw]" style={{ ...roundedStyle, backgroundColor: t.colors.accent, opacity: 0.1 }} />
                )}
              </div>
            </div>
          );
        }

        return (
          <div className={clsx("flex-1 flex flex-col justify-center px-[10cqw]", t.titleSlideStyle === "center" ? "items-center text-center" : "items-start")}>
            <h1 className="text-[7cqw] font-extrabold leading-tight mb-[3cqw]" style={styleHeading}>
              {slide.title}
            </h1>
            {slide.content.subtitle && (
              <p className="text-[3.5cqw]" style={{ color: t.colors.mutedText }}>{slide.content.subtitle}</p>
            )}
          </div>
        );
      })()}

      {/* Standard Layouts Header (except title, closing, and full-bleed image) */}
      {slide.layout !== "title" && slide.layout !== "closing" && !isFullBleedImage && (
        <div className="absolute top-[4cqw] left-[5cqw] right-[5cqw] h-[10cqw]">
          <h2 className="text-[4cqw] font-bold leading-tight" style={styleHeading}>
            {slide.title}
          </h2>
          <div className="h-[0.5cqw] w-[10cqw] mt-[1.5cqw]" style={{ backgroundColor: t.colors.accent, ...roundedStyle }} />
        </div>
      )}

      {/* Standard Layouts Content Area */}
      {slide.layout !== "title" && slide.layout !== "closing" && !isFullBleedImage && (
        <div className="absolute top-[18cqw] bottom-[4cqw] left-[5cqw] right-[5cqw] flex flex-col overflow-hidden">
          
          {slide.layout === "bullets" && (
            slide.content.imageUrl ? (
              <div className="flex-1 flex gap-[4cqw] items-center">
                <div className="w-[58%]">
                  <ul className="list-none space-y-[2cqw] text-[2.8cqw]">
                    {slide.content.bullets?.map((b: string, i: number) => {
                      const iconName = slide.content.icons?.[i];
                      return (
                        <li key={i} className="flex gap-[1.5cqw] items-start">
                          {iconName ? (
                            <span className="mt-[0.5cqw] shrink-0 text-[2.6cqw]" style={{ color: t.colors.accent }}>
                              <SlideIcon name={iconName} size="1.2em" />
                            </span>
                          ) : (
                            <span className="mt-[1cqw] w-[0.8cqw] h-[0.8cqw] shrink-0" style={{ backgroundColor: t.colors.accent, ...roundedStyle }} />
                          )}
                          <span>{b}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="w-[42%] h-full relative rounded-xl overflow-hidden shadow-sm" style={{ backgroundColor: t.colors.surface }}>
                  <img
                    src={slide.content.imageUrl}
                    alt={slide.content.imageQuery || "Slide photo"}
                    className="w-full h-full object-cover"
                  />
                  {slide.content.photographer && (
                    <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[1cqw] px-1.5 py-0.5 rounded">
                      Photo: {slide.content.photographer}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <ul className="list-none space-y-[2.2cqw] text-[3.2cqw]">
                {slide.content.bullets?.map((b: string, i: number) => {
                  const iconName = slide.content.icons?.[i];
                  return (
                    <li key={i} className="flex gap-[2cqw] items-start">
                      {iconName ? (
                        <span className="mt-[0.5cqw] shrink-0 text-[3cqw]" style={{ color: t.colors.accent }}>
                          <SlideIcon name={iconName} size="1.2em" />
                        </span>
                      ) : (
                        <span className="mt-[1cqw] w-[1cqw] h-[1cqw] shrink-0" style={{ backgroundColor: t.colors.accent, ...roundedStyle }} />
                      )}
                      <span>{b}</span>
                    </li>
                  );
                })}
              </ul>
            )
          )}

          {slide.layout === "two_column" && (
            slide.content.imageUrl ? (
              <div className="flex-1 flex gap-[4cqw] items-center">
                <div className="w-[60%] grid grid-cols-2 gap-[3cqw] h-full">
                  {[slide.content.left, slide.content.right].map((col, idx) => (
                    <div key={idx} className="p-[2.5cqw] h-full" style={{ backgroundColor: t.colors.surface, ...roundedStyle }}>
                      {col?.heading && (
                        <h3 className="text-[2.6cqw] font-bold mb-[1.5cqw]" style={styleHeading}>{col.heading}</h3>
                      )}
                      <ul className="list-none space-y-[1.2cqw] text-[2.2cqw]">
                        {col?.bullets?.map((b: string, i: number) => (
                          <li key={i} className="flex gap-[1cqw] items-start">
                            <span className="mt-[0.8cqw] w-[0.6cqw] h-[0.6cqw] shrink-0" style={{ backgroundColor: t.colors.accent2, ...roundedStyle }} />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="w-[40%] h-full relative rounded-xl overflow-hidden shadow-sm" style={{ backgroundColor: t.colors.surface }}>
                  <img
                    src={slide.content.imageUrl}
                    alt={slide.content.imageQuery || "Slide photo"}
                    className="w-full h-full object-cover"
                  />
                  {slide.content.photographer && (
                    <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[1cqw] px-1.5 py-0.5 rounded">
                      Photo: {slide.content.photographer}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-2 gap-[5cqw]">
                {[slide.content.left, slide.content.right].map((col, idx) => (
                  <div key={idx} className="p-[3cqw] h-full" style={{ backgroundColor: t.colors.surface, ...roundedStyle }}>
                    {col?.heading && (
                      <h3 className="text-[3cqw] font-bold mb-[2cqw]" style={styleHeading}>{col.heading}</h3>
                    )}
                    <ul className="list-none space-y-[1.5cqw] text-[2.5cqw]">
                      {col?.bullets?.map((b: string, i: number) => (
                        <li key={i} className="flex gap-[1.5cqw] items-start">
                          <span className="mt-[1cqw] w-[0.7cqw] h-[0.7cqw] shrink-0" style={{ backgroundColor: t.colors.accent2, ...roundedStyle }} />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )
          )}

          {slide.layout === "stats" && (
            <div className="flex-1 flex flex-wrap items-center justify-center gap-[4cqw]">
              {slide.content.stats?.map((s, i: number) => (
                <div key={i} className="flex-1 min-w-[30%] flex flex-col items-center justify-center text-center p-[3cqw]" style={{ backgroundColor: t.colors.surface, ...roundedStyle }}>
                  {s.icon && (
                    <div className="mb-[1cqw] text-[4cqw]" style={{ color: t.colors.accent }}>
                      <SlideIcon name={s.icon} size="1.2em" />
                    </div>
                  )}
                  <div className="text-[7cqw] font-black leading-none" style={{ color: t.colors.accent, fontFamily: styleHeading.fontFamily }}>
                    {s.value}
                  </div>
                  <div className="text-[2cqw] font-medium mt-[1cqw] uppercase tracking-wider" style={{ color: t.colors.mutedText }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {slide.layout === "process" && (
            <div className="flex-1 flex items-center justify-between gap-[2cqw]">
              {slide.content.steps?.map((s, i: number) => (
                <div key={i} className="flex-1 flex flex-col items-center text-center relative z-10">
                  <div className="w-[7cqw] h-[7cqw] flex items-center justify-center text-[3cqw] font-bold mb-[2cqw]" style={{ backgroundColor: t.colors.accent, color: t.colors.bg, borderRadius: t.cornerRadius > 0 ? "50%" : "0" }}>
                    {s.icon ? <SlideIcon name={s.icon} size="1.2em" /> : i + 1}
                  </div>
                  <div className="text-[2.5cqw] font-bold mb-[1cqw]" style={{ color: t.colors.text }}>{s.label}</div>
                  <div className="text-[1.8cqw]" style={{ color: t.colors.mutedText }}>{s.desc}</div>
                </div>
              ))}
              {/* Connecting line behind steps */}
              <div className="absolute top-[3.5cqw] left-[10%] right-[10%] h-[0.5cqw] z-0" style={{ backgroundColor: t.colors.surface }} />
            </div>
          )}

          {slide.layout === "comparison" && (
            <div className="flex-1 flex gap-[3cqw]">
              {slide.content.columns?.map((col, i: number) => (
                <div key={i} className="flex-1 border-t-[0.5cqw] pt-[2cqw]" style={{ borderColor: i === 0 ? t.colors.accent : t.colors.accent2 }}>
                  <h3 className="text-[3.2cqw] font-bold mb-[2.5cqw]" style={{ color: t.colors.text, fontFamily: styleHeading.fontFamily }}>{col.heading}</h3>
                  <ul className="space-y-[1.5cqw] text-[2.5cqw]">
                    {col.bullets?.map((b: string, j: number) => (
                      <li key={j} className="flex gap-[1.5cqw] items-start">
                        <span className="mt-[1cqw] w-[0.7cqw] h-[0.7cqw] shrink-0" style={{ backgroundColor: t.colors.mutedText, ...roundedStyle }} />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {slide.layout === "quote" && (
            slide.content.imageUrl && slide.content.imagePlacement === "right" ? (
              <div className="flex-1 flex gap-[4cqw] items-center">
                <div className="w-[58%] flex flex-col justify-center px-[4cqw]">
                  <div className="text-[8cqw] leading-none h-[5cqw] opacity-20" style={{ color: t.colors.accent, fontFamily: styleHeading.fontFamily }}>&quot;</div>
                  <p className="text-[3.4cqw] font-medium italic mb-[2cqw] leading-relaxed" style={{ color: t.colors.text }}>
                    {slide.content.quote}
                  </p>
                  {slide.content.attribution && (
                    <p className="text-[2.2cqw] font-bold uppercase tracking-widest" style={{ color: t.colors.mutedText }}>
                      — {slide.content.attribution}
                    </p>
                  )}
                </div>
                <div className="w-[42%] h-full relative rounded-xl overflow-hidden shadow-sm" style={{ backgroundColor: t.colors.surface }}>
                  <img
                    src={slide.content.imageUrl}
                    alt={slide.content.attribution || "Quote author"}
                    className="w-full h-full object-cover"
                  />
                  {slide.content.photographer && (
                    <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[1cqw] px-1.5 py-0.5 rounded">
                      Photo: {slide.content.photographer}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-[10cqw]">
                <div className="text-[10cqw] leading-none h-[6cqw] opacity-20" style={{ color: t.colors.accent, fontFamily: styleHeading.fontFamily }}>&quot;</div>
                <p className="text-[4.2cqw] font-medium italic mb-[3cqw] leading-relaxed" style={{ color: t.colors.text }}>
                  {slide.content.quote}
                </p>
                {slide.content.attribution && (
                  <p className="text-[2.4cqw] font-bold uppercase tracking-widest" style={{ color: t.colors.mutedText }}>
                    — {slide.content.attribution}
                  </p>
                )}
              </div>
            )
          )}

          {/* Chart Layout */}
          {slide.layout === "chart" && (
            <div className="flex-1 flex flex-col min-h-0">
              <SlideChart
                chartType={slide.content.chartType || "bar"}
                categories={slide.content.categories || []}
                series={slide.content.series || []}
                accentColor={t.colors.accent}
                accent2Color={t.colors.accent2}
                surfaceColor={t.colors.surface}
                textColor={t.colors.text}
                mutedColor={t.colors.mutedText}
              />
              {slide.content.caption && (
                <p className="text-center text-[1.8cqw] mt-[1cqw] italic" style={{ color: t.colors.mutedText }}>
                  {slide.content.caption}
                </p>
              )}
            </div>
          )}

          {/* Image Layout (Split variant) */}
          {slide.layout === "image" && slide.content.variant !== "full_bleed" && (
            <div className="flex-1 flex gap-[4cqw] items-center">
              <div className="w-1/2 h-full relative rounded-xl overflow-hidden shadow-sm" style={{ backgroundColor: t.colors.surface }}>
                {slide.content.imageUrl ? (
                  <img
                    src={slide.content.imageUrl}
                    alt={slide.content.imageKeyword || "Slide graphic"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[2cqw]" style={{ color: t.colors.mutedText }}>
                    {slide.content.imageKeyword || "Image placeholder"}
                  </div>
                )}
                {slide.content.photographer && (
                  <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[1cqw] px-1.5 py-0.5 rounded">
                    Photo: {slide.content.photographer}
                  </div>
                )}
              </div>
              <div className="w-1/2 flex flex-col justify-center gap-[2cqw]">
                {slide.content.heading && (
                  <h3 className="text-[3.2cqw] font-bold leading-tight" style={styleHeading}>
                    {slide.content.heading}
                  </h3>
                )}
                {slide.content.bullets && (
                  <ul className="space-y-[1.5cqw] text-[2.5cqw]">
                    {slide.content.bullets.map((b: string, idx: number) => (
                      <li key={idx} className="flex gap-[1.5cqw] items-start">
                        <span className="mt-[1cqw] w-[0.7cqw] h-[0.7cqw] shrink-0" style={{ backgroundColor: t.colors.accent, ...roundedStyle }} />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {slide.content.caption && (
                  <p className="text-[2.2cqw] italic leading-relaxed" style={{ color: t.colors.mutedText }}>
                    {slide.content.caption}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Image Layout (Full Bleed variant) */}
      {isFullBleedImage && (
        <div className="absolute inset-0">
          {slide.content.imageUrl && (
            <img
              src={slide.content.imageUrl}
              alt={slide.content.imageKeyword || "Background"}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20 flex flex-col justify-end p-[6cqw]">
            <h1 className="text-[5.5cqw] font-black text-white leading-tight mb-[2cqw]">
              {slide.title}
            </h1>
            {slide.content.caption && (
              <p className="text-[2.8cqw] text-white/90 max-w-2xl leading-relaxed">
                {slide.content.caption}
              </p>
            )}
            {slide.content.photographer && (
              <div className="mt-[2cqw] text-[1.4cqw] text-white/60">
                Photo by {slide.content.photographer}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Closing Layout */}
      {slide.layout === "closing" && (() => {
        const hasBgImage = Boolean(slide.content.imageUrl && (slide.content.imagePlacement === "background" || !slide.content.imagePlacement));
        const hasRightImage = Boolean(slide.content.imageUrl && slide.content.imagePlacement === "right");

        if (hasBgImage) {
          return (
            <div className="absolute inset-0">
              <img
                src={slide.content.imageUrl}
                alt={slide.content.headline || "Closing"}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/35 flex flex-col items-center justify-center text-center px-[10cqw]">
                <h1 className="text-[6cqw] font-extrabold leading-tight mb-[3cqw] text-white">
                  {slide.content.headline}
                </h1>
                {slide.content.cta && (
                  <div className="px-[4cqw] py-[2cqw] text-[3cqw] font-bold shadow-lg" style={{ backgroundColor: t.colors.accent, color: t.colors.bg, ...roundedStyle }}>
                    {slide.content.cta}
                  </div>
                )}
                {slide.content.photographer && (
                  <div className="absolute bottom-2 right-3 text-white/50 text-[1.2cqw]">
                    Photo: {slide.content.photographer}
                  </div>
                )}
              </div>
            </div>
          );
        }

        if (hasRightImage) {
          return (
            <div className="absolute inset-0 flex">
              <div className="w-1/2 flex flex-col justify-center items-start px-[8cqw]">
                <h1 className="text-[5.5cqw] font-extrabold leading-tight mb-[3cqw]" style={styleHeading}>
                  {slide.content.headline}
                </h1>
                {slide.content.cta && (
                  <div className="px-[4cqw] py-[2cqw] text-[2.8cqw] font-bold shadow-md" style={{ backgroundColor: t.colors.accent, color: t.colors.bg, ...roundedStyle }}>
                    {slide.content.cta}
                  </div>
                )}
              </div>
              <div className="w-1/2 flex items-center justify-center p-[5cqw]">
                <div className="w-full h-full relative rounded-2xl overflow-hidden shadow-md">
                  <img
                    src={slide.content.imageUrl}
                    alt={slide.content.headline || "Closing graphic"}
                    className="w-full h-full object-cover"
                  />
                  {slide.content.photographer && (
                    <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[1cqw] px-1.5 py-0.5 rounded">
                      Photo: {slide.content.photographer}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-[10cqw]">
            <h1 className="text-[6cqw] font-extrabold leading-tight mb-[3cqw]" style={styleHeading}>
              {slide.content.headline}
            </h1>
            {slide.content.cta && (
              <div className="px-[4cqw] py-[2cqw] text-[3cqw] font-bold" style={{ backgroundColor: t.colors.accent, color: t.colors.bg, ...roundedStyle }}>
                {slide.content.cta}
              </div>
            )}
          </div>
        );
      })()}

      {/* Grounded Source or Fallback Indicator */}
      {(slide.sourceSection || slide.sourcePage || slide.meta?.fallback) && (
        <div
          className="absolute bottom-[1.5cqw] right-[2.5cqw] flex items-center gap-[1cqw] text-[1.4cqw] px-[1.2cqw] py-[0.4cqw] rounded-full pointer-events-none opacity-70"
          style={{
            backgroundColor: t.colors.surface,
            color: t.colors.mutedText,
          }}
        >
          {slide.meta?.fallback && <span className="font-semibold text-amber-500">Auto-generated</span>}
          {slide.sourceSection && (
            <span className="truncate max-w-[20cqw]">Source: {slide.sourceSection}</span>
          )}
          {slide.sourcePage && <span>p.{slide.sourcePage}</span>}
        </div>
      )}
    </div>
  );
}

