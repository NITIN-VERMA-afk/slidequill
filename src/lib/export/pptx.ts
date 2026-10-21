import pptxgen from "pptxgenjs";
import type { SlideData } from "../slides-schema";
import { buildSourceCitation } from "../slides-schema";
import { getTheme } from "../themes";
import { fetchSafeImage } from "../safe-image-fetcher";
import { stripStashFromSlide } from "../slide-mutations";
import {
  calculateFittedFontSize,
  PPTX_WIDTH_POINTS,
  PPTX_HEIGHT_POINTS,
} from "../layout-constants";

const PPTX_SLIDE_WIDTH_INCHES = 13.333;

function getCardShape(themeCornerRadius: number | undefined, pptx: pptxgen) {
  const isRounded = typeof themeCornerRadius === "number" && themeCornerRadius > 0;
  if (!isRounded) {
    return {
      shapeType: pptx.ShapeType.rect,
      radiusProps: {},
    };
  }
  const rectRadius = (themeCornerRadius / 100) * PPTX_SLIDE_WIDTH_INCHES;
  return {
    shapeType: pptx.ShapeType.roundRect,
    radiusProps: { rectRadius },
  };
}

async function addSlideImage(
  s: any,
  imageUrl: string | undefined | null,
  rect: { x: string; y: string; w: string; h: string },
  credit?: string,
  creditRect?: { x: string; y: string; w: string; h: string },
  creditColor: string = "94a3b8"
) {
  if (!imageUrl) return;
  try {
    const safeImg = await fetchSafeImage(imageUrl);
    const imgData = safeImg.dataUrl.startsWith("data:")
      ? safeImg.dataUrl
      : `data:${safeImg.dataUrl}`;
    s.addImage({
      data: imgData,
      ...rect,
    });
    if (credit && creditRect) {
      s.addText(`Photo: ${credit}`, {
        ...creditRect,
        fontSize: 9,
        color: creditColor,
        align: "right",
        valign: "top",
      });
    }
  } catch (err) {
    console.warn("[PPTX] Failed to add image to slide:", err);
  }
}

