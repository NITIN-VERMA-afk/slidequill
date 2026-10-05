"use client";

import { clsx } from "clsx";
import type { SlideData } from "@/lib/slides-schema";
import { getTheme } from "@/lib/themes";
import { useEffect, useState } from "react";

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

  // Load Google Fonts dynamically
  useEffect(() => {
    const heading = t.headingFont.name.replace(/ /g, "+");
    const body = t.bodyFont.name.replace(/ /g, "+");
    const url = `https://fonts.googleapis.com/css2?family=${heading}:wght@400;700;800&family=${body}:wght@400;500;700&display=swap`;
    
    let link = document.querySelector(`link[href="${url}"]`);
    if (!link) {
      link = document.createElement("link");
      (link as HTMLLinkElement).rel = "stylesheet";
      (link as HTMLLinkElement).href = url;
      document.head.appendChild(link);
    }
  }, [t.headingFont.name, t.bodyFont.name]);

  const styleHeading = {
    fontFamily: `"${t.headingFont.name}", ${t.headingFont.fallback}, sans-serif`,
    color: t.colors.accent,
  };
  
  const styleBody = {
    fontFamily: `"${t.bodyFont.name}", ${t.bodyFont.fallback}, sans-serif`,
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

  return (
    <div
      className={clsx(
        "relative w-full aspect-video overflow-hidden @container shadow-sm border border-black/10 transition-colors duration-300",
        className
      )}
      style={{ backgroundColor: t.colors.bg, ...styleBody }}
    >
      {/* Title Layout */}
      {slide.layout === "title" && (
        <div className="absolute inset-0 flex">
          {t.titleSlideStyle === "split" ? (
            <>
              <div className="w-1/2 flex flex-col justify-center px-[8cqw]" style={{ backgroundColor: t.colors.surface }}>
                <h1 className="text-[6cqw] font-extrabold leading-tight mb-[2cqw]" style={styleHeading}>
                  {slide.title}
                </h1>
                {slide.content.subtitle && (
                  <p className="text-[3cqw]" style={{ color: t.colors.mutedText }}>{slide.content.subtitle}</p>
                )}
              </div>
              <div className="w-1/2 flex items-center justify-center p-[5cqw]">
                {/* Decorative element for split right side */}
                <div className="w-[20cqw] h-[20cqw]" style={{ ...roundedStyle, backgroundColor: t.colors.accent, opacity: 0.1 }} />
              </div>
            </>
          ) : (
            <div className={clsx("flex-1 flex flex-col justify-center px-[10cqw]", t.titleSlideStyle === "center" ? "items-center text-center" : "items-start")}>
              <h1 className="text-[7cqw] font-extrabold leading-tight mb-[3cqw]" style={styleHeading}>
                {slide.title}
              </h1>
              {slide.content.subtitle && (
                <p className="text-[3.5cqw]" style={{ color: t.colors.mutedText }}>{slide.content.subtitle}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Standard Layouts Header */}
      {slide.layout !== "title" && slide.layout !== "closing" && (
        <div className="absolute top-[4cqw] left-[5cqw] right-[5cqw] h-[10cqw]">
          <h2 className="text-[4cqw] font-bold leading-tight" style={styleHeading}>
            {slide.title}
          </h2>
          <div className="h-[0.5cqw] w-[10cqw] mt-[1.5cqw]" style={{ backgroundColor: t.colors.accent, ...roundedStyle }} />
        </div>
      )}

      {/* Standard Layouts Content Area */}
      {slide.layout !== "title" && slide.layout !== "closing" && (
        <div className="absolute top-[16cqw] bottom-[5cqw] left-[5cqw] right-[5cqw] flex flex-col overflow-y-auto">
          
          {slide.layout === "bullets" && (
            <ul className="list-none space-y-[2.5cqw] text-[3.5cqw]">
              {slide.content.bullets?.map((b: string, i: number) => (
                <li key={i} className="flex gap-[2cqw] items-start">
                  <span className="mt-[1cqw] w-[1cqw] h-[1cqw] shrink-0" style={{ backgroundColor: t.colors.accent, ...roundedStyle }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {slide.layout === "two_column" && (
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
          )}

          {slide.layout === "stats" && (
            <div className="flex-1 flex flex-wrap items-center justify-center gap-[4cqw]">
              {slide.content.stats?.map((s, i: number) => (
                <div key={i} className="flex-1 min-w-[30%] flex flex-col items-center justify-center text-center p-[3cqw]" style={{ backgroundColor: t.colors.surface, ...roundedStyle }}>
                  <div className="text-[8cqw] font-black leading-none" style={{ color: t.colors.accent, fontFamily: styleHeading.fontFamily }}>
                    {s.value}
                  </div>
                  <div className="text-[2.2cqw] font-medium mt-[1cqw] uppercase tracking-wider" style={{ color: t.colors.mutedText }}>
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
                    {i + 1}
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
            <div className="flex-1 flex flex-col items-center justify-center text-center px-[10cqw]">
              <div className="text-[10cqw] leading-none h-[6cqw] opacity-20" style={{ color: t.colors.accent, fontFamily: styleHeading.fontFamily }}>&quot;</div>
              <p className="text-[4.5cqw] font-medium italic mb-[4cqw] leading-relaxed" style={{ color: t.colors.text }}>
                {slide.content.quote}
              </p>
              {slide.content.attribution && (
                <p className="text-[2.5cqw] font-bold uppercase tracking-widest" style={{ color: t.colors.mutedText }}>
                  — {slide.content.attribution}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Closing Layout */}
      {slide.layout === "closing" && (
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
      )}
    </div>
  );
}
