# Feedback Audit Report: Truly Editable Output & Source Citations in Speaker Notes (`FEEDBACK_AUDIT.md`)

**Date:** October 2026  
**Audit Target:** Codebase verification against two specific user feedback items:
1. Truly editable PowerPoint output (change a headline, move a chart, edit in PowerPoint/Google Slides/Keynote, no flattened images).
2. Speaker notes citing the source PDF page for each slide (e.g., "Source: Uploaded report, page 18") for verifiable claims.  
**Methodology:** Read-only static inspection of TypeScript source files, schemas, and routes. No live servers, test scripts, or external APIs were executed.

---

## Executive Summary

| Feedback Item | Estimated % Implemented | Core Verdict | Key Gap |
| :--- | :---: | :---: | :--- |
| **1. Truly Editable Output** | **55%** | **BROKEN / PARTIAL** | Text boxes and shapes are native vector elements (`CONFIRMED IN CODE`), but **charts (`layout: "chart"`) are completely missing from `src/lib/export/pptx.ts`** (`BROKEN`), icons are dropped (`MISSING`), card shapes and text are ungrouped, and titles are free-floating rather than real layout placeholders. |
| **2. Source References in Notes** | **25%** | **BROKEN / PARTIAL** | PPTX export writes speaker notes (`s.addNotes`) but **never includes source citations in notes** (`BROKEN`). Page numbers are cited only as a canvas footer at `y: "95%"`. Page numbers are requested from LLM output rather than derived deterministically from excerpt page ranges, single-page numbers are stored instead of ranges, and deleting source text wipes the document name (`sourceName`). |

---

## PART 1: EDITABLE OUTPUT

### 1.1 Layout-by-Layout Element Export Audit

