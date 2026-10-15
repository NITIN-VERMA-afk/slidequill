# SlideQuill Codebase Audit (Step 0)

Date: October 2026  
Status: Complete  

---

## 1. Supported Layout Types

The presentation schema (`src/lib/slides-schema.ts`) supports 8 layout variants defined via Zod discriminated union on `layout`:

| Layout | Purpose | Content Fields |
|---|---|---|
| `title` | Presentation cover slide | `subtitle?: string` |
| `bullets` | Key takeaways / lists | `bullets: string[]` (min 3, max 6) |
| `two_column` | Side-by-side comparison or breakdown | `left: { heading?: string, bullets: string[] (2-4) }`, `right: { heading?: string, bullets: string[] (2-4) }` |
| `stats` | Key performance indicators & metrics | `stats: { value: string, label: string }[]` (min 2, max 4) |
| `process` | Sequential timeline / numbered workflow | `steps: { label: string, desc: string }[]` (min 3, max 5) |
| `comparison` | Multi-column pros/cons or option comparison | `columns: { heading: string, bullets: string[] (2-4) }[]` (min 2, max 3) |
| `quote` | Testimonial, citation, or key statement | `quote: string`, `attribution?: string` |
| `closing` | Final slide with call-to-action | `headline: string`, `cta?: string` |

---

## 2. Text Length Constraints & Validation Vulnerabilities

### Current Enforcement Mechanism
Text constraints are currently enforced using a naive word-count helper:
```ts
const textRule = (maxWords: number) => 
  z.string().refine(s => s.split(" ").length <= maxWords, { message: `Max ${maxWords} words` });
```

### Specific Field Word Limits
- **Slide Title**: Max 8 words
- **Title Subtitle**: Max 15 words
- **Bullets**: Max 12 words per bullet (3-6 bullets)
- **Two-Column Headings**: Max 6 words; **Bullets**: Max 12 words per bullet (2-4 bullets per column)
- **Stats**: Value max 4 words; Label max 8 words (2-4 stats)
- **Process Steps**: Label max 5 words; Description max 10 words (3-5 steps)
- **Comparison Columns**: Heading max 5 words; Bullets max 10 words (2-3 columns)
- **Quote**: Quote max 30 words; Attribution max 8 words
- **Closing**: Headline max 8 words; CTA max 10 words

### Critical Vulnerabilities in Current Constraint Logic
1. **Silent Drop on Validation Failure**:
   In `src/app/api/decks/[id]/generate/route.ts`:
   ```ts
   const parsed = SlideSchema.safeParse(JSON.parse(raw));
   if (!parsed.success) {
     console.error("Slide schema validation failed:", parsed.error.issues);
     return null; // Entire slide is discarded!
   }
   ```
   If the AI model produces 9 words for a title or 13 words for a bullet, `SlideSchema.safeParse` fails and returns `null`. The slide is silently omitted from the final presentation without retry or truncation.
2. **Word Count vs. Character & Line Length**:
   Word count (`split(" ").length`) does not correlate directly with rendered dimensions:
   - A 12-word bullet with long technical vocabulary (e.g. "Microservices architectural infrastructure decentralization and internationalization implementation initiatives") takes 2x the horizontal width of 12 short words.
   - Multi-word stats like "USD $450 Million" will break into 3 lines and spill over the slide footer in a narrow 4-column layout.
3. **Lack of Character-Level Bounds**:
   There are currently no `z.string().max(chars)` or line limits.

---

## 3. Discrepancies: Editor Preview (`SlideRenderer.tsx`) vs PPTX Export (`export/pptx.ts`)

| Feature / Element | In-Editor Preview (`SlideRenderer.tsx`) | Exported PowerPoint (`export/pptx.ts`) | Divergence Impact |
|---|---|---|---|
| **Fonts** | Injects live Google Webfonts (`Inter`, `Playfair Display`, `Space Grotesk`, `Fredoka`, `Merriweather`, `Outfit`). | Uses fallback fonts (`Arial`, `Calibri`, `Georgia`). (And `export-pptx.ts` tries raw Google font names, which fail if not installed locally). | Type kerning, line wraps, and visual style look completely different between web preview and PowerPoint. |
| **Containers & Cards** | Renders rounded `surface` cards (`cornerRadius` CQW), card padding, shadow, and borders for Stats, Two-Column, and Process. | Only outputs bare text boxes (`s.addText`) at coordinate percentages. No background boxes, shapes, or card borders. | Preview looks modern and layered; PPTX export looks flat and unpolished. |
| **Accent Elements** | Slide title includes an accent underline pill (`h: 0.5cqw, w: 10cqw`). Process steps have circular numbered badges (`w: 7cqw, h: 7cqw`) and a connector line. | No accent underline pill. Process steps have bare numbers as text boxes without circular badges or connector line. | Structural visuals disappear in export. |
| **Title Slide Layout** | Honors `theme.titleSlideStyle`: `"split"`, `"left"`, or `"center"`. Split style has dual container backgrounds. | Ignores `titleSlideStyle`; always hardcodes centered title at 35% Y and subtitle at 55% Y. | Split and Left theme designs do not translate to PPTX. |
| **Title Color** | Titles use `theme.colors.accent`. | Titles use `theme.colors.text`. | Color inconsistency between screen and download. |
| **Overflow Handling** | CSS `overflow-y-auto` allows tall content to scroll inside the preview. | Fixed PPTX bounding box coordinates. Content overflowing either gets cut off or shrunken aggressively by PowerPoint's `shrinkText: true`. | What "looks fine" in the preview can be broken or unreadable in the exported PPTX. |
| **Duplicate Exporter Code** | `src/lib/export-pptx.ts` is an older orphaned client-side script, while `src/lib/export/pptx.ts` is the active server route exporter. | Two out-of-sync export implementations exist in `src/lib/`. | Confusion and risk of modifying the wrong file. |

