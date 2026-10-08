import pptxgen from "pptxgenjs";
import type { SlideData } from "../slides-schema";
import { getTheme } from "../themes";

export async function buildPptx(
  deckTitle: string,
  slides: SlideData[],
  themeId: string,
  isFreeUser: boolean
): Promise<Buffer> {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE"; // 16:9

  const theme = getTheme(themeId);

  // Background and master slide
  pptx.defineSlideMaster({
    title: "MASTER_SLIDE",
    background: { color: theme.colors.bg.replace("#", "") },
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
        w: "30%",
        h: "4%",
        fontSize: 10,
        color: theme.colors.mutedText.replace("#", ""),
        fontFace: theme.bodyFont.fallback,
        valign: "bottom",
      });
    }

    // fallback fonts for PPTX
    const headingFont = theme.headingFont.fallback;
    const bodyFont = theme.bodyFont.fallback;

    const headingColor = theme.colors.text.replace("#", "");
    const bodyColor = theme.colors.text.replace("#", "");
    const mutedColor = theme.colors.mutedText.replace("#", "");
    const accentColor = theme.colors.accent.replace("#", "");

    if (slide.layout === "title") {
      s.addText(slide.title, {
        x: "10%", y: "35%", w: "80%", h: "20%",
        fontSize: 44, bold: true, color: headingColor,
        align: "center", fontFace: headingFont, shrinkText: true
      });
      if (c?.subtitle) {
        s.addText(c.subtitle, {
          x: "10%", y: "55%", w: "80%", h: "10%",
          fontSize: 24, color: mutedColor, align: "center", fontFace: bodyFont, shrinkText: true
        });
      }
    } else if (slide.layout === "closing") {
      s.addText(c?.headline || slide.title, {
        x: "10%", y: "35%", w: "80%", h: "20%",
        fontSize: 40, bold: true, align: "center", color: headingColor, fontFace: headingFont, shrinkText: true
      });
      if (c?.cta) {
        s.addText(c.cta, {
          x: "10%", y: "60%", w: "80%", h: "10%",
          fontSize: 24, align: "center", color: accentColor, fontFace: bodyFont, shrinkText: true
        });
      }
    } else {
      // standard header
      s.addText(slide.title, {
        x: "5%", y: "5%", w: "90%", h: "15%",
        fontSize: 32, bold: true, color: headingColor, fontFace: headingFont, valign: "top", shrinkText: true
      });

      if (slide.layout === "bullets") {
        if (c?.bullets) {
          s.addText(c.bullets.map((b: string) => ({ text: b, options: { bullet: true } })), {
            x: "5%", y: "22%", w: "90%", h: "70%",
            fontSize: 24, color: bodyColor, fontFace: bodyFont, valign: "top", shrinkText: true
          });
        }
      } else if (slide.layout === "two_column") {
        if (c?.left?.heading) {
          s.addText(c.left.heading, { x: "5%", y: "22%", w: "42%", h: "10%", fontSize: 24, bold: true, color: headingColor, fontFace: headingFont, shrinkText: true });
        }
        if (c?.left?.bullets) {
          s.addText(c.left.bullets.map((b: string) => ({ text: b, options: { bullet: true } })), { x: "5%", y: "32%", w: "42%", h: "60%", fontSize: 20, color: bodyColor, fontFace: bodyFont, valign: "top", shrinkText: true });
        }
        if (c?.right?.heading) {
          s.addText(c.right.heading, { x: "53%", y: "22%", w: "42%", h: "10%", fontSize: 24, bold: true, color: headingColor, fontFace: headingFont, shrinkText: true });
        }
        if (c?.right?.bullets) {
          s.addText(c.right.bullets.map((b: string) => ({ text: b, options: { bullet: true } })), { x: "53%", y: "32%", w: "42%", h: "60%", fontSize: 20, color: bodyColor, fontFace: bodyFont, valign: "top", shrinkText: true });
        }
      } else if (slide.layout === "stats") {
        if (c?.stats) {
          const count = c.stats.length;
          const width = 90 / count;
          c.stats.forEach((stat: any, i: number) => {
            s.addText(stat.value, { x: `${5 + i * width}%`, y: "30%", w: `${width}%`, h: "20%", fontSize: 48, bold: true, align: "center", color: accentColor, fontFace: headingFont, shrinkText: true });
            s.addText(stat.label, { x: `${5 + i * width}%`, y: "50%", w: `${width}%`, h: "20%", fontSize: 20, align: "center", color: mutedColor, fontFace: bodyFont, shrinkText: true });
          });
        }
      } else if (slide.layout === "process") {
        if (c?.steps) {
          const count = c.steps.length;
          const width = 90 / count;
          c.steps.forEach((step: any, i: number) => {
            s.addText(`${i + 1}`, { x: `${5 + i * width}%`, y: "30%", w: `${width}%`, h: "15%", fontSize: 36, bold: true, align: "center", color: accentColor, fontFace: headingFont, shrinkText: true });
            s.addText(step.label, { x: `${5 + i * width}%`, y: "45%", w: `${width}%`, h: "15%", fontSize: 24, bold: true, align: "center", color: headingColor, fontFace: headingFont, shrinkText: true });
            s.addText(step.desc, { x: `${5 + i * width}%`, y: "60%", w: `${width}%`, h: "30%", fontSize: 18, align: "center", color: mutedColor, fontFace: bodyFont, shrinkText: true });
          });
        }
      } else if (slide.layout === "comparison") {
        if (c?.columns) {
          const count = c.columns.length;
          const width = 90 / count;
          c.columns.forEach((col: any, i: number) => {
            s.addText(col.heading, { x: `${5 + i * width}%`, y: "22%", w: `${width}%`, h: "10%", fontSize: 24, bold: true, color: headingColor, fontFace: headingFont, shrinkText: true });
            if (col.bullets) {
              s.addText(col.bullets.map((b: string) => ({ text: b, options: { bullet: true } })), { x: `${5 + i * width}%`, y: "32%", w: `${width}%`, h: "60%", fontSize: 20, color: bodyColor, fontFace: bodyFont, valign: "top", shrinkText: true });
            }
          });
        }
      } else if (slide.layout === "quote") {
        if (c?.quote) {
          s.addText(`"${c.quote}"`, { x: "10%", y: "30%", w: "80%", h: "40%", fontSize: 32, italic: true, align: "center", color: bodyColor, fontFace: headingFont, shrinkText: true });
        }
        if (c?.attribution) {
          s.addText(`— ${c.attribution}`, { x: "10%", y: "70%", w: "80%", h: "10%", fontSize: 20, bold: true, align: "center", color: mutedColor, fontFace: bodyFont, shrinkText: true });
        }
      }
    }
  }

  const buf = await pptx.write({ outputType: "nodebuffer" });
  return buf as Buffer;
}
