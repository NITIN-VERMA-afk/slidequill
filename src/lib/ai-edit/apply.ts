import { randomUUID } from "crypto";
import type { ISlide } from "@/app/models/Deck";
import type { Op } from "./ops";
import { SlideSchema } from "@/lib/slides-schema";

export interface ApplyResult {
  slides: ISlide[];
  theme: string;
  appliedOps: Op[];
  failedOps: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(target: any, source: any) {
  if (typeof target !== "object" || target === null) return source;
  if (typeof source !== "object" || source === null) return source;
  
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (Array.isArray(source[key])) {
      output[key] = source[key]; // Arrays are replaced entirely
    } else if (typeof source[key] === "object" && source[key] !== null) {
      output[key] = deepMerge(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

export function applyOps(
  initialSlides: ISlide[],
  initialTheme: string,
  ops: Op[]
): ApplyResult {
  let slides = [...initialSlides];
  let theme = initialTheme;
  const appliedOps: Op[] = [];
  const failedOps: string[] = [];

  for (const op of ops) {
    try {
      if (op.op === "update_slide") {
        const idx = slides.findIndex((s) => s.id === op.slideId);
        if (idx === -1) throw new Error("Slide not found");

        const updated = { ...slides[idx] };
        if (op.fields.title !== undefined) updated.title = op.fields.title;
        if (op.fields.content !== undefined) {
          updated.content = deepMerge(updated.content, op.fields.content);
        }

        // Validate
        SlideSchema.parse(updated);
        slides[idx] = updated;
        appliedOps.push(op);
      } 
      else if (op.op === "change_layout") {
        const idx = slides.findIndex((s) => s.id === op.slideId);
        if (idx === -1) throw new Error("Slide not found");

        const updated = {
          ...slides[idx],
          layout: op.layout,
          content: op.content,
        };
        SlideSchema.parse(updated);
        slides[idx] = updated;
        appliedOps.push(op);
      } 
      else if (op.op === "add_slide") {
        const newSlide = {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(op.slide as any),
          id: randomUUID(),
          regenerations: 0,
        };
        SlideSchema.parse(newSlide);

        if (op.afterSlideId === "start") {
          slides.unshift(newSlide);
        } else if (op.afterSlideId) {
          const idx = slides.findIndex((s) => s.id === op.afterSlideId);
          if (idx === -1) {
            slides.push(newSlide); // fallback to end
          } else {
            slides.splice(idx + 1, 0, newSlide);
          }
        } else {
          slides.push(newSlide);
        }
        appliedOps.push(op);
      } 
      else if (op.op === "delete_slide") {
        const initialLen = slides.length;
        slides = slides.filter((s) => s.id !== op.slideId);
        if (slides.length !== initialLen) appliedOps.push(op);
      } 
      else if (op.op === "move_slide") {
        const idx = slides.findIndex((s) => s.id === op.slideId);
        if (idx !== -1) {
          const [s] = slides.splice(idx, 1);
          let target = op.toIndex;
          if (target < 0) target = 0;
          if (target > slides.length) target = slides.length;
          slides.splice(target, 0, s);
          appliedOps.push(op);
        }
      } 
      else if (op.op === "set_theme") {
        theme = op.theme;
        appliedOps.push(op);
      } 
      else if (op.op === "update_notes") {
        const idx = slides.findIndex((s) => s.id === op.slideId);
        if (idx !== -1) {
          slides[idx] = { ...slides[idx], notes: op.notes };
          appliedOps.push(op);
        }
      }
    } catch (e: unknown) {
      failedOps.push(`${op.op}: ${(e as Error).message}`);
    }
  }

  // Final sanity check: if all failed, or we end up with 0 slides and it's not what the user wants.
  if (appliedOps.length > 0 && slides.length === 0) {
    failedOps.push("Cannot delete all slides.");
    return { slides: initialSlides, theme: initialTheme, appliedOps: [], failedOps };
  }

  return { slides, theme, appliedOps, failedOps };
}