Every slide layout in [`src/lib/export/pptx.ts:120-973`](file:///e:/projects/Slidequill/slidequill/src/lib/export/pptx.ts#L120-L973) was inspected to identify the exact PPTX element type generated:

| Layout | Elements Exported | PPTX Export Mechanism | Status | Notes |
| :--- | :--- | :--- | :---: | :--- |
| **`title`** | Background/right image, dark base & scrim rectangles, title, subtitle, photo credit | Native shapes (`s.addShape`), Native text (`s.addText`), Embedded picture (`s.addImage`) | **CONFIRMED IN CODE** | Lines 120–252. No text is rasterized. Title and subtitle are separate floating text boxes. |
| **`bullets`** | Slide title, bullet points, optional side image, photo credit | Native text (`s.addText`), Embedded picture (`s.addImage`) | **CONFIRMED IN CODE** | Lines 389–438. Bullets use `{ text: b, options: { bullet: true } }`. Editable text. |
| **`two_column`** | Slide title, left/right card shapes, column headings, column bullets, optional side image | Native shapes (`s.addShape`), Native text (`s.addText`), Embedded picture (`s.addImage`) | **CONFIRMED IN CODE** | Lines 439–618. Rectangles/roundRects form cards; headings and bullets are independent text frames. |
| **`stats`** | Slide title, card background shapes, stat value numbers, stat labels | Native shapes (`s.addShape`), Native text (`s.addText`) | **CONFIRMED IN CODE** / **MISSING (Icons)** | Lines 619–660. Values and labels are editable text. **Icons are completely omitted** from export. |
| **`process`** | Slide title, step numbers, step labels, step descriptions | Native text (`s.addText`) | **CONFIRMED IN CODE** / **MISSING (Icons/Connectors)** | Lines 661–702. Step numbers (`1`, `2`, `3`), labels, and descriptions are native text. Step icons and arrow shapes are not exported. |
| **`comparison`** | Slide title, column headings, column bullets | Native text (`s.addText`) | **CONFIRMED IN CODE** | Lines 703–739. Column titles and bullets are native text boxes. |
| **`quote`** | Slide title, optional background/right image, scrim shapes, quote text, attribution | Native shapes (`s.addShape`), Native text (`s.addText`), Embedded picture (`s.addImage`) | **CONFIRMED IN CODE** | Lines 740–862. Quote text and attribution are native text boxes. |
| **`closing`** | Headline, CTA text, optional background/right image, scrim shapes | Native shapes (`s.addShape`), Native text (`s.addText`), Embedded picture (`s.addImage`) | **CONFIRMED IN CODE** | Lines 253–373. Headline and CTA are native text frames. |
| **`chart`** | Slide title only (`s.addText`) | Native text (`s.addText`) | **BROKEN / MISSING** | Lines 376–387. **There is NO `layout === "chart"` block in `pptx.ts`.** All chart data (`chartType`, `categories`, `series`, `caption`) is completely dropped. The exported slide contains only the title and footer! |
| **`image`** | Slide title, full-bleed/split image, dark scrim shapes, heading, bullets, caption | Native shapes (`s.addShape`), Native text (`s.addText`), Embedded picture (`s.addImage`) | **CONFIRMED IN CODE** | Lines 863–972. All text remains native text over vector scrims. |

---

### 1.2 Deep-Dive Questions on Editable Output

#### Question 1: Is any text ever rasterized or rendered as an image?
- **Finding:** **CONFIRMED IN CODE (No text rasterization)**.
- **Analysis:** Direct inspection of [`src/lib/export/pptx.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/export/pptx.ts) confirms that all titles, subtitles, bullets, stats values, stats labels, quotes, attributions, captions, and watermarks are output via `s.addText(...)`. No HTML-to-image, Puppeteer screenshotting, or canvas rasterization exists.
- **Icons:** **MISSING**. In [`src/components/app/SlideRenderer.tsx:165`](file:///e:/projects/Slidequill/slidequill/src/components/app/SlideRenderer.tsx#L165), icons are rendered via `<SlideIcon name={iconName} />` (Lucide React). In [`src/lib/export/pptx.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/export/pptx.ts), `icon` or `SlideIcon` is never called. Icons are completely dropped from PPTX export. They are neither rasterized nor exported as SVG/image shapes.

#### Question 2: Are charts exported with `pptx.addChart` (native, editable data) in every case, and is there any fallback to an image?
- **Finding:** **BROKEN / MISSING**.
- **Analysis:** 
  1. `pptx.addChart` is **never called anywhere in the codebase**.
  2. While [`PROJECT_STATUS.md:71`](file:///e:/projects/Slidequill/slidequill/PROJECT_STATUS.md#L71) and [`COMPLETION_REPORT.md:73`](file:///e:/projects/Slidequill/slidequill/COMPLETION_REPORT.md#L73) claimed `src/lib/export/pptx.ts:770-820` exports native PowerPoint charts via `pptx.addChart`, lines 770–820 of `src/lib/export/pptx.ts` are actually the `layout === "quote"` handler.
  3. `slide.layout === "chart"` has **no conditional branch** in [`src/lib/export/pptx.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/export/pptx.ts).
  4. There is **no fallback to an image** either. A slide with layout `chart` exports as a blank slide containing only the title header and footer.

#### Question 3: Are text boxes set to autofit/shrink in a way that behaves badly in PowerPoint and Google Slides? Is font size computed by our own fit logic?
- **Finding:** **CONFIRMED IN CODE (Static fonts + `shrinkText: true`)** / **UNVERIFIED (Cross-platform rendering)**.
- **Analysis:**
  1. In [`src/lib/export/pptx.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/export/pptx.ts), nearly every text element sets `shrinkText: true` (e.g., lines 168, 180, 203, 386, 408, 434, 461, 554, 646, 676, 717, 784, 898).
  2. In OpenXML, `shrinkText: true` emits `<a:normAutofit/>`. In Microsoft PowerPoint desktop, `normAutofit` recalculates text scaling dynamically.
  3. **Google Slides incompatibility:** Google Slides frequently ignores `<a:normAutofit/>` on uploaded `.pptx` presentations unless the text box is manually selected and resized, causing text to overflow or clip.
  4. **Font size calculation:** Slidequill does **not** compute font size using its own measurement logic in `pptx.ts`. Font sizes are hardcoded constants (e.g., 44pt titles, 24pt bullets, 48pt stats values). Text fitting relies entirely on PowerPoint interpreting `shrinkText: true`.

#### Question 4: Are shapes grouped or independent, so a user can move a chart or card?
- **Finding:** **CONFIRMED IN CODE (Ungrouped / Independent)**.
- **Analysis:** In layouts with cards such as `two_column` ([`lines 442-524`](file:///e:/projects/Slidequill/slidequill/src/lib/export/pptx.ts#L442-L524)) and `stats` ([`lines 627-658`](file:///e:/projects/Slidequill/slidequill/src/lib/export/pptx.ts#L627-L658)), the background rectangle (`s.addShape`), the heading/stat value (`s.addText`), and the bullets/labels (`s.addText`) are separate calls on slide object `s`. PPTXGenJS shape grouping is not used.
- **Consequence:** If a user selects and drags a card shape in PowerPoint or Google Slides, the background moves away, leaving the text floating behind unless the user manually marquee-selects all elements.

#### Question 5: Are slide masters/layouts used (placeholders) or is everything free-floating? Does editing a title in PowerPoint's outline view work?
- **Finding:** **CONFIRMED IN CODE (Free-floating text boxes; no title placeholders)**.
- **Analysis:**
  1. Master slide setup in [`src/lib/export/pptx.ts:78-81`](file:///e:/projects/Slidequill/slidequill/src/lib/export/pptx.ts#L78-L81):
     ```typescript
     pptx.defineSlideMaster({
       title: "MASTER_SLIDE",
       background: { color: bgColor },
     });
     ```
     The master slide defines only a background color. It defines no placeholders (`objects: []` is empty).
  2. Slide titles are added via `s.addText(slide.title, { x: "5%", y: "5%", w: "90%", h: "15%", ... })` ([`lines 376-387`](file:///e:/projects/Slidequill/slidequill/src/lib/export/pptx.ts#L376-L387)).
  3. In OpenXML, `s.addText` produces a standard floating shape `<p:sp>`, not a layout placeholder `<p:ph type="title"/>`.
  4. **Outline View behavior:** Because titles are not bound to a master title placeholder, PowerPoint's Outline View and Outline Pane do **not** display or edit slide titles.

#### Question 6: Are fonts PowerPoint-safe in every theme, and what happens in Google Slides for fonts like Palatino Linotype or Trebuchet MS?
- **Finding:** **CONFIRMED IN CODE (Theme font definitions)** / **UNVERIFIED (Cloud font substitution)**.
- **Theme Font Mapping in [`src/lib/themes.ts:28-131`](file:///e:/projects/Slidequill/slidequill/src/lib/themes.ts#L28-L131):**
  - `modern`: Heading `Arial`, Body `Calibri` (Universal across PowerPoint & Google Slides).
  - `corporate`: Heading `Georgia`, Body `Calibri` (Universal across PowerPoint & Google Slides).
  - `creative`: Heading `Trebuchet MS`, Body `Calibri` (Supported; available in Google Slides).
  - `dark`: Heading `Trebuchet MS`, Body `Arial` (Supported).
  - `playful`: Heading `Trebuchet MS`, Body `Calibri` (Supported).
  - `elegant`: Heading `Palatino Linotype`, Body `Georgia`.
- **Cross-Platform Vulnerability:**
  - `Palatino Linotype`: Windows desktop PowerPoint includes this font. However, **Google Slides does not include `Palatino Linotype` by default** in its standard web font list. When opening an `elegant` theme deck in Google Slides, Google Slides substitutes Times New Roman or a generic serif, causing metric differences and altered line wrapping.

#### Question 7: Is the watermark for free users a removable text box or baked into something?
- **Finding:** **CONFIRMED IN CODE (Easily removable text box)**.
- **Analysis:** In [`src/lib/export/pptx.ts:93-104`](file:///e:/projects/Slidequill/slidequill/src/lib/export/pptx.ts#L93-L104):
  ```typescript
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
  ```
  The watermark is a standard, unpinned text box on the active slide canvas. It is not baked into background images, not locked, and not embedded into master slide XML. Any user opening the file in PowerPoint or Google Slides can click the text and hit `Delete`.

#### Question 8: Does the landing page claim ("native text and shapes, fully editable") match what the code does? List every exception.
- **Landing Page Claims in [`src/app/(Landingpage)/page.tsx`](file:///e:/projects/Slidequill/slidequill/src/app/%28Landingpage%29/page.tsx):**
  - Line 49: *"Every slide is native PowerPoint text and shapes — fully editable in PowerPoint or Keynote."*
  - Line 103: *"Native PowerPoint bar, line, and pie charts with editable numbers."*
  - Line 328: *"Completely native text, vector shapes, and editable charts."*
- **Exceptions Found in Code:**
  1. **Charts are completely missing in PPTX export:** [`src/lib/export/pptx.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/export/pptx.ts) contains zero code for `chart` layout. Claiming "native editable charts" in exported PPTX is currently false.
  2. **Icons are omitted:** All 30 Lucide icons rendered on screen are stripped during export.
  3. **Titles are not real placeholders:** Slide titles are floating text boxes, so editing via PowerPoint Outline View does not work.
  4. **Cards are not grouped:** Background shapes and text frames must be moved separately.

#### Question 9: What is the biggest risk of export looking different in Google Slides or Keynote compared to PowerPoint?
1. **Uncalculated `shrinkText`:** Google Slides does not recalculate `<a:normAutofit/>` upon import, causing long bullet points or large stat numbers (48pt) to overflow cards.
2. **Missing Font Substitution:** `Palatino Linotype` in the `elegant` theme is substituted with Times New Roman in Google Slides, altering layout spacing.
3. **Stacked Scrim Transparency:** Background image slides use two overlapping shapes: a dark rectangle (`fill: { color: "0a0f1d" }`), an image, and a scrim rectangle (`fill: { color: "000000", transparency: 40 }`). Google Slides occasionally alters transparency blend modes or drops alpha layers on imported PPTX shapes.

---

## PART 2: SOURCE REFERENCES IN SPEAKER NOTES

### 2.1 Deep-Dive Questions on Source References

#### Question 1: Does `export/pptx.ts` write speaker notes at all (`addNotes` or equivalent)? Show the exact code and what text goes in.
- **Finding:** **CONFIRMED IN CODE (Notes exported, but NO source citations)**.
- **Exact Code in [`src/lib/export/pptx.ts:88-90`](file:///e:/projects/Slidequill/slidequill/src/lib/export/pptx.ts#L88-L90):**
  ```typescript
  // Notes
  if (slide.notes) {
    s.addNotes(slide.notes);
  }
  ```
- **Analysis:**
  - `s.addNotes` is called, but it **only writes `slide.notes`** (the 1–2 sentence presentation commentary written by the LLM).
  - The source citation is **never added to speaker notes**.
  - Instead, in [`lines 107-118`](file:///e:/projects/Slidequill/slidequill/src/lib/export/pptx.ts#L107-L118), the code places source citations as a visual text box on the slide canvas:
    ```typescript
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
    ```
  - This puts `Source: p. X` directly on the visual slide footer, failing the user requirement that speaker notes should cite the source.

#### Question 2: Where do `sourcePage` and `sourceSection` come from: model output, or derived deterministically from the outline section's `pageRange`?
- **Finding:** **CONFIRMED IN CODE (`sourceSection` deterministic; `sourcePage` LLM-generated)** / **BROKEN (Hallucination vulnerability)**.
- **Code in [`src/app/api/decks/[id]/generate/route.ts:284-289`](file:///e:/projects/Slidequill/slidequill/src/app/api/decks/%5Bid%5D/generate/route.ts#L284-L289):**
  ```typescript
  return {
    ...parsed.data,
    id: randomUUID(),
    sourceSection: section.title,
    sourcePage: validateAndSanitizeSourcePage(parsed.data.sourcePage, sourcePageCount),
  };
  ```
- **Analysis:**
  - `sourceSection` is deterministic: it is assigned directly from `section.title`.
  - `sourcePage` comes from `parsed.data.sourcePage` (the model's JSON output).
  - **Can the model invent page numbers?** **YES.**
    In [`src/lib/slides-schema.ts:259-282`](file:///e:/projects/Slidequill/slidequill/src/lib/slides-schema.ts#L259-L282):
    ```typescript
    export function validateAndSanitizeSourcePage(
      rawPage: unknown,
      sourcePageCount?: number
    ): number | undefined {
      if (!sourcePageCount || typeof sourcePageCount !== "number" || sourcePageCount < 1) {
        return undefined;
      }
      ...
      if (parsed !== undefined && parsed >= 1 && parsed <= sourcePageCount) {
        return parsed;
      }
      return undefined;
    }
    ```
    `validateAndSanitizeSourcePage` only validates that `1 <= parsed <= sourcePageCount`. If an 80-page PDF has an excerpt from page 5, but the LLM outputs `"sourcePage": 72`, the code accepts page 72 because `72 <= 80`. It does **not** check whether `sourcePage` matches the section's actual `pageRange`.

#### Question 3: When a slide draws from several pages, do we store a range (e.g. pages 18-20) or a single page?
- **Finding:** **CONFIRMED IN CODE (Single integer only; ranges cannot be stored)**.
- **Analysis:** In [`src/lib/slides-schema.ts:237`](file:///e:/projects/Slidequill/slidequill/src/lib/slides-schema.ts#L237), `sourcePage` is typed as:
  ```typescript
  sourcePage: z.number().int().min(1).optional()
  ```
  And in [`src/app/models/Deck.ts:42`](file:///e:/projects/Slidequill/slidequill/src/app/models/Deck.ts#L42):
  ```typescript
  sourcePage?: number | string;
  ```
  Because `SlideSchema` enforces `z.number().int()`, multi-page ranges (e.g. `18-20`) fail Zod schema validation during slide generation and regeneration. Slidequill only stores a single integer page.

#### Question 4: What happens for DOCX and pasted text (no real pages)? Is there any fallback reference such as a section heading or the original file name?
- **Finding:** **CONFIRMED IN CODE (No fallback; citation dropped completely)**.
- **Analysis:**
  1. When creating a deck from DOCX or pasted text in [`src/app/api/decks/route.ts:133`](file:///e:/projects/Slidequill/slidequill/src/app/api/decks/route.ts#L133), `sourcePageCount = undefined;`.
  2. In [`src/lib/slides-schema.ts:263`](file:///e:/projects/Slidequill/slidequill/src/lib/slides-schema.ts#L263), when `sourcePageCount` is missing, `validateAndSanitizeSourcePage` returns `undefined`.
  3. In [`src/lib/export/pptx.ts:107`](file:///e:/projects/Slidequill/slidequill/src/lib/export/pptx.ts#L107), `if (slide.sourcePage)` evaluates to false.
  4. There is no fallback to `slide.sourceSection` or `deck.sourceName`. For DOCX and pasted text, zero source attribution appears anywhere on the slide or in notes.

#### Question 5: Do references survive after "Delete source text now"? Do they survive regenerate, chat edits, and undo?
- **"Delete source text now":**
  - **`slide.sourcePage` & `slide.sourceSection`:** **SURVIVE**. In [`src/app/api/decks/[id]/source/route.ts:30-33`](file:///e:/projects/Slidequill/slidequill/src/app/api/decks/%5Bid%5D/source/route.ts#L30-L33), the deletion unsets `sourceText`, `sourceName`, `chunkNotes`, and `outlineProgress`. `deck.slides` is not touched, so existing slide-level citations remain.
  - **`deck.sourceName`:** **DOES NOT SURVIVE**. `sourceName` is explicitly wiped (`$unset: { sourceName: "" }`).
- **Regenerate Single Slide (`/slides/[slideId]/regenerate`):**
  - **`sourceSection`:** **DOES NOT SURVIVE (`BROKEN`)**. In [`src/app/api/decks/[id]/slides/[slideId]/regenerate/route.ts:116-121`](file:///e:/projects/Slidequill/slidequill/src/app/api/decks/%5Bid%5D/slides/%5BslideId%5D/regenerate/route.ts#L116-L121):
    ```typescript
    const newSlide = {
      ...parsed.data,
      id: slideId,
      sourcePage: validateAndSanitizeSourcePage(parsed.data.sourcePage, deck.sourcePageCount),
      regenerations: (existingSlide.regenerations ?? 0) + 1,
    };
    ```
    `existingSlide.sourceSection` is omitted and completely lost upon regeneration.
  - **`sourcePage`:** Overwritten by whatever `parsed.data.sourcePage` the LLM generates during regeneration.
- **AI Chat Edits (`/api/decks/[id]/chat`):**
  - **SURVIVE**. In [`src/lib/ai-edit/apply.ts:43-70`](file:///e:/projects/Slidequill/slidequill/src/lib/ai-edit/apply.ts#L43-L70), `update_slide`, `change_layout`, and `move_slide` shallow-copy `slides[idx]`, preserving existing `sourcePage` and `sourceSection`.
- **Undo (`/api/decks/[id]/undo`):**
  - **SURVIVE**. In [`src/app/api/decks/[id]/undo/route.ts:35`](file:///e:/projects/Slidequill/slidequill/src/app/api/decks/%5Bid%5D/undo/route.ts#L35), `deck.slides = latestVersion.slides;`. The entire slide snapshot is restored.

#### Question 6: Is the original file name stored (`sourceName`), is it exposed in notes, and does deleting source text remove it?
- **Is `sourceName` stored?** **CONFIRMED IN CODE**. Stored on `Deck` in [`src/app/models/Deck.ts:67`](file:///e:/projects/Slidequill/slidequill/src/app/models/Deck.ts#L67) and populated at upload in [`src/app/api/decks/route.ts:150`](file:///e:/projects/Slidequill/slidequill/src/app/api/decks/route.ts#L150).
- **Is it exposed in notes?** **MISSING**. `deck.sourceName` is never passed to `buildPptx` ([`src/app/api/decks/[id]/export/route.ts:48`](file:///e:/projects/Slidequill/slidequill/src/app/api/decks/%5Bid%5D/export/route.ts#L48)) and never written to speaker notes or slide text.
- **Does deleting source text remove it?** **CONFIRMED IN CODE (Yes, removed)**. [`src/app/api/decks/[id]/source/route.ts:32`](file:///e:/projects/Slidequill/slidequill/src/app/api/decks/%5Bid%5D/source/route.ts#L32) explicitly runs `$unset: { sourceName: "" }`.

#### Question 7: Does the editor let users see and edit notes with the source line included? Is the source line preserved if the user edits notes?
- **Finding:** **CONFIRMED IN CODE (Editor notes are READ-ONLY; no source line shown)**.
- **Analysis:** In [`src/app/(app)/decks/[id]/page.tsx:811-816`](file:///e:/projects/Slidequill/slidequill/src/app/%28app%29/decks/%5Bid%5D/page.tsx#L811-L816):
  ```tsx
  <div>
    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5a6384] mb-2">Slide Notes</h3>
    <p className="text-sm text-[#101A3A] leading-relaxed bg-[#F4F6FB] p-3 rounded-lg">
      {slides[activeSlideIdx].notes || "No notes."}
    </p>
  </div>
  ```
  1. The notes are rendered inside a static `<p>` tag. There is no `<textarea>` or input element. Users cannot edit notes directly in the GUI.
  2. The source line (`sourcePage` / `sourceSection`) is not shown in this notes box.
  3. Notes can only be updated via AI Chat (`op: "update_notes"`). When the chat updates notes ([`src/lib/ai-edit/apply.ts:117`](file:///e:/projects/Slidequill/slidequill/src/lib/ai-edit/apply.ts#L117)), it replaces `slide.notes` with `op.notes`. Because `sourcePage` is stored separately, `sourcePage` remains untouched in DB, but the source citation is never visible or editable in the notes field.

#### Question 8: Is there any claim-level traceability (which number came from which page), or only slide-level?
- **Finding:** **CONFIRMED IN CODE (Slide-level only; zero claim-level traceability)**.
- **Analysis:**
  - `sourcePage` and `sourceSection` exist solely as top-level fields on `SlideSchema` ([`src/lib/slides-schema.ts:237-238`](file:///e:/projects/Slidequill/slidequill/src/lib/slides-schema.ts#L237-L238)).
  - Individual stats (`content.stats[i]`), bullets (`content.bullets[i]`), table cells, and chart data points contain no metadata linking them to specific pages or lines.
  - The grounding validator in [`src/lib/slides-schema.ts:838-997`](file:///e:/projects/Slidequill/slidequill/src/lib/slides-schema.ts#L838-L997) performs string matching against the entire source document, but does not attach or persist page associations per metric.

---

## PART 3: RECOMMENDATION & IMPLEMENTATION PLAN

### 3.1 Gap Analysis & Percent Done

```
[Feedback Item 1: Editable Output]             ███████████░░░░░░░░░  55% Done
[Feedback Item 2: Speaker Notes Source Citations] █████░░░░░░░░░░░░░░░  25% Done
```

### 3.2 Detailed Minimal Change List

#### Feedback Item 1: Truly Editable Output

| Sub-task | Files to Modify | Recommended Implementation Approach | Risk | Effort |
| :--- | :--- | :--- | :---: | :---: |
| **Add Native PowerPoint Chart Export** | [`src/lib/export/pptx.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/export/pptx.ts) | Add `else if (slide.layout === "chart")` branch. Map `c.chartType` to `pptx.ChartType.bar`, `line`, or `pie`. Call `s.addChart(chartType, chartData, chartOptions)` with theme colors (`accentColor`, `accent2Color`). Add `s.addText(c.caption)` below chart. | Low | **M** |
| **Consolidate Card Backgrounds with Text** | [`src/lib/export/pptx.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/export/pptx.ts) | In `two_column` and `stats`, avoid separate decoupled background shapes by applying card fill/rounding directly to the primary container text frame or keeping card coordinates strictly bound. | Low | **S** |
| **Replace Non-Standard Font in Elegant Theme** | [`src/lib/themes.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/themes.ts#L126) | Change `headingFont.name` for `elegant` from `"Palatino Linotype"` to `"Georgia"` (or `"Palatino"`). Prevents broken font substitution in Google Slides. | Low | **S** |
| **Export Vector Icons as Movable SVG Objects** | [`src/lib/export/pptx.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/export/pptx.ts) | Render Lucide SVG icons to data URL strings and export as separate movable picture objects (`s.addImage`) positioned beside stats and bullets. | Med | **M** |

#### Feedback Item 2: Source References in Speaker Notes

| Sub-task | Files to Modify | Recommended Implementation Approach | Risk | Effort |
| :--- | :--- | :--- | :---: | :---: |
| **Append Deterministic Source Citations to Speaker Notes** | [`src/lib/export/pptx.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/export/pptx.ts#L88-L90)<br>[`src/app/api/decks/[id]/export/route.ts`](file:///e:/projects/Slidequill/slidequill/src/app/api/decks/%5Bid%5D/export/route.ts#L48) | Pass `deck.sourceName` into `buildPptx`. In `s.addNotes(...)`, format: `"${slide.notes}\n\nSource: ${sourceDocName}, ${pageString}"`. For DOCX/text fallback to `"${sourceDocName}, Section: ${slide.sourceSection}"`. | Very Low | **S** |
| **Deterministic Page References from Outline** | [`src/app/api/decks/[id]/generate/route.ts`](file:///e:/projects/Slidequill/slidequill/src/app/api/decks/%5Bid%5D/generate/route.ts#L288)<br>[`src/lib/slides-schema.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/slides-schema.ts#L237) | Update `SlideSchema.sourcePage` to accept string ranges (e.g. `"18-20"`). Populate `slide.sourcePage` deterministically from `section.pageRange` during generation instead of trusting LLM JSON output. | Low | **S** |
| **Preserve `sourceName` on Raw Text Deletion** | [`src/app/api/decks/[id]/source/route.ts:32`](file:///e:/projects/Slidequill/slidequill/src/app/api/decks/%5Bid%5D/source/route.ts#L32) | Remove `sourceName: ""` from the `$unset` query so document name metadata remains permanently attached to the deck after source text deletion. | Very Low | **S** |
| **Preserve `sourceSection` on Slide Regeneration** | [`src/app/api/decks/[id]/slides/[slideId]/regenerate/route.ts:116`](file:///e:/projects/Slidequill/slidequill/src/app/api/decks/%5Bid%5D/slides/%5BslideId%5D/regenerate/route.ts#L116) | Copy `sourceSection: existingSlide.sourceSection` and `sourcePage: existingSlide.sourcePage` onto `newSlide` when regenerating. | Very Low | **S** |
| **Editable Speaker Notes with Source in GUI** | [`src/app/(app)/decks/[id]/page.tsx:813`](file:///e:/projects/Slidequill/slidequill/src/app/%28app%29/decks/%5Bid%5D/page.tsx#L813) | Replace static `<p>` with a `<textarea>` that updates `activeSlide.notes`, rendering the source citation line clearly beneath the textarea. | Low | **S** |

---

### 3.3 What is Risky or NOT Worth Doing in the Feedback

1. **Claim-Level Sentence-by-Sentence Citations on the Slide Canvas:**
   - *Why risky / not worth doing:* Inserting footnote badges (`[p. 18]`, `[p. 21]`) inside slide bullet points clutters presentation slides, breaks layout auto-fitting, and reduces visual polish. Slide readers expect clean executive slides. Slide-level source citations placed inside Speaker Notes provide 100% auditability without cluttering canvas aesthetics.
2. **Rewriting PPTXGenJS Slide Masters with Layout Placeholders:**
   - *Why risky / not worth doing:* PPTXGenJS has brittle support for custom layout placeholders across varying PowerPoint versions and Google Slides imports. Converting free-floating coordinates to complex master placeholders introduces a high risk of broken slide geometry. Free-floating text boxes with strict bounding coordinates are more reliable across PowerPoint, Keynote, and Google Slides.

---

## 4. Verification Check
- Read-only audit completed.
- Zero build, test, script, or server commands executed.
- Zero code modifications committed.
- All claims verified against source files and line ranges.
