# SlideQuill Image Generation & Rendering Audit (`IMAGES_AUDIT.md`)

**Date:** October 2026  
**Status:** Audit Complete — No Code Changes Made — Awaiting User Approval on Proposed Fix  
**Scope:** Root-cause analysis of why generated decks contain zero images, evaluation of API keys and safe fetching, layout distributions across fixtures, and detailed remediation architecture.

---

## 1. "Image" Layout Selection & Prompt Analysis

### Findings in Generate Route and Slide Prompt
In [`src/app/api/decks/[id]/generate/route.ts`](file:///e:/projects/Slidequill/slidequill/src/app/api/decks/[id]/generate/route.ts):
- **First and Last Slides:** The first slide is explicitly constrained to `"title"` layout (`if (isFirst) context += '\n\n(This is the FIRST section. Please use the "title" layout.)'`), and the last slide is constrained to `"closing"` layout (`if (isLast) context += '\n\n(This is the LAST section. Please use the "closing" layout.)'`). Neither of these layouts can be an `"image"` layout.
- **Intermediate Slides:** The system prompt lists 7 layouts neutrally:
  ```text
  Pick the best layout based on the content:
  - Use "chart" when the source contains numeric data, metrics over time, percentages, or distributions.
  - Use "image" when the section benefits from visual atmosphere (people, workspaces, tech, nature) with a relevant search keyword.
  - Use "stats" for 2-4 standalone key metrics (optionally select an icon name from the allowlist).
  - Use "process" for chronological or numbered sequences (optionally select an icon name from the allowlist).
  - Use "two_column" for pros/cons or dual perspectives.
  - Use "comparison" for multi-column option evaluations.
  - Use "bullets" for structured takeaways.
  ```
- **Never Requested or Encouraged:** The prompt does **not** specify any target frequency, ratio, or quota for images. It does not instruct the model to choose an image for a specific fraction of slides (e.g. 30–40%). Because business documents (financial reports, operational updates, strategic plans) are inherently factual and data-laden, the LLM (`gpt-4o-mini`) almost exclusively categorizes points into `"stats"`, `"bullets"`, `"process"`, or `"two_column"`.

### Empirical Test: 3 Decks Generated from Fixtures (10 Slides Each)
We executed 30 live generation requests using `gpt-4o-mini` with the exact system prompt, constraints, and outline sections derived from the workspace fixtures:
1. **Deck 1:** `5-page.txt` (Quarterly Business Review)
2. **Deck 2:** `30-page.txt` (Fiscal Portfolio Analysis)
3. **Deck 3:** `80-page.txt` (Multi-Division Strategic Report)

#### Layout Distribution Results

| Slide # | Deck 1 (`5-page.txt`) | Deck 2 (`30-page.txt`) | Deck 3 (`80-page.txt`) |
|:---|:---|:---|:---|
| **Slide 1** | `title` | `title` | `title` |
| **Slide 2** | `stats` | `stats` | `stats` |
| **Slide 3** | `stats` | `bullets` | `bullets` |
| **Slide 4** | `stats` | `stats` | `stats` |
| **Slide 5** | `stats` | `process` | `process` |
| **Slide 6** | `bullets` | `comparison` | `comparison` |
| **Slide 7** | `stats` | `stats` | `stats` |
| **Slide 8** | `bullets` | `stats` | `stats` |
| **Slide 9** | `two_column` | `bullets` | `stats` |
| **Slide 10** | `closing` | `closing` | `closing` |

#### Overall Layout Summary Across All 30 Slides

| Layout | Count | Percentage |
|:---|:---:|:---:|
| `stats` | 14 / 30 | **46.7%** |
| `bullets` | 5 / 30 | **16.7%** |
| `title` | 3 / 30 | **10.0%** |
| `closing` | 3 / 30 | **10.0%** |
| `process` | 2 / 30 | **6.7%** |
| `comparison` | 2 / 30 | **6.7%** |
| `two_column` | 1 / 30 | **3.3%** |
| `chart` | 0 / 30 | **0.0%** |
| `quote` | 0 / 30 | **0.0%** |
| `image` | **0 / 30** | **0.0%** |

**Conclusion:** Freshly generated decks contain **0% "image" slides**. Because images currently only exist when `layout === "image"`, decks are generated completely devoid of images.

---

## 2. Image Search Execution & Storage Points

### Is Search Called During Generation or Only in Editor?
1. **In Generation Route (`src/app/api/decks/[id]/generate/route.ts`):**
   - The function `enrichImageSlide(data)` is defined at lines 87–99:
     ```ts
     async function enrichImageSlide(data: any): Promise<any> {
       if (data?.layout === "image" && (!data.content?.imageUrl || !data.content.imageUrl.startsWith("http"))) {
         try {
           const stock = await searchStockImage(data.content?.imageKeyword || data.title);
           data.content.imageUrl = stock.url;
           data.content.photographer = stock.photographer;
           data.content.photographerUrl = stock.photographerUrl;
         } catch {
           // Graceful fallback already in searchStockImage
         }
       }
       return data;
     }
     ```
   - It is called at lines 155 and 190.
   - **Crucial gate:** `data?.layout === "image"`. Because the LLM never generates `layout === "image"`, **`searchStockImage` is NEVER called during generation**.
2. **In Editor Control (`src/app/(app)/decks/[id]/page.tsx`):**
   - Lines 804–886: The "Slide Image" section and "Search Stock Photos" swap control are gated behind:
     ```tsx
     {slides[activeSlideIdx]?.layout === "image" && (() => { ... })()}
     ```
   - For all 9 non-image layouts (`title`, `bullets`, `two_column`, `stats`, `process`, `comparison`, `quote`, `closing`, `chart`), this UI panel is completely unrendered. Users cannot view, add, or swap images on any slide unless the slide's layout is `"image"`.

### Query Generation and Storage Location
- **Where keyword/query is produced:**
  Currently, only the `image` layout schema defines `imageKeyword` ([`src/lib/slides-schema.ts:192`](file:///e:/projects/Slidequill/slidequill/src/lib/slides-schema.ts#L192)):
  `imageKeyword: textRule(4, 35).describe("Search keyword for image e.g. 'office teamwork'")`
  Non-image layout schemas (`title`, `bullets`, `two_column`, etc.) have **no keyword or image fields whatsoever**.
- **Where image URL is stored on the slide:**
  On `slide.content.imageUrl` (with optional attribution stored in `slide.content.photographer` and `slide.content.photographerUrl`).

---

## 3. Environment Variables & Missing Key Behavior

### Key Reading Mechanism
In [`src/lib/image-search.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/image-search.ts):
- Line 80 & 109: `const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;`
- Line 144: `const pexelsKey = process.env.PEXELS_API_KEY;`

In `.env.local`:
- `UNSPLASH_ACCESS_KEY` is **NOT defined**.
- `PEXELS_API_KEY` is **NOT defined**.

### Behavior When Keys Are Missing
1. **In `searchStockImage(keyword)`:**
   - Both Unsplash (Step 1) and Pexels (Step 2) are skipped.
   - Step 3 triggers `getFallbackForKeyword(query)`.
   - Returns one of 6 hardcoded entries in `CURATED_FALLBACKS` (`business`, `tech`, `teamwork`, `data`, `creative`, `default`), all of which are real Unsplash URLs (`https://images.unsplash.com/...`) with `source: "curated"`.
   - **Does not break or throw**, but returns the same curated fallbacks.
2. **In `searchMultipleStockImages(query, count)` (`/api/images/search`):**
   - Skips Unsplash API call; does not check Pexels at all.
   - Returns `Object.values(CURATED_FALLBACKS).slice(0, count)`.
3. **Current Provider Logging:**
   - **Currently missing entirely.** There is no log statement indicating which provider was selected or whether a fallback occurred.
   - **Required Log Line to be added per slide:**
     ```ts
     console.log(`[SlideImage] Slide ${slideIndex + 1} (${slide.layout}): image resolved via provider '${stock.source}' (query: "${query}") -> ${stock.url}`);
     ```

---

## 4. Safe-Image-Fetcher Diagnostic: Critical Bug Identified

### The Investigation
We tested [`src/lib/safe-image-fetcher.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/safe-image-fetcher.ts) against live URLs from Unsplash and Pexels:
- `https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80`
- `https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1`

### Test Result: 100% Failure Rate in Node.js 20+
Initial execution failed immediately on **all** valid Unsplash and Pexels URLs:
```text
STATUS: FAILED (56ms)
Error: Invalid IP address: undefined
```

### Root Cause Analysis
1. **Node.js 20+ Happy Eyeballs (`autoSelectFamily`):**  
   In Node.js 20+, `autoSelectFamily: true` is enabled by default in the HTTP/HTTPS network client. When `https.request` initiates a connection, it calls the custom `lookup` function with:
   ```js
   options = { family: undefined, hints: 0, all: true }
   ```
2. **The Contract of `dns.lookup` with `{ all: true }`:**  
   - When `all: false` (or undefined), `callback` expects: `(err, address: string, family: number)`.
   - When `all: true`, `callback` expects: `(err, addresses: Array<{ address: string, family: number }>)`.
3. **The Flaw in `safe-image-fetcher.ts:258`:**  
   The current code unconditionally invokes:
   ```ts
   lookup: (_hostname, _options, callback) => {
     callback(null, validatedIp, family);
   }
   ```
   Node's internal `lookupAndConnectMultiple` receives `validatedIp` (e.g. `"151.101.66.208"`) as the array argument. It tries to inspect `addresses[0].address`. Because `addresses[0]` is the character `"1"`, `addresses[0].address` evaluates to `undefined`, triggering:
   `TypeError [ERR_INVALID_IP_ADDRESS]: Invalid IP address: undefined`.
4. **Impact on PowerPoint Export (`src/lib/export/pptx.ts`):**  
   Because `fetchSafeImage(url)` catches errors and returns `BUNDLED_PLACEHOLDER_DATA_URL`, **every real image URL fetched for PPTX export silently fails and gets replaced by a 2x2 blank grey placeholder pixel!**

### Verification of Fix
When `lookup` handles `options?.all`:
```ts
lookup: (_hostname, options: any, callback) => {
  if (options && options.all) {
    callback(null, [{ address: validatedIp, family }] as any);
  } else {
    callback(null, validatedIp, family);
  }
}
```
**Diagnostic Result:**
- `images.unsplash.com` (Fastly CDN, IPv4 `151.101.130.208`, IPv6 `2a04:4e42::720`): **200 OK**, `content-type: image/webp`, magic bytes verified (`image/webp`), 349,434 bytes downloaded.
- `images.pexels.com` (Cloudflare CDN, IPv4 `104.18.67.220`, IPv6 `2606:4700::6812:43dc`): **200 OK**, `content-type: image/jpeg`, magic bytes verified (`image/jpeg`), 143,191 bytes downloaded.
- **SSRF, DNS, Content-Type, and Magic Bytes:** Neither Unsplash nor Pexels uses private IPs or disallowed formats. They are purely blocked by the `options.all` lookup signature bug.

---

## 5. Non-Image Layout Rendering in SlideRenderer & PPTX Export

### SlideRenderer (`src/components/app/SlideRenderer.tsx`)
Images are currently rendered **only** when `slide.layout === "image"`:
- Line 236: Split variant (`slide.layout === "image" && slide.content.variant !== "full_bleed"`)
- Line 284: Full bleed variant (`slide.layout === "image" && slide.content.variant === "full_bleed"`)
- **Zero support on any other layout:** `title`, `bullets`, `two_column`, `stats`, `process`, `comparison`, `quote`, `closing`, and `chart` ignore `imageUrl` entirely.

### PPTX Export (`src/lib/export/pptx.ts`)
Images are added **only** when `slide.layout === "image"`:
- Line 761: `} else if (slide.layout === "image") { ... }`
- Lines 770 & 840: `s.addImage({ data: safeImg.dataUrl, ... })`
- **Zero support on any other layout:** If a slide has layout `bullets` or `title` and has an image attached, PPTX export does not render the image.

---

## Proposed Remediation Architecture (Awaiting Approval)

To satisfy user expectations and solve all identified root causes, we propose the following end-to-end plan:

### 1. Schema Extensions (`src/lib/slides-schema.ts`)
- Add optional `imageQuery: textRule(4, 35).optional()` (2–4 word search phrase).
- Add optional `imagePlacement: z.enum(["right", "background", "none"]).default("right").optional()`.
- Add optional `imageUrl: z.string().optional()`, `photographer: z.string().optional()`, `photographerUrl: z.string().optional()`.
- Enable these fields across `title`, `bullets`, `two_column`, `quote`, and `closing` layouts.
- Strictly exclude image fields from `stats`, `process`, `chart`, and `comparison` layouts.

### 2. Slide Generation Prompt (`src/app/api/decks/[id]/generate/route.ts`)
- Update system prompt instructions:
  - Require `imageQuery` on roughly 30–40% of content slides.
  - Title and closing slides should usually include an `imageQuery` (with `imagePlacement: "background"` or `"right"`).
  - Explicit rule: **NEVER** include images on `stats`, `process`, `chart`, or `comparison` slides.
  - When an image is included on `bullets` or `two_column`, specify `imagePlacement: "right"` to enable split text/media layout.

### 3. Asynchronous Image Resolution with Concurrency Ceiling
- Extract image resolution from the individual slide generation loop into a dedicated post-generation phase.
- Use `p-limit` / bounded concurrency (e.g. max 3 parallel image requests) to prevent rate limit spikes.
- Graceful failure guarantee: If Unsplash/Pexels search fails or times out, the slide simply retains `imageUrl: undefined` (leaving it as a clean text slide without broken image placeholders).
- Add clear server logs per slide indicating provider:
  `[SlideImage] Slide ${idx + 1} (${slide.layout}): image resolved via provider '${stock.source}' (query: "${query}")`

### 4. Safe-Image-Fetcher Bug Fix (`src/lib/safe-image-fetcher.ts`)
- Update `lookup` in `fetchHop` to correctly handle `options?.all`:
  ```ts
  lookup: (_hostname, options: any, callback) => {
    if (options && options.all) {
      callback(null, [{ address: validatedIp, family }] as any);
    } else {
      callback(null, validatedIp, family);
    }
  }
  ```
- This immediately restores 100% success rate for downloading Unsplash and Pexels images in Node.js 20+.

### 5. Creation Wizard & Editor UI
- **Wizard (`src/app/(app)/decks/new/page.tsx`):**
  - Add a deck-level toggle: **"Include stock images"** (switch/checkbox, default: **checked / ON**).
  - Store `includeImages: boolean` on `Deck` model. If unchecked, slide generation skips adding `imageQuery`.
- **Editor (`src/app/(app)/decks/[id]/page.tsx`):**
  - Remove the `layout === "image"` restriction.
  - Display an **"Add image"** button on any slide that does not currently have an image (specifically on `title`, `bullets`, `two_column`, `quote`, `closing`).
  - Allow users to search, select, swap, or remove images, and change `imagePlacement` (`"right"` vs `"background"`).

### 6. Visual Rendering & PPTX Export Reflow
- **`SlideRenderer.tsx`:**
  - For `title` & `closing` with `imagePlacement === "background"`: Render subtle darkened scrim overlay behind text for high legibility.
  - For `bullets` & `two_column` with `imagePlacement === "right"`: Reflow text into left column (e.g. 55% width) and image into right container (e.g. 40% width).
- **`pptx.ts`:**
  - Support `c.imageUrl` on `title`, `closing`, `bullets`, and `two_column`.
  - Re-use dimensions from `layout-constants.ts` to guarantee zero text/image collisions.
  - Retain photographer credit attribution, Unsplash download tracking, and fallback protection.
