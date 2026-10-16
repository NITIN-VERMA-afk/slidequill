import pptxgen from "pptxgenjs";
import type { SlideData } from "../slides-schema";
import { getTheme } from "../themes";
import { fetchSafeImage } from "../safe-image-fetcher";

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
  isFreeUser: boolean
): Promise<Buffer> {
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

  for (const slide of slides) {
    const s = pptx.addSlide({ masterName: "MASTER_SLIDE" });
    const c = slide.content as any;

    // Notes
    if (slide.notes) {
      s.addNotes(slide.notes);
    }

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

    // Footer: source page citation if available
    if (slide.sourcePage) {
      s.addText(`Source: p. ${slide.sourcePage}`, {
        x: isFreeUser ? "32%" : "5%",
        y: "95%",
        w: "25%",
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
          fontSize: 44,
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
            fontSize: 24,
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
          fontSize: 38,
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
            fontSize: 22,
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
          fontSize: 44,
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
            fontSize: 24,
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
          fontSize: 40,
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
            fontSize: 24,
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
          fontSize: 36,
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
            fontSize: 22,
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
          fontSize: 40,
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
            fontSize: 24,
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
        fontSize: 32,
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
                fontSize: 24,
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
            s.addText(
              c.bullets.map((b: string) => ({
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
          }
        }
      } else if (slide.layout === "two_column") {
        if (c?.imageUrl) {
          // Left card
          s.addShape(cardShape.shapeType, {
            x: "5%",
            y: "22%",
            w: "27%",
            h: "66%",
            fill: { color: surfaceColor },
            line: { type: "none" },
            ...cardShape.radiusProps,
          });
          if (c?.left?.heading) {
            s.addText(c.left.heading, {
              x: "6%",
              y: "24%",
              w: "25%",
              h: "10%",
              fontSize: 20,
              bold: true,
              color: headingColor,
              fontFace: headingFont,
              shrinkText: true,
            });
          }
          if (c?.left?.bullets) {
            s.addText(
              c.left.bullets.map((b: string) => ({
                text: b,
                options: { bullet: true },
              })),
              {
                x: "6%",
                y: "34%",
                w: "25%",
                h: "52%",
                fontSize: 16,
                color: bodyColor,
                fontFace: bodyFont,
                valign: "top",
                shrinkText: true,
              }
            );
          }
          // Right card
          s.addShape(cardShape.shapeType, {
            x: "34%",
            y: "22%",
            w: "27%",
            h: "66%",
            fill: { color: surfaceColor },
            line: { type: "none" },
            ...cardShape.radiusProps,
          });
          if (c?.right?.heading) {
            s.addText(c.right.heading, {
              x: "35%",
              y: "24%",
              w: "25%",
              h: "10%",
              fontSize: 20,
              bold: true,
              color: headingColor,
              fontFace: headingFont,
              shrinkText: true,
            });
          }
          if (c?.right?.bullets) {
            s.addText(
              c.right.bullets.map((b: string) => ({
                text: b,
                options: { bullet: true },
              })),
              {
                x: "35%",
                y: "34%",
                w: "25%",
                h: "52%",
                fontSize: 16,
                color: bodyColor,
                fontFace: bodyFont,
                valign: "top",
                shrinkText: true,
              }
            );
          }
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
          s.addShape(cardShape.shapeType, {
            x: "5%",
            y: "22%",
            w: "42%",
            h: "66%",
            fill: { color: surfaceColor },
            line: { type: "none" },
            ...cardShape.radiusProps,
          });
          if (c?.left?.heading) {
            s.addText(c.left.heading, {
              x: "6%",
              y: "24%",
              w: "40%",
              h: "10%",
              fontSize: 24,
              bold: true,
              color: headingColor,
              fontFace: headingFont,
              shrinkText: true,
            });
          }
          if (c?.left?.bullets) {
            s.addText(
              c.left.bullets.map((b: string) => ({
                text: b,
                options: { bullet: true },
              })),
              {
                x: "6%",
                y: "34%",
                w: "40%",
                h: "52%",
                fontSize: 20,
                color: bodyColor,
                fontFace: bodyFont,
                valign: "top",
                shrinkText: true,
              }
            );
          }
          // Right card
          s.addShape(cardShape.shapeType, {
            x: "53%",
            y: "22%",
            w: "42%",
            h: "66%",
            fill: { color: surfaceColor },
            line: { type: "none" },
            ...cardShape.radiusProps,
          });
          if (c?.right?.heading) {
            s.addText(c.right.heading, {
              x: "54%",
              y: "24%",
              w: "40%",
              h: "10%",
              fontSize: 24,
              bold: true,
              color: headingColor,
              fontFace: headingFont,
              shrinkText: true,
            });
          }
          if (c?.right?.bullets) {
            s.addText(
              c.right.bullets.map((b: string) => ({
                text: b,
                options: { bullet: true },
              })),
              {
                x: "54%",
                y: "34%",
                w: "40%",
                h: "52%",
                fontSize: 20,
                color: bodyColor,
                fontFace: bodyFont,
                valign: "top",
                shrinkText: true,
              }
            );
          }
        }
      } else if (slide.layout === "stats") {
        if (c?.stats) {
          const count = c.stats.length;
          const gap = 2;
          const totalW = 90;
          const cardW = (totalW - (count - 1) * gap) / count;
          c.stats.forEach((stat: any, i: number) => {
            const cardX = 5 + i * (cardW + gap);
            s.addShape(cardShape.shapeType, {
              x: `${cardX}%`,
              y: "22%",
              w: `${cardW}%`,
              h: "66%",
              fill: { color: surfaceColor },
              line: { type: "none" },
              ...cardShape.radiusProps,
            });
            s.addText(stat.value, {
              x: `${cardX}%`,
              y: "30%",
              w: `${cardW}%`,
              h: "20%",
              fontSize: 48,
              bold: true,
              align: "center",
              color: accentColor,
              fontFace: headingFont,
              shrinkText: true,
            });
            s.addText(stat.label, {
              x: `${cardX}%`,
              y: "50%",
              w: `${cardW}%`,
              h: "20%",
              fontSize: 20,
              align: "center",
              color: mutedColor,
              fontFace: bodyFont,
              shrinkText: true,
            });
          });
        }
      } else if (slide.layout === "process") {
        if (c?.steps) {
          const count = c.steps.length;
          const width = 90 / count;
          c.steps.forEach((step: any, i: number) => {
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
              fontSize: 24,
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
              fontSize: 18,
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
            s.addText(col.heading, {
              x: `${5 + i * width}%`,
              y: "22%",
              w: `${width}%`,
              h: "10%",
              fontSize: 24,
              bold: true,
              color: headingColor,
              fontFace: headingFont,
              shrinkText: true,
            });
            if (col.bullets) {
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
                  fontSize: 20,
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
          c?.imageUrl && c?.imagePlacement === "background"
        );
        const hasRightImage = Boolean(
          c?.imageUrl && c?.imagePlacement !== "background"
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
          s.addText(quoteText, {
            x: "10%",
            y: "30%",
            w: "80%",
            h: "40%",
            fontSize: 32,
            italic: true,
            align: "center",
            color: "ffffff",
            fontFace: headingFont,
            shrinkText: true,
          });
          if (c?.attribution) {
            s.addText(`— ${c.attribution}`, {
              x: "10%",
              y: "70%",
              w: "80%",
              h: "10%",
              fontSize: 20,
              bold: true,
              align: "center",
              color: "cbd5e1",
              fontFace: bodyFont,
              shrinkText: true,
            });
          }
        } else if (hasRightImage) {
          s.addText(quoteText, {
            x: "6%",
            y: "25%",
            w: "48%",
            h: "45%",
            fontSize: 28,
            italic: true,
            align: "left",
            color: bodyColor,
            fontFace: headingFont,
            shrinkText: true,
          });
          if (c?.attribution) {
            s.addText(`— ${c.attribution}`, {
              x: "6%",
              y: "70%",
              w: "48%",
              h: "10%",
              fontSize: 18,
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
          s.addText(quoteText, {
            x: "10%",
            y: "30%",
            w: "80%",
            h: "40%",
            fontSize: 32,
            italic: true,
            align: "center",
            color: bodyColor,
            fontFace: headingFont,
            shrinkText: true,
          });
          if (c?.attribution) {
            s.addText(`— ${c.attribution}`, {
              x: "10%",
              y: "70%",
              w: "80%",
              h: "10%",
              fontSize: 20,
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
      }
    }
  }

  const buf = await pptx.write({ outputType: "nodebuffer" });
  return buf as Buffer;
}
