"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import SlideRenderer from "@/components/app/SlideRenderer";
import type { PublicDeckPayload } from "@/lib/share";

interface PublicPresentationViewerProps {
  deck: PublicDeckPayload;
}

export default function PublicPresentationViewer({ deck }: PublicPresentationViewerProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const slides = deck.slides || [];
  const total = slides.length;

  const nextSlide = useCallback(() => {
    setCurrentIdx((prev) => Math.min(total - 1, prev + 1));
  }, [total]);

  const prevSlide = useCallback(() => {
    setCurrentIdx((prev) => Math.max(0, prev - 1));
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      } else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, []);

  // Sync fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown" || e.key === "Enter") {
        e.preventDefault();
        nextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp" || e.key === "Backspace") {
        e.preventDefault();
        prevSlide();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "Home") {
        e.preventDefault();
        setCurrentIdx(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setCurrentIdx(total - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, prevSlide, toggleFullscreen, total]);

  if (total === 0) {
    return (
      <div className="min-h-screen bg-[#0A0D18] text-white flex items-center justify-center p-6 text-center">
        <p className="text-white/60">This presentation has no slides.</p>
      </div>
    );
  }

  const currentSlide = slides[currentIdx];

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen bg-[#070913] text-white overflow-hidden flex flex-col justify-between select-none"
    >
      {/* Top Floating Bar */}
      <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <h1 className="text-sm font-semibold text-white/90 truncate max-w-md pointer-events-auto">
          {deck.title}
        </h1>
        <div className="flex items-center gap-3 pointer-events-auto">
          <span className="text-xs font-medium text-white/70 bg-white/10 px-2.5 py-1 rounded-full backdrop-blur-sm">
            {currentIdx + 1} / {total}
          </span>
          <button
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </header>

      {/* Main Slide Stage (Responsive 16:9, fits within viewport without overflow) */}
      <main
        className="flex-1 flex items-center justify-center p-3 sm:p-6 min-h-0 overflow-hidden relative"
        onClick={nextSlide}
      >
        <div
          className="aspect-video rounded-xl shadow-2xl overflow-hidden ring-1 ring-white/10 bg-white relative flex items-center justify-center cursor-pointer"
          style={{
            maxHeight: "calc(100vh - 130px)",
            maxWidth: "min(100%, calc((100vh - 130px) * (16 / 9)))",
            width: "100%",
          }}
          title="Click slide to advance"
        >
          <SlideRenderer
            slide={currentSlide as any}
            theme={deck.theme}
            editable={false}
            className="w-full h-full pointer-events-none"
          />

          {/* Watermark for free owners only */}
          {deck.showWatermark && (
            <div
              className="absolute bottom-2 left-2 z-20 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <a
                href="https://slidequill.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 hover:bg-black/80 text-white/80 hover:text-white text-[11px] font-medium backdrop-blur-sm transition border border-white/10"
              >
                <span>Made with</span>
                <span className="font-bold text-[#2F5BFF]">SlideQuill</span>
              </a>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Floating Controls */}
      <footer className="absolute bottom-0 inset-x-0 z-30 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between pointer-events-none">
        {/* Progress Bar */}
        <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden pointer-events-auto">
          <div
            className="h-full bg-[#2F5BFF] transition-all duration-300"
            style={{ width: `${((currentIdx + 1) / total) * 100}%` }}
          />
        </div>

        {/* Navigation Arrows */}
        <div className="flex items-center gap-2.5 pr-12 sm:pr-6 pointer-events-auto">
          <button
            onClick={prevSlide}
            disabled={currentIdx === 0}
            aria-label="Previous Slide (Left Arrow)"
            title="Previous Slide (Left Arrow)"
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 text-white transition backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={nextSlide}
            disabled={currentIdx === total - 1}
            aria-label="Next Slide (Right Arrow)"
            title="Next Slide (Right Arrow)"
            className="p-2.5 rounded-full bg-[#2F5BFF] hover:bg-[#2548cc] disabled:opacity-20 text-white transition backdrop-blur-sm shadow-lg focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </footer>
    </div>
  );
}
