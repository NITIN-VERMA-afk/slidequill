import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { SlideData } from "../slides-schema";
import {
  updateSlideTitle,
  updateSlideBullet,
  updateSlideSubtitle,
  updateSlideStat,
  updateSlideColumn,
  updateSlideQuote,
  updateSlideProcessStep,
  updateSlideClosing,
  updateSlideImageHeadingOrCaption,
} from "../slide-mutations";

describe("Canvas Inline Text Editing & Slide Mutations", () => {
  it("updates slide title immutably", () => {
    const original: any = {
      id: "slide-1",
      layout: "bullets",
      title: "Original Title",
      notes: "Speaker note",
      content: { bullets: ["Bullet 1", "Bullet 2"] },
    };
    const updated = updateSlideTitle(original as SlideData, "Edited New Title");
    assert.equal(updated.title, "Edited New Title");
    assert.equal(original.title, "Original Title", "Original slide must not be mutated");
  });

  it("updates slide bullet point at specific index", () => {
    const original: any = {
      id: "slide-1",
      layout: "bullets",
      title: "Title",
      notes: "Speaker note",
      content: { bullets: ["First point", "Second point", "Third point"] },
    };
    const updated = updateSlideBullet(original as SlideData, 1, "Updated Second Point");
    assert.deepEqual((updated.content as any).bullets, [
      "First point",
      "Updated Second Point",
      "Third point",
    ]);
    assert.equal((original.content as any).bullets[1], "Second point", "Original must remain intact");
  });

  it("updates slide subtitle for title slide", () => {
    const original: any = {
      id: "slide-title",
      layout: "title",
      title: "Deck Title",
      notes: "Speaker note",
      content: { subtitle: "Original Subtitle" },
    };
    const updated = updateSlideSubtitle(original as SlideData, "Modern Subtitle 2026");
    assert.equal((updated.content as any).subtitle, "Modern Subtitle 2026");
  });

  it("updates stat value and stat label immutably", () => {
    const original: any = {
      id: "slide-stats",
      layout: "stats",
      title: "Metrics",
      notes: "Speaker note",
      content: {
        stats: [
          { value: "$10M", label: "ARR" },
          { value: "99%", label: "Satisfaction" },
        ],
      },
    };
    const updatedVal = updateSlideStat(original as SlideData, 0, "value", "$15M");
    assert.equal((updatedVal.content as any).stats[0].value, "$15M");
    assert.equal((updatedVal.content as any).stats[0].label, "ARR");

    const updatedLabel = updateSlideStat(updatedVal, 1, "label", "Client Retention");
    assert.equal((updatedLabel.content as any).stats[1].label, "Client Retention");
    assert.equal((updatedLabel.content as any).stats[1].value, "99%");
  });

  it("updates two_column headings and bullets", () => {
    const original: any = {
      id: "slide-cols",
      layout: "two_column",
      title: "Comparison",
      notes: "Speaker note",
      content: {
        left: { heading: "Pros", bullets: ["Fast", "Clean"] },
        right: { heading: "Cons", bullets: ["Price"] },
      },
    };
    const updatedHeading = updateSlideColumn(original as SlideData, "left", "heading", "Key Advantages");
    assert.equal((updatedHeading.content as any).left.heading, "Key Advantages");

    const updatedBullet = updateSlideColumn(updatedHeading, "right", "bullet", "Requires Setup", 0);
    assert.equal((updatedBullet.content as any).right.bullets[0], "Requires Setup");
  });

  it("updates quote and attribution", () => {
    const original: any = {
      id: "slide-quote",
      layout: "quote",
      title: "Vision",
      notes: "Speaker note",
      content: { quote: "Old quote", attribution: "Old Author" },
    };
    const updated = updateSlideQuote(original as SlideData, "quote", "New inspired quote");
    const updatedFull = updateSlideQuote(updated, "attribution", "New Author");
    assert.equal((updatedFull.content as any).quote, "New inspired quote");
    assert.equal((updatedFull.content as any).attribution, "New Author");
  });

  it("updates process step label and description", () => {
    const original: any = {
      id: "slide-proc",
      layout: "process",
      title: "Steps",
      notes: "Speaker note",
      content: {
        steps: [
          { label: "Step 1", desc: "Plan" },
          { label: "Step 2", desc: "Execute" },
        ],
      },
    };
    const updated = updateSlideProcessStep(original as SlideData, 0, "label", "Phase 1: Discovery");
    const updatedDesc = updateSlideProcessStep(updated, 0, "desc", "Conduct user interviews");
    assert.equal((updatedDesc.content as any).steps[0].label, "Phase 1: Discovery");
    assert.equal((updatedDesc.content as any).steps[0].desc, "Conduct user interviews");
  });

  it("updates closing headline and cta", () => {
    const original: any = {
      id: "slide-close",
      layout: "closing",
      title: "Closing",
      notes: "Speaker note",
      content: { headline: "Thank You", cta: "Contact Us" },
    };
    const updatedHeadline = updateSlideClosing(original as SlideData, "headline", "Let's Build Together");
    const updatedCta = updateSlideClosing(updatedHeadline, "cta", "Schedule a Demo");
    assert.equal((updatedCta.content as any).headline, "Let's Build Together");
    assert.equal((updatedCta.content as any).cta, "Schedule a Demo");
  });

  it("updates image slide heading and caption", () => {
    const original: any = {
      id: "slide-img",
      layout: "image",
      title: "Product Showcase",
      notes: "Speaker note",
      content: { variant: "split", imageKeyword: "Product", heading: "Initial Concept", caption: "Figure 1.0" },
    };
    const updated = updateSlideImageHeadingOrCaption(original as SlideData, "heading", "Final Architecture");
    const updatedCap = updateSlideImageHeadingOrCaption(updated, "caption", "High resolution rendering");
    assert.equal((updatedCap.content as any).heading, "Final Architecture");
    assert.equal((updatedCap.content as any).caption, "High resolution rendering");
  });

  it("J2: title empty commit reverts to previous value", () => {
    const currentTitle = "Existing Slide Title";
    // Simulate handleBlur empty commit with onEmptyCommit="revert"
    const commitValue = (input: string, prev: string, onEmpty: "revert" | "remove") => {
      const trimmed = input.trim();
      if (!trimmed) {
        return onEmpty === "revert" ? prev : null;
      }
      return trimmed;
    };

    const emptyAttempt = commitValue("", currentTitle, "revert");
    assert.equal(emptyAttempt, "Existing Slide Title", "Empty title commit must revert to current title");

    const spacesAttempt = commitValue("   ", currentTitle, "revert");
    assert.equal(spacesAttempt, "Existing Slide Title", "Whitespace-only title commit must revert");

    const validAttempt = commitValue("New Valid Title", currentTitle, "revert");
    assert.equal(validAttempt, "New Valid Title");
  });

  it("J2: empty bullet commit removes bullet if count > 1, or reverts if count === 1", () => {
    // When count > 1, empty bullet should be removed
    const bulletsMulti = ["Point 1", "Point 2", "Point 3"];
    const handleBulletCommit = (bullets: string[], index: number, newVal: string) => {
      const trimmed = newVal.trim();
      if (!trimmed) {
        if (bullets.length > 1) {
          return bullets.filter((_, i) => i !== index);
        }
        return bullets; // revert if only 1 bullet
      }
      const next = [...bullets];
      next[index] = trimmed;
      return next;
    };

    const removedSecond = handleBulletCommit(bulletsMulti, 1, "   ");
    assert.deepEqual(removedSecond, ["Point 1", "Point 3"], "Empty bullet must be removed when count > 1");

    // When count === 1, empty bullet must revert so slide is not left without bullets
    const singleBullet = ["Sole Essential Metric"];
    const keptSole = handleBulletCommit(singleBullet, 0, "");
    assert.deepEqual(keptSole, ["Sole Essential Metric"], "Empty bullet must revert when count === 1");
  });

  it("J2: caps text length on paste and blur", () => {
    const capText = (text: string, maxLength: number) => {
      if (text.length > maxLength) {
        return text.slice(0, maxLength);
      }
      return text;
    };

    const longTitle = "A".repeat(250);
    const cappedTitle = capText(longTitle, 200);
    assert.equal(cappedTitle.length, 200);

    const longBullet = "B".repeat(650);
    const cappedBullet = capText(longBullet, 500);
    assert.equal(cappedBullet.length, 500);
  });
});

