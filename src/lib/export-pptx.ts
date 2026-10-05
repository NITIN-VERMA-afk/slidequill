import pptxgen from "pptxgenjs";
import type { SlideData } from "./slides-schema";
import { getTheme } from "./themes";

export async function exportToPPTX(deckTitle: string, slides: SlideData[], themeName: string = "modern") {
  const pptx = new pptxgen();
  const theme = getTheme(themeName);
  
  // Create a master slide for background
  pptx.defineSlideMaster({
    title: "MASTER_SLIDE",
    background: { color: theme.colors.bg.replace("#", "") },
  });

  slides.forEach((slide) => {
    const s = pptx.addSlide({ masterName: "MASTER_SLIDE" });
    const c = slide.content as any || {};

    if (!slide.content) {
      s.addText("Content is missing or failed to generate", {
        x: "10%",
        y: "40%",
        w: "80%",
        fontSize: 24,
        color: theme.colors.mutedText.replace("#", ""),
        align: "center",
      });
      return;
    }

    if (slide.layout === "title") {
      s.addText(slide.title, {
        x: "10%",
        y: "40%",
        w: "80%",
        fontSize: 44,
        bold: true,
        color: theme.colors.text.replace("#", ""),
        align: "center",
        fontFace: theme.headingFont.name
      });
      if (c.subtitle) {
        s.addText(c.subtitle, {
          x: "10%",
          y: "55%",
          w: "80%",
          fontSize: 24,
          color: theme.colors.mutedText.replace("#", ""),
          align: "center",
          fontFace: theme.bodyFont.name
        });
      }
    } else {
      // Standard header
      s.addText(slide.title, {
        x: "5%",
        y: "5%",
        w: "90%",
        h: "15%",
        fontSize: 32,
        bold: true,
        color: theme.colors.text.replace("#", ""),
        fontFace: theme.headingFont.name,
        valign: "top"
      });

      // Layout specific content
      if (slide.layout === "bullets") {
        if (c.bullets) {
          s.addText(
            c.bullets.map((b: string) => ({ text: b, options: { bullet: true } })),
            { x: "5%", y: "25%", w: "90%", h: "70%", fontSize: 20, color: theme.colors.text.replace("#", ""), fontFace: theme.bodyFont.name, valign: "top" }
          );
        }
      } else if (slide.layout === "two_column") {
        if (c.left?.heading) s.addText(c.left.heading, { x: "5%", y: "25%", w: "40%", h: "10%", fontSize: 24, bold: true, color: theme.colors.text.replace("#", ""), valign: "top" });
        if (c.left?.bullets) s.addText(c.left.bullets.map((b: string) => ({ text: b, options: { bullet: true } })), { x: "5%", y: "35%", w: "40%", h: "55%", fontSize: 18, color: theme.colors.text.replace("#", ""), valign: "top" });
        
        if (c.right?.heading) s.addText(c.right.heading, { x: "55%", y: "25%", w: "40%", h: "10%", fontSize: 24, bold: true, color: theme.colors.text.replace("#", ""), valign: "top" });
        if (c.right?.bullets) s.addText(c.right.bullets.map((b: string) => ({ text: b, options: { bullet: true } })), { x: "55%", y: "35%", w: "40%", h: "55%", fontSize: 18, color: theme.colors.text.replace("#", ""), valign: "top" });
      } else if (slide.layout === "stats") {
        if (c.stats) {
          const width = 90 / c.stats.length;
          c.stats.forEach((stat: any, i: number) => {
            s.addText(stat.value, { x: `${5 + i * width}%`, y: "30%", w: `${width}%`, h: "20%", fontSize: 48, bold: true, align: "center", color: theme.colors.accent.replace("#", ""), valign: "bottom" });
            s.addText(stat.label, { x: `${5 + i * width}%`, y: "50%", w: `${width}%`, h: "20%", fontSize: 18, align: "center", color: theme.colors.mutedText.replace("#", ""), valign: "top" });
          });
        }
      } else if (slide.layout === "process") {
        if (c.steps) {
          const width = 90 / c.steps.length;
          c.steps.forEach((step: any, i: number) => {
            s.addText(`${i + 1}`, { x: `${5 + i * width}%`, y: "30%", w: `${width}%`, h: "15%", fontSize: 32, bold: true, align: "center", color: theme.colors.accent.replace("#", ""), valign: "bottom" });
            s.addText(step.label, { x: `${5 + i * width}%`, y: "45%", w: `${width}%`, h: "10%", fontSize: 20, bold: true, align: "center", color: theme.colors.text.replace("#", ""), valign: "top" });
            s.addText(step.desc, { x: `${5 + i * width}%`, y: "55%", w: `${width}%`, h: "35%", fontSize: 14, align: "center", color: theme.colors.mutedText.replace("#", ""), valign: "top" });
          });
        }
      } else if (slide.layout === "comparison") {
         if (c.columns) {
           const width = 90 / c.columns.length;
           c.columns.forEach((col: any, i: number) => {
             s.addText(col.heading, { x: `${5 + i * width}%`, y: "20%", w: `${width}%`, h: "10%", fontSize: 24, bold: true, color: theme.colors.text.replace("#", ""), valign: "top" });
             if (col.bullets) {
                s.addText(col.bullets.map((b: string) => ({ text: b, options: { bullet: true } })), { x: `${5 + i * width}%`, y: "30%", w: `${width}%`, h: "60%", fontSize: 16, color: theme.colors.text.replace("#", ""), valign: "top" });
             }
           });
         }
      } else if (slide.layout === "quote") {
         if (c.quote) {
           s.addText(`"${c.quote}"`, { x: "10%", y: "25%", w: "80%", h: "40%", fontSize: 32, italic: true, align: "center", color: theme.colors.text.replace("#", ""), valign: "bottom" });
         }
         if (c.attribution) {
           s.addText(`— ${c.attribution}`, { x: "10%", y: "65%", w: "80%", h: "20%", fontSize: 20, bold: true, align: "center", color: theme.colors.mutedText.replace("#", ""), valign: "top" });
         }
      } else if (slide.layout === "closing") {
         s.addText(c.headline, { x: "10%", y: "30%", w: "80%", h: "30%", fontSize: 44, bold: true, align: "center", color: theme.colors.text.replace("#", ""), valign: "bottom" });
         if (c.cta) {
           s.addText(c.cta, { x: "10%", y: "60%", w: "80%", h: "20%", fontSize: 24, align: "center", color: theme.colors.accent.replace("#", ""), valign: "top" });
         }
      }
    }
    
    // Add notes
    if (slide.notes) {
      s.addNotes(slide.notes);
    }
  });

  await pptx.writeFile({ fileName: `${deckTitle || "Presentation"}.pptx` });
}