---

## 4. Known Overflow Risks

1. **Title Length & Multi-Line Wrapping**:
   - `export/pptx.ts` allocates `h: "15%"` for slide title (`y: "5%"` to `"20%"`).
   - Content starts at `y: "22%"`. If a title wraps to 3 lines at font size 32pt, it overlaps the top of the content box.
2. **Bullets Density (3-6 Bullets @ 12 Words Each)**:
   - 6 bullets with 12 words each at 24pt font inside `h: "70%"` exceeds typical 16:9 slide vertical space (~5.6 inches usable). PowerPoint forces aggressive shrink to <14pt or overflows.
3. **Two-Column Narrow Width**:
   - Each column is only 42% width. Bullets of 12 words wrap into 3-4 lines each. With 4 bullets plus heading, total text height exceeds the 60% vertical box.
4. **Process 5-Step Cramming**:
   - At 5 steps, each step has only ~18% width (`90% / 5`). A 5-word title and 10-word description wraps to 5+ lines, pushing step description below the slide boundary.
5. **Stats Values with Units / Long Strings**:
   - 4 stats columns allocate 22.5% width. Numbers like "+142.8% YoY" or "$1.2 Billion" at 48pt will wrap awkwardly or clip.
6. **Quote Layout**:
   - 30-word quote at 32pt can take 5+ lines, pushing attribution past the slide bottom.

---

## 5. Cost-Driving OpenAI Calls Per Deck

| Pipeline Step | Endpoint / Method | Model | Number of Calls Per Deck | Cost Drivers & Input Size |
|---|---|---|---|---|
| **Outline Generation** | `POST /api/decks/[id]/outline` | `OUTLINE_MODEL` (`gpt-4o-mini`) | **1 call** | Input: Up to 12,000 characters (~3,000 tokens) of source document text. Output: ~500 tokens (JSON array of 5-12 sections). |
| **Slide Generation** | `POST /api/decks/[id]/generate` | `SLIDES_MODEL` (`gpt-4o-mini`) | **N calls** (where N = number of outline sections, typically 5-12) | Concurrently calls `generateSlide` for each outline section (concurrency = 4). Each call takes ~350 prompt tokens and ~250 completion tokens. Total: **5 to 12 calls per deck**. |
| **Slide Regeneration** | `POST /api/decks/[id]/slides/[slideId]/regenerate` | `SLIDES_MODEL` (`gpt-4o-mini`) | **0 to 10+ calls** per user edit session | 1 call per user regeneration click. Currently 0 credit cost; capped only at 10 regenerations per slide. |
| **Editor AI Chat** | `POST /api/decks/[id]/chat` | `CHAT_MODEL` (`gpt-4o-mini`) | **0 to 30 calls** per deck | Dumps all deck slides JSON + last 10 messages into context on every user message. Token usage grows as deck size increases. |

*Total LLM calls for a newly generated 10-slide deck: **11 OpenAI calls** (1 outline + 10 slide generation calls).*

---

## Proposed Implementation Plan (Next Steps)

### Phase 1: Export Fidelity and Layout Safety
1. **Shared Layout Constants (`src/lib/layout-constants.ts`)**:
   - Centralize layout geometry, margins, dimensions, font sizes, and line-heights shared by both `SlideRenderer.tsx` and `export/pptx.ts`.
   - Delete/consolidate the dead `src/lib/export-pptx.ts` into `src/lib/export/pptx.ts`.
2. **Schema & Prompt Hardening (`src/lib/slides-schema.ts`, `generate/route.ts`)**:
   - Add explicit character and line constraints alongside word limits for all layout types.
   - Update prompt guidelines and schema descriptions to prevent model rejection.
   - Add auto-clipping/sanitization fallbacks so safeParse never returns `null` for minor overages.
3. **Auto-fit & Safe Rendering in PPTX (`src/lib/export/pptx.ts`)**:
   - Implement text measurement/estimation logic. Dynamically calculate font size step-down (e.g., 24pt -> 20pt -> 18pt min) to guarantee zero clipping.
   - If bullets or content strictly exceed safe maximums, implement overflow splitting into a clean continuation slide `(Part 2)`.
   - Render surface background cards, accent pills, process circles, and borders in PPTX using native PowerPoint shapes (`s.addShape`) matching `SlideRenderer.tsx`.
   - Support `theme.titleSlideStyle` (split, left, center) in PPTX.
4. **Font Normalization (`src/lib/themes.ts`)**:
   - Restrict to universally available PowerPoint system fonts (e.g. Arial, Calibri, Trebuchet MS, Georgia, Palatino) and ensure matching webfont fallbacks.
5. **Fixtures & Automated Export Testing (`scripts/test-export.ts`)**:
   - Create a test script with 10 representative deck fixtures (short, text-heavy, quote-heavy, stats-heavy, multi-column, max-bullet counts, etc.).
   - Output PPTX files to a test directory for automated validation and visual inspection.