export async function buildPptx(
  deckTitle: string,
  slides: SlideData[],
  themeId: string,
  isFreeUser: boolean,
  sourceName?: string
): Promise<Buffer> {
  const sanitizedSlides = (slides || []).map(stripStashFromSlide);
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE"; // 16:9

  const theme = getTheme(themeId);
  const cardShape = getCardShape(theme.cornerRadius, pptx);
  const bgColor = theme.colors.bg.replace("#", "");
  const surfaceColor = theme.colors.surface.replace("#", "");
  const headingColor = theme.colors.text.replace("#", "");
  const bodyColor = theme.colors.text.replace("#", "");
  const mutedColor = theme.colors.mutedText.replace("#", "");
  const accentColor = theme.colors.accent.replace("#", "");
  const accent2Color = theme.colors.accent2.replace("#", "");

  const headingFont = theme.headingFont.name || theme.headingFont.fallback;
  const bodyFont = theme.bodyFont.name || theme.bodyFont.fallback;

  // Background and master slide
  pptx.defineSlideMaster({
    title: "MASTER_SLIDE",
    background: { color: bgColor },
  });

  for (const slide of sanitizedSlides) {
    const s = pptx.addSlide({ masterName: "MASTER_SLIDE" });
    const c = slide.content as any;

    // Notes: append standardized source reference
    const sourceCitation = buildSourceCitation(
      sourceName,
      slide.sourcePage,
      slide.sourceSection,
      slide.sourcePageApprox
    );
    const fullNotes = slide.notes ? `${slide.notes}\n\n${sourceCitation}` : sourceCitation;
    s.addNotes(fullNotes);

    // Footer for free users
    if (isFreeUser) {
      s.addText("Made with Slidequill", {
        x: "5%",
        y: "95%",
        w: "25%",
        h: "4%",
        fontSize: 10,
        color: mutedColor,
        fontFace: bodyFont,
        valign: "bottom",
      });
    }

    // Footer: source page citation on content slides (omit on title/closing/full-bleed image to prevent collisions)
    const isFullBleedImage = slide.layout === "image" && c?.variant === "full_bleed";
    const canShowCanvasFooter = slide.layout !== "title" && slide.layout !== "closing" && !isFullBleedImage;

    if (canShowCanvasFooter && slide.sourcePage) {
      const rawPageStr = String(slide.sourcePage).trim();
      const isApprox = Boolean(slide.sourcePageApprox || /\(approx\.?\)/i.test(rawPageStr));
      const cleanPage = rawPageStr.replace(/\s*\((?:approx|approx\.)\)/gi, "").trim();
      const pLabel = cleanPage.includes("-") ? "pp." : "p.";
      const approxSuffix = isApprox ? " (approx.)" : "";
      s.addText(`Source: ${pLabel} ${cleanPage}${approxSuffix}`, {
        x: isFreeUser ? "32%" : "5%",
        y: "95%",
        w: "30%",
        h: "4%",
        fontSize: 9,
        color: mutedColor,
        fontFace: bodyFont,
        valign: "bottom",
      });
    }

    if (slide.layout === "title") {
      const hasBgImage = Boolean(
        c?.imageUrl &&
          (c?.imagePlacement === "background" ||
            (!c?.imagePlacement && theme.titleSlideStyle !== "split"))
      );
      const hasRightImage = Boolean(
        c?.imageUrl &&
          (c?.imagePlacement === "right" || theme.titleSlideStyle === "split")
      );

      if (hasBgImage) {
        // Dark base rectangle so text is legible even if image fails or is slow to load
        s.addShape(pptx.ShapeType.rect, {
          x: "0%",
          y: "0%",
          w: "100%",
          h: "100%",
          fill: { color: "0a0f1d" },
          line: { type: "none" },
        });
        await addSlideImage(
          s,
          c.imageUrl,
          { x: "0%", y: "0%", w: "100%", h: "100%" },
          c.photographer,
          { x: "50%", y: "94%", w: "46%", h: "4%" },
          "cbd5e1"
        );
        // Dark scrim overlay
        s.addShape(pptx.ShapeType.rect, {
          x: "0%",
          y: "0%",
          w: "100%",
          h: "100%",
          fill: { color: "000000", transparency: 40 },
          line: { type: "none" },
        });
        s.addText(slide.title, {
          x: "8%",
          y: "35%",
          w: "84%",
          h: "20%",
          fontSize: calculateFittedFontSize(
            slide.title,
            PPTX_WIDTH_POINTS * 0.84,
            PPTX_HEIGHT_POINTS * 0.2,
            44,
            26,
            headingFont
          ),
          bold: true,
          color: "ffffff",
          align: "left",
          fontFace: headingFont,
          shrinkText: true,
        });
        if (c?.subtitle) {
          s.addText(c.subtitle, {
            x: "8%",
            y: "55%",
            w: "84%",
            h: "15%",
            fontSize: calculateFittedFontSize(
              c.subtitle,
              PPTX_WIDTH_POINTS * 0.84,
              PPTX_HEIGHT_POINTS * 0.15,
              24,
              16,
              bodyFont
            ),
            color: "e2e8f0",
            align: "left",
            fontFace: bodyFont,
            shrinkText: true,
          });
        }
      } else if (hasRightImage) {
        // Split layout: surface card on left, image on right
        s.addShape(pptx.ShapeType.rect, {
          x: "0%",
          y: "0%",
          w: "50%",
          h: "100%",
          fill: { color: surfaceColor },
          line: { type: "none" },
        });
        s.addText(slide.title, {
          x: "6%",
          y: "30%",
          w: "40%",
          h: "25%",
          fontSize: calculateFittedFontSize(
            slide.title,
            PPTX_WIDTH_POINTS * 0.4,
            PPTX_HEIGHT_POINTS * 0.25,
            38,
            22,
            headingFont
          ),
          bold: true,
          color: headingColor,
          align: "left",
          fontFace: headingFont,
          shrinkText: true,
        });
        if (c?.subtitle) {
          s.addText(c.subtitle, {
            x: "6%",
            y: "55%",
            w: "40%",
            h: "18%",
            fontSize: calculateFittedFontSize(
              c.subtitle,
              PPTX_WIDTH_POINTS * 0.4,
              PPTX_HEIGHT_POINTS * 0.18,
              22,
              14,
              bodyFont
            ),
            color: mutedColor,
            align: "left",
            fontFace: bodyFont,
            shrinkText: true,
          });
        }
        await addSlideImage(
          s,
          c.imageUrl,
          { x: "53%", y: "10%", w: "42%", h: "80%" },
          c.photographer,
          { x: "53%", y: "91%", w: "42%", h: "4%" },
          mutedColor
        );
      } else {
        s.addText(slide.title, {
          x: "10%",
          y: "35%",
          w: "80%",
          h: "20%",
          fontSize: calculateFittedFontSize(
            slide.title,
            PPTX_WIDTH_POINTS * 0.8,
            PPTX_HEIGHT_POINTS * 0.2,
            44,
            26,
            headingFont
          ),
          bold: true,
          color: headingColor,
          align: "center",
          fontFace: headingFont,
          shrinkText: true,
        });
        if (c?.subtitle) {
          s.addText(c.subtitle, {
            x: "10%",
            y: "55%",
            w: "80%",
            h: "10%",
            fontSize: calculateFittedFontSize(
              c.subtitle,
              PPTX_WIDTH_POINTS * 0.8,
              PPTX_HEIGHT_POINTS * 0.1,
              24,
              16,
              bodyFont
            ),
            color: mutedColor,
            align: "center",
            fontFace: bodyFont,
            shrinkText: true,
          });
        }
      }
    } else if (slide.layout === "closing") {
      const headlineText = c?.headline || slide.title;
      const hasBgImage = Boolean(
        c?.imageUrl &&
          (c?.imagePlacement === "background" || !c?.imagePlacement)
      );
      const hasRightImage = Boolean(
        c?.imageUrl && c?.imagePlacement === "right"
      );

      if (hasBgImage) {
        s.addShape(pptx.ShapeType.rect, {
          x: "0%",
          y: "0%",
          w: "100%",
          h: "100%",
          fill: { color: "0a0f1d" },
          line: { type: "none" },
        });
        await addSlideImage(
          s,
          c.imageUrl,
          { x: "0%", y: "0%", w: "100%", h: "100%" },
          c.photographer,
          { x: "50%", y: "94%", w: "46%", h: "4%" },
          "cbd5e1"
        );
        s.addShape(pptx.ShapeType.rect, {
          x: "0%",
          y: "0%",
          w: "100%",
          h: "100%",
          fill: { color: "000000", transparency: 40 },
          line: { type: "none" },
        });
        s.addText(headlineText, {
          x: "10%",
          y: "35%",
          w: "80%",
          h: "20%",
          fontSize: calculateFittedFontSize(
            headlineText,
            PPTX_WIDTH_POINTS * 0.8,
            PPTX_HEIGHT_POINTS * 0.2,
            40,
            24,
            headingFont
          ),
          bold: true,
          align: "center",
          color: "ffffff",
          fontFace: headingFont,
          shrinkText: true,
        });
        if (c?.cta) {
          s.addText(c.cta, {
            x: "10%",
            y: "60%",
            w: "80%",
            h: "10%",
            fontSize: calculateFittedFontSize(
              c.cta,
              PPTX_WIDTH_POINTS * 0.8,
              PPTX_HEIGHT_POINTS * 0.1,
              24,
              16,
              bodyFont
            ),
            align: "center",
            color: accentColor,
            fontFace: bodyFont,
            shrinkText: true,
          });
        }
      } else if (hasRightImage) {
        s.addText(headlineText, {
          x: "6%",
          y: "30%",
          w: "44%",
          h: "25%",
          fontSize: calculateFittedFontSize(
            headlineText,
            PPTX_WIDTH_POINTS * 0.44,
            PPTX_HEIGHT_POINTS * 0.25,
            36,
            22,
            headingFont
          ),
          bold: true,
          align: "left",
          color: headingColor,
          fontFace: headingFont,
          shrinkText: true,
        });
        if (c?.cta) {
          s.addText(c.cta, {
            x: "6%",
            y: "58%",
            w: "44%",
            h: "10%",
            fontSize: calculateFittedFontSize(
              c.cta,
              PPTX_WIDTH_POINTS * 0.44,
              PPTX_HEIGHT_POINTS * 0.1,
              22,
              15,
              bodyFont
            ),
            align: "left",
            color: accentColor,
            fontFace: bodyFont,
            shrinkText: true,
          });
        }
        await addSlideImage(
          s,
          c.imageUrl,
          { x: "53%", y: "15%", w: "42%", h: "70%" },
          c.photographer,
          { x: "53%", y: "87%", w: "42%", h: "4%" },
          mutedColor
        );
      } else {
        s.addText(headlineText, {
          x: "10%",
          y: "35%",
          w: "80%",
          h: "20%",
          fontSize: calculateFittedFontSize(
            headlineText,
            PPTX_WIDTH_POINTS * 0.8,
            PPTX_HEIGHT_POINTS * 0.2,
            40,
            24,
            headingFont
          ),
          bold: true,
          align: "center",
          color: headingColor,
          fontFace: headingFont,
          shrinkText: true,
        });
        if (c?.cta) {
          s.addText(c.cta, {
            x: "10%",
            y: "60%",
            w: "80%",
            h: "10%",
            fontSize: calculateFittedFontSize(
              c.cta,
              PPTX_WIDTH_POINTS * 0.8,
              PPTX_HEIGHT_POINTS * 0.1,
              24,
              16,
              bodyFont
            ),
            align: "center",
            color: accentColor,
            fontFace: bodyFont,
            shrinkText: true,
          });
        }
      }
    } else {
      // standard header for non-title non-closing layouts
      s.addText(slide.title, {
        x: "5%",
        y: "5%",
        w: "90%",
        h: "15%",
        fontSize: calculateFittedFontSize(
          slide.title,
          PPTX_WIDTH_POINTS * 0.9,
          PPTX_HEIGHT_POINTS * 0.15,
          32,
          20,
          headingFont
        ),
        bold: true,
        color: headingColor,
        fontFace: headingFont,
        valign: "top",
        shrinkText: true,
      });

      if (slide.layout === "bullets") {
        if (c?.bullets) {
          if (c?.imageUrl) {
            // Cap at 4 bullets beside photo, increase font, give text ~55% width
            const displayBullets = (c.bullets as string[]).slice(0, 4);
            const bulletsText = displayBullets.join("\n");
            const fontSize = calculateFittedFontSize(
              bulletsText,
              PPTX_WIDTH_POINTS * 0.55,
              PPTX_HEIGHT_POINTS * 0.7,
              24,
              12,
              bodyFont
            );
            s.addText(
              displayBullets.map((b: string) => ({
                text: b,
                options: { bullet: true },
              })),
              {
                x: "5%",
                y: "22%",
                w: "55%",
                h: "70%",
                fontSize,
                color: bodyColor,
                fontFace: bodyFont,
                valign: "top",
                shrinkText: true,
              }
            );
            await addSlideImage(
              s,
              c.imageUrl,
              { x: "63%", y: "22%", w: "32%", h: "66%" },
              c.photographer,
              { x: "63%", y: "89%", w: "32%", h: "4%" },
              mutedColor
            );
          } else {
            const displayBullets = (c.bullets as string[]).slice(0, 6);
            const bulletsText = displayBullets.join("\n");
            const fontSize = calculateFittedFontSize(
              bulletsText,
              PPTX_WIDTH_POINTS * 0.9,
              PPTX_HEIGHT_POINTS * 0.7,
              24,
              12,
              bodyFont
            );
            s.addText(
              displayBullets.map((b: string) => ({
                text: b,
                options: { bullet: true },
              })),
              {
                x: "5%",
                y: "22%",
                w: "90%",
                h: "70%",
                fontSize,
                color: bodyColor,
                fontFace: bodyFont,
                valign: "top",
                shrinkText: true,
              }
            );
          }
        }
      } else if (slide.layout === "two_column") {
        const renderColumn = (
          colData: any,
          x: any,
          y: any,
          w: any,
          h: any,
          isWithImage: boolean
        ) => {
          const runs: any[] = [];
          const headingFontSize = isWithImage ? 20 : 24;
          const minHeadingFontSize = isWithImage ? 16 : 18;
          const fittedHeadingSize = colData?.heading
            ? calculateFittedFontSize(
                String(colData.heading),
                PPTX_WIDTH_POINTS * (isWithImage ? 0.27 : 0.42),
                PPTX_HEIGHT_POINTS * 0.15,
                headingFontSize,
                minHeadingFontSize,
                headingFont
              )
            : headingFontSize;

          const baseBulletFontSize = isWithImage ? 16 : 20;
          const minBulletFontSize = isWithImage ? 12 : 14;
          const bulletsText = Array.isArray(colData?.bullets) ? colData.bullets.join("\n") : "";
          const fittedBulletSize = bulletsText
            ? calculateFittedFontSize(
                bulletsText,
                PPTX_WIDTH_POINTS * (isWithImage ? 0.27 : 0.42),
                PPTX_HEIGHT_POINTS * 0.5,
                baseBulletFontSize,
                minBulletFontSize,
                bodyFont
              )
            : baseBulletFontSize;

          if (colData?.heading) {
            runs.push({
              text: String(colData.heading),
              options: {
                fontSize: fittedHeadingSize,
                bold: true,
                color: headingColor,
                fontFace: headingFont,
                breakLine: true,
                paraSpaceAfter: 10,
              },
            });
          }
          if (Array.isArray(colData?.bullets)) {
            colData.bullets.forEach((b: string, idx: number) => {
              runs.push({
                text: String(b),
                options: {
                  fontSize: fittedBulletSize,
                  color: bodyColor,
                  fontFace: bodyFont,
                  bullet: true,
                  breakLine: idx < colData.bullets.length - 1,
                  paraSpaceAfter: 6,
                },
              });
            });
          }

          if (runs.length > 0) {
            s.addText(runs, {
              x,
              y,
              w,
              h,
              shape: cardShape.shapeType,
              fill: { color: surfaceColor },
              line: { type: "none" },
              ...cardShape.radiusProps,
              valign: "top",
              margin: [16, 18, 16, 18],
              shrinkText: true,
            });
          } else {
            s.addShape(cardShape.shapeType, {
              x,
              y,
              w,
              h,
              fill: { color: surfaceColor },
              line: { type: "none" },
              ...cardShape.radiusProps,
            });
          }
        };

        if (c?.imageUrl) {
          // Left card
          renderColumn(c?.left, "5%", "22%", "27%", "66%", true);
          // Right card
          renderColumn(c?.right, "34%", "22%", "27%", "66%", true);
          await addSlideImage(
            s,
            c.imageUrl,
            { x: "64%", y: "22%", w: "31%", h: "66%" },
            c.photographer,
            { x: "64%", y: "89%", w: "31%", h: "4%" },
            mutedColor
          );
        } else {
          // Left card
          renderColumn(c?.left, "5%", "22%", "42%", "66%", false);
          // Right card
          renderColumn(c?.right, "53%", "22%", "42%", "66%", false);
        }
      } else if (slide.layout === "stats") {
        if (c?.stats) {
          const count = c.stats.length;
          const gap = 2;
          const totalW = 90;
          const cardW = (totalW - (count - 1) * gap) / count;
          c.stats.forEach((stat: any, i: number) => {
            const cardX = 5 + i * (cardW + gap);
            const runs: any[] = [];
            const fittedValSize = calculateFittedFontSize(
              String(stat.value || ""),
              PPTX_WIDTH_POINTS * (cardW / 100),
              PPTX_HEIGHT_POINTS * 0.25,
              48,
              26,
              headingFont
            );
            const fittedLblSize = calculateFittedFontSize(
              String(stat.label || ""),
              PPTX_WIDTH_POINTS * (cardW / 100),
              PPTX_HEIGHT_POINTS * 0.2,
              20,
              13,
              bodyFont
            );
            if (stat.value !== undefined && stat.value !== null && stat.value !== "") {
              runs.push({
                text: String(stat.value),
                options: {
                  fontSize: fittedValSize,
                  bold: true,
                  color: accentColor,
                  fontFace: headingFont,
                  breakLine: true,
                  paraSpaceAfter: 8,
                },
              });
            }
            if (stat.label !== undefined && stat.label !== null && stat.label !== "") {
              runs.push({
                text: String(stat.label),
                options: {
                  fontSize: fittedLblSize,
                  color: mutedColor,
                  fontFace: bodyFont,
                },
              });
            }

            if (runs.length > 0) {
              s.addText(runs, {
                x: `${cardX}%`,
                y: "22%",
                w: `${cardW}%`,
                h: "66%",
                shape: cardShape.shapeType,
                fill: { color: surfaceColor },
                line: { type: "none" },
                ...cardShape.radiusProps,
                align: "center",
                valign: "middle",
                shrinkText: true,
              });
            } else {
              s.addShape(cardShape.shapeType, {
                x: `${cardX}%`,
                y: "22%",
                w: `${cardW}%`,
                h: "66%",
                fill: { color: surfaceColor },
                line: { type: "none" },
                ...cardShape.radiusProps,
              });
            }
          });
        }
      } else if (slide.layout === "process") {
        if (c?.steps) {
          const count = c.steps.length;
          const width = 90 / count;
          c.steps.forEach((step: any, i: number) => {
            const fittedLabelSize = calculateFittedFontSize(
              String(step.label || ""),
              PPTX_WIDTH_POINTS * (width / 100),
              PPTX_HEIGHT_POINTS * 0.15,
              24,
              14,
              headingFont
            );
            const fittedDescSize = calculateFittedFontSize(
              String(step.desc || ""),
              PPTX_WIDTH_POINTS * (width / 100),
              PPTX_HEIGHT_POINTS * 0.3,
              18,
              12,
              bodyFont
            );
            s.addText(`${i + 1}`, {
              x: `${5 + i * width}%`,
              y: "30%",
              w: `${width}%`,
              h: "15%",
              fontSize: 36,
              bold: true,
              align: "center",
              color: accentColor,
              fontFace: headingFont,
              shrinkText: true,
            });
            s.addText(step.label, {
              x: `${5 + i * width}%`,
              y: "45%",
              w: `${width}%`,
              h: "15%",
              fontSize: fittedLabelSize,
              bold: true,
              align: "center",
              color: headingColor,
              fontFace: headingFont,
              shrinkText: true,
            });
            s.addText(step.desc, {
              x: `${5 + i * width}%`,
              y: "60%",
              w: `${width}%`,
              h: "30%",
              fontSize: fittedDescSize,
              align: "center",
              color: mutedColor,
              fontFace: bodyFont,
              shrinkText: true,
            });
          });
        }
      } else if (slide.layout === "comparison") {
        if (c?.columns) {
          const count = c.columns.length;
          const width = 90 / count;
          c.columns.forEach((col: any, i: number) => {
            const fittedHeadingSize = calculateFittedFontSize(
              String(col.heading || ""),
              PPTX_WIDTH_POINTS * (width / 100),
              PPTX_HEIGHT_POINTS * 0.1,
              24,
              16,
              headingFont
            );
            s.addText(col.heading, {
              x: `${5 + i * width}%`,
              y: "22%",
              w: `${width}%`,
              h: "10%",
              fontSize: fittedHeadingSize,
              bold: true,
              color: headingColor,
              fontFace: headingFont,
              shrinkText: true,
            });
            if (col.bullets) {
              const bulletsText = Array.isArray(col.bullets) ? col.bullets.join("\n") : "";
              const fittedBulletSize = calculateFittedFontSize(
                bulletsText,
                PPTX_WIDTH_POINTS * (width / 100),
                PPTX_HEIGHT_POINTS * 0.6,
                20,
                13,
                bodyFont
              );
              s.addText(
                col.bullets.map((b: string) => ({
                  text: b,
                  options: { bullet: true },
                })),
                {
                  x: `${5 + i * width}%`,
                  y: "32%",
                  w: `${width}%`,
                  h: "60%",
                  fontSize: fittedBulletSize,
                  color: bodyColor,
                  fontFace: bodyFont,
                  valign: "top",
                  shrinkText: true,
                }
              );
            }
          });
        }
      } else if (slide.layout === "quote") {
        const quoteText = c?.quote ? `"${c.quote}"` : `"${slide.title}"`;
        const hasBgImage = Boolean(
          c?.imageUrl && (c?.imagePlacement === "background" || !c?.imagePlacement)
        );
        const hasRightImage = Boolean(
          c?.imageUrl && c?.imagePlacement === "right"
        );

        if (hasBgImage) {
          s.addShape(pptx.ShapeType.rect, {
            x: "0%",
            y: "0%",
            w: "100%",
            h: "100%",
            fill: { color: "0a0f1d" },
            line: { type: "none" },
          });
          await addSlideImage(
            s,
            c.imageUrl,
            { x: "0%", y: "0%", w: "100%", h: "100%" },
            c.photographer,
            { x: "50%", y: "94%", w: "46%", h: "4%" },
            "cbd5e1"
          );
          s.addShape(pptx.ShapeType.rect, {
            x: "0%",
            y: "0%",
            w: "100%",
            h: "100%",
            fill: { color: "000000", transparency: 45 },
            line: { type: "none" },
          });
          const fittedQuoteSize = calculateFittedFontSize(
            quoteText,
            PPTX_WIDTH_POINTS * 0.8,
            PPTX_HEIGHT_POINTS * 0.4,
            32,
            18,
            headingFont
          );
          s.addText(quoteText, {
            x: "10%",
            y: "30%",
            w: "80%",
            h: "40%",
            fontSize: fittedQuoteSize,
            italic: true,
            align: "center",
            color: "ffffff",
            fontFace: headingFont,
            shrinkText: true,
          });
          if (c?.attribution) {
            const fittedAttribSize = calculateFittedFontSize(
              `— ${c.attribution}`,
              PPTX_WIDTH_POINTS * 0.8,
              PPTX_HEIGHT_POINTS * 0.1,
              20,
              14,
              bodyFont
            );
            s.addText(`— ${c.attribution}`, {
              x: "10%",
              y: "70%",
              w: "80%",
              h: "10%",
              fontSize: fittedAttribSize,
              bold: true,
              align: "center",
              color: "cbd5e1",
              fontFace: bodyFont,
              shrinkText: true,
            });
          }
        } else if (hasRightImage) {
          const fittedQuoteSize = calculateFittedFontSize(
            quoteText,
            PPTX_WIDTH_POINTS * 0.48,
            PPTX_HEIGHT_POINTS * 0.45,
            28,
            18,
            headingFont
          );
          s.addText(quoteText, {
            x: "6%",
            y: "25%",
            w: "48%",
            h: "45%",
            fontSize: fittedQuoteSize,
            italic: true,
            align: "left",
            color: bodyColor,
            fontFace: headingFont,
            shrinkText: true,
          });
          if (c?.attribution) {
            const fittedAttribSize = calculateFittedFontSize(
              `— ${c.attribution}`,
              PPTX_WIDTH_POINTS * 0.48,
              PPTX_HEIGHT_POINTS * 0.1,
              18,
              13,
              bodyFont
            );
            s.addText(`— ${c.attribution}`, {
              x: "6%",
              y: "70%",
              w: "48%",
              h: "10%",
              fontSize: fittedAttribSize,
              bold: true,
              align: "left",
              color: mutedColor,
              fontFace: bodyFont,
              shrinkText: true,
            });
          }
          await addSlideImage(
            s,
            c.imageUrl,
            { x: "58%", y: "20%", w: "37%", h: "65%" },
            c.photographer,
            { x: "58%", y: "87%", w: "37%", h: "4%" },
            mutedColor
          );
        } else {
          const fittedQuoteSize = calculateFittedFontSize(
            quoteText,
            PPTX_WIDTH_POINTS * 0.8,
            PPTX_HEIGHT_POINTS * 0.4,
            32,
            18,
            headingFont
          );
          s.addText(quoteText, {
            x: "10%",
            y: "30%",
            w: "80%",
            h: "40%",
            fontSize: fittedQuoteSize,
            italic: true,
            align: "center",
            color: bodyColor,
            fontFace: headingFont,
            shrinkText: true,
          });
          if (c?.attribution) {
            const fittedAttribSize = calculateFittedFontSize(
              `— ${c.attribution}`,
              PPTX_WIDTH_POINTS * 0.8,
              PPTX_HEIGHT_POINTS * 0.1,
              20,
              14,
              bodyFont
            );
            s.addText(`— ${c.attribution}`, {
              x: "10%",
              y: "70%",
              w: "80%",
              h: "10%",
              fontSize: fittedAttribSize,
              bold: true,
              align: "center",
              color: mutedColor,
              fontFace: bodyFont,
              shrinkText: true,
            });
          }
        }
      } else if (slide.layout === "image") {
        if (c?.variant === "full_bleed") {
          s.addShape(pptx.ShapeType.rect, {
            x: "0%",
            y: "0%",
            w: "100%",
            h: "100%",
            fill: { color: "0a0f1d" },
            line: { type: "none" },
          });
          await addSlideImage(
            s,
            c?.imageUrl,
            { x: "0%", y: "0%", w: "100%", h: "100%" },
            c?.photographer,
            { x: "50%", y: "94%", w: "46%", h: "4%" },
            "cbd5e1"
          );
          s.addShape(pptx.ShapeType.rect, {
            x: "0%",
            y: "45%",
            w: "100%",
            h: "55%",
            fill: { color: "000000", transparency: 25 },
            line: { type: "none" },
          });
          s.addText(slide.title, {
            x: "8%",
            y: "60%",
            w: "84%",
            h: "18%",
            fontSize: 36,
            bold: true,
            color: "ffffff",
            fontFace: headingFont,
            shrinkText: true,
          });
          if (c?.caption) {
            s.addText(c.caption, {
              x: "8%",
              y: "80%",
              w: "84%",
              h: "10%",
              fontSize: 18,
              color: "f1f5f9",
              fontFace: bodyFont,
              shrinkText: true,
            });
          }
        } else {
          // split
          await addSlideImage(
            s,
            c?.imageUrl,
            { x: "5%", y: "22%", w: "42%", h: "65%" },
            c?.photographer,
            { x: "5%", y: "89%", w: "42%", h: "4%" },
            mutedColor
          );
          let currentY = 22;
          if (c?.heading) {
            s.addText(c.heading, {
              x: "52%",
              y: `${currentY}%`,
              w: "43%",
              h: "15%",
              fontSize: 26,
              bold: true,
              color: headingColor,
              fontFace: headingFont,
              shrinkText: true,
            });
            currentY += 16;
          }
          if (c?.bullets && c.bullets.length > 0) {
            const bulletHeight = c?.caption ? (c?.heading ? 38 : 50) : (c?.heading ? 52 : 65);
            s.addText(
              c.bullets.map((b: string) => ({
                text: b,
                options: { bullet: true },
              })),
              {
                x: "52%",
                y: `${currentY}%`,
                w: "43%",
                h: `${bulletHeight}%`,
                fontSize: 18,
                color: bodyColor,
                fontFace: bodyFont,
                valign: "top",
                shrinkText: true,
              }
            );
            currentY += bulletHeight + 2;
          }
          if (c?.caption) {
            s.addText(c.caption, {
              x: "52%",
              y: `${currentY}%`,
              w: "43%",
              h: "12%",
              fontSize: 16,
              italic: true,
              color: bodyColor,
              fontFace: bodyFont,
              shrinkText: true,
            });
          }
        }
      } else if (slide.layout === "chart") {
        const hasValidCategories =
          Array.isArray(c?.categories) && c.categories.length >= 2;
        const hasValidSeries =
          Array.isArray(c?.series) &&
          c.series.length > 0 &&
          c.series.some(
            (ser: any) =>
              Array.isArray(ser?.values) &&
              ser.values.length > 0 &&
              ser.values.some((v: any) => typeof v === "number" && !isNaN(v))
          );

        if (!hasValidCategories || !hasValidSeries) {
          // Fallback to bullets-style slide instead of an empty slide
          const fallbackBullets: string[] = [];
          if (Array.isArray(c?.bullets) && c.bullets.length > 0) {
            fallbackBullets.push(
              ...c.bullets.filter((b: any) => typeof b === "string" && b.trim().length > 0)
            );
          }
          if (fallbackBullets.length === 0 && c?.caption) {
            fallbackBullets.push(c.caption);
          }
          if (fallbackBullets.length === 0 && slide.notes) {
            fallbackBullets.push(slide.notes);
          }
          if (fallbackBullets.length === 0 && Array.isArray(c?.points) && c.points.length > 0) {
            fallbackBullets.push(
              ...c.points.filter((p: any) => typeof p === "string" && p.trim().length > 0)
            );
          }
          if (fallbackBullets.length === 0 && slide.title) {
            fallbackBullets.push(slide.title);
          }

          s.addText(
            fallbackBullets.map((b: string) => ({
              text: b,
              options: { bullet: true },
            })),
            {
              x: "5%",
              y: "22%",
              w: "90%",
              h: "70%",
              fontSize: 24,
              color: bodyColor,
              fontFace: bodyFont,
              valign: "top",
              shrinkText: true,
            }
          );
        } else {
          // Determine PPTX Chart Type
          const rawType = String(c.chartType || "bar").toLowerCase();
          let chartType = pptx.ChartType.bar;
          if (rawType === "line") {
            chartType = pptx.ChartType.line;
          } else if (rawType === "pie") {
            chartType = pptx.ChartType.pie;
          }

          const categories: string[] = c.categories.map((cat: any) => String(cat ?? ""));

          // Build series data
          const chartData = (c.series as Array<{ name?: string; values?: number[] }>).map(
            (ser, sIdx) => ({
              name: ser.name || `Series ${sIdx + 1}`,
              labels: categories,
              values: (ser.values || []).map((v) => (typeof v === "number" && !isNaN(v) ? v : 0)),
            })
          );

          // Curated palette aligned with theme accent
          const chartColors = [
            accentColor,
            accent2Color,
            "10b981", // emerald
            "f59e0b", // amber
            "8b5cf6", // violet
            "ec4899", // pink
            "06b6d4", // cyan
            "64748b", // slate
          ];

          const hasCaption = Boolean(c?.caption);
          const chartH = hasCaption ? "64%" : "72%";

          // Native Chart Options
          const chartOpts: any = {
            x: "5%",
            y: "20%",
            w: "90%",
            h: chartH,
            chartColors,
            showLegend: chartType === pptx.ChartType.pie || chartData.length > 1,
            legendPos: "b",
            legendFontFace: bodyFont,
            legendColor: mutedColor,
            legendFontSize: 11,
          };

          if (chartType === pptx.ChartType.bar) {
            chartOpts.barDir = "col";
            chartOpts.barGrouping = "clustered";
            chartOpts.catAxisLabelColor = mutedColor;
            chartOpts.valAxisLabelColor = mutedColor;
            chartOpts.catAxisLabelFontFace = bodyFont;
            chartOpts.valAxisLabelFontFace = bodyFont;
            chartOpts.catAxisLabelFontSize = 10;
            chartOpts.valAxisLabelFontSize = 10;
            chartOpts.valGridLine = {
              style: "dash",
              color: surfaceColor === "ffffff" ? "e2e8f0" : surfaceColor,
            };
            chartOpts.catGridLine = { style: "none" };
          } else if (chartType === pptx.ChartType.line) {
            chartOpts.lineDataSymbol = "circle";
            chartOpts.lineDataSymbolSize = 6;
            chartOpts.catAxisLabelColor = mutedColor;
            chartOpts.valAxisLabelColor = mutedColor;
            chartOpts.catAxisLabelFontFace = bodyFont;
            chartOpts.valAxisLabelFontFace = bodyFont;
            chartOpts.catAxisLabelFontSize = 10;
            chartOpts.valAxisLabelFontSize = 10;
            chartOpts.valGridLine = {
              style: "dash",
              color: surfaceColor === "ffffff" ? "e2e8f0" : surfaceColor,
            };
            chartOpts.catGridLine = { style: "none" };
          } else if (chartType === pptx.ChartType.pie) {
            chartOpts.showPercent = true;
            chartOpts.dataLabelColor = "ffffff";
            chartOpts.dataLabelFontFace = bodyFont;
            chartOpts.dataLabelFontSize = 11;
          }

          s.addChart(chartType, chartData, chartOpts);

          if (hasCaption) {
            s.addText(c.caption, {
              x: "5%",
              y: "86%",
              w: "90%",
              h: "8%",
              fontSize: 15,
              italic: true,
              color: mutedColor,
              fontFace: bodyFont,
              align: "center",
              valign: "middle",
              shrinkText: true,
            });
          }
        }
      }
    }
  }

  const buf = await pptx.write({ outputType: "nodebuffer" });
  return buf as Buffer;
}
