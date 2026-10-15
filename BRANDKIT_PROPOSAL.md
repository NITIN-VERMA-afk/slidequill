# Slidequill Brand Kit Architecture & Custom Template Proposal

## 1. Executive Summary
This proposal specifies the design and implementation roadmap for **Slidequill Brand Kits**. It provides paying customers and enterprise teams with custom branded presentation themes (colors, custom fonts, logos, and layout styling) while preserving the stability of the core AI generation pipeline.

Per product requirements, this document outlines the architecture, data models, logo security protocols, plan gating, and PPTX theme XML extraction mechanisms. **Custom template upload is not implemented in this phase.**

---

## 2. Brand Kit Data Model

### 2.1 Database Schema (`BrandKit` Model)
```typescript
import mongoose, { Schema, Document } from "mongoose";

export interface IBrandKit extends Document {
  userId: string;
  name: string;
  isDefault: boolean;
  colors: {
    bg: string;          // Hex e.g. "#FFFFFF"
    surface: string;     // Hex e.g. "#F8FAFC"
    text: string;        // Hex e.g. "#0F172A"
    mutedText: string;   // Hex e.g. "#64748B"
    accent: string;      // Primary brand accent e.g. "#2F5BFF"
    accent2: string;     // Secondary accent e.g. "#3B82F6"
  };
  headingFont: {
    name: string;        // PPTX-safe font name (e.g. "Calibri", "Arial", "Georgia")
    webFontUrl?: string; // Optional Google Font URL for web renderer
    fallback: string;    // CSS fallback stack e.g. "sans-serif"
  };
  bodyFont: {
    name: string;
    webFontUrl?: string;
    fallback: string;
  };
  logo?: {
    url: string;         // Secured storage URL
    storageKey: string;  // S3 / R2 object key
    widthPt: number;     // Constrained width in PowerPoint points (e.g. 72 - 120 pt)
    heightPt: number;
    placement: "top-right" | "top-left" | "bottom-right";
  };
  titleSlideStyle: "center" | "left" | "split";
  cornerRadius: number;  // In cqw (0 = sharp rectangle, 1-4 = rounded)
  createdAt: Date;
  updatedAt: Date;
}

const BrandKitSchema = new Schema<IBrandKit>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, maxlength: 60 },
    isDefault: { type: Boolean, default: false },
    colors: {
      bg: { type: String, required: true, match: /^#[0-9A-Fa-f]{6}$/ },
      surface: { type: String, required: true, match: /^#[0-9A-Fa-f]{6}$/ },
      text: { type: String, required: true, match: /^#[0-9A-Fa-f]{6}$/ },
      mutedText: { type: String, required: true, match: /^#[0-9A-Fa-f]{6}$/ },
      accent: { type: String, required: true, match: /^#[0-9A-Fa-f]{6}$/ },
      accent2: { type: String, required: true, match: /^#[0-9A-Fa-f]{6}$/ },
    },
    headingFont: {
      name: { type: String, required: true, maxlength: 50 },
      webFontUrl: { type: String, maxlength: 500 },
      fallback: { type: String, required: true, default: "sans-serif" },
    },
    bodyFont: {
      name: { type: String, required: true, maxlength: 50 },
      webFontUrl: { type: String, maxlength: 500 },
      fallback: { type: String, required: true, default: "sans-serif" },
    },
    logo: {
      url: { type: String, maxlength: 500 },
      storageKey: { type: String, maxlength: 250 },
      widthPt: { type: Number, default: 72 },
      heightPt: { type: Number, default: 24 },
      placement: { type: String, enum: ["top-right", "top-left", "bottom-right"], default: "top-right" },
    },
    titleSlideStyle: { type: String, enum: ["center", "left", "split"], default: "left" },
    cornerRadius: { type: Number, min: 0, max: 4, default: 1 },
  },
  { timestamps: true }
);

BrandKitSchema.index({ userId: 1, isDefault: 1 });
export default mongoose.models.BrandKit || mongoose.model<IBrandKit>("BrandKit", BrandKitSchema);
```

### 2.2 Integration with the Generation Pipeline
1. `BrandKit` conforms to the existing `ThemeDef` interface in `src/lib/themes.ts`.
2. When creating a deck, users choose either a standard template (`modern`, `corporate`, etc.) or their custom `brandKitId`.
3. In the deck record: `deck.theme = brandKit._id.toString()`.
4. `getTheme(id)` resolves against custom brand kits first if matching a valid MongoDB ObjectId, falling back to standard presets.

---

## 3. Logo Upload Security Architecture

Allowing user image uploads introduces major security risks (SSRF, remote code execution, SVG script injection, image decompression bombs). The brand kit upload workflow must enforce strict defense-in-depth:

### 3.1 Upload Protocol
1. **Direct-to-Object-Storage Uploads:**
   - Client requests a presigned PUT URL via `POST /api/brand-kit/logo/upload-url`.
   - Server authenticates the user, checks tier eligibility, and returns a short-lived presigned S3/R2 URL with strict `Content-Length-Range` (max 2 MB) and authorized MIME types.
2. **Strict MIME & Magic Byte Validation:**
   - Supported logo formats: `image/png` and `image/jpeg` only.
   - **Reject SVG files:** SVGs are executable XML and prone to Stored XSS, XML External Entity (XXE) attacks, and SSRF. Converting SVGs to sanitized raster formats on a background worker is required if SVGs are ever permitted.
   - Verify magic bytes (`89 50 4E 47` for PNG, `FF D8 FF` for JPEG) before confirming attachment.
3. **Image Dimensions & Decompression Bomb Protection:**
   - Using `sharp` or image header parsing, reject images exceeding 4000x4000 pixels or aspect ratios exceeding 10:1.
   - Re-encode the logo during processing to strip EXIF metadata and active scripts.

---

## 4. Plan Gating & Entitlements

Brand Kits represent high-value enterprise features and should be gated behind paid tiers:

| Tier | Brand Kits Allowed | Custom Logo | Color Customization | PPTX Export Watermark |
| :--- | :--- | :--- | :--- | :--- |
| **Free Tier** | 0 (Presets only) | ❌ No | ❌ No | Yes ("Made with Slidequill") |
| **20-Credit Pack** | 1 Brand Kit | ✅ Yes (1 Logo) | ✅ Full Hex Palettes | No Watermark |
| **50-Credit Pack** | Up to 3 Brand Kits | ✅ Yes | ✅ Full Hex + Font Pairing | No Watermark |
| **Enterprise / Team** | Unlimited | ✅ Multi-Logo | ✅ Centralized Brand Guide | No Watermark |

### 4.1 Entitlement Enforcement
- Server-side validation during `POST /api/brand-kits` verifies the user's purchased plan/credit pack.
- If a user's credits lapse, their existing brand kit configurations remain saved in read-only state.
- Presentation exports with brand kits remain watermark-free for paid packages.

---

## 5. PPTX Theme XML Extraction (`.thmx` & `.pptx` Uploads)

PowerPoint templates store their design language in OpenXML packages under `ppt/theme/theme1.xml`.

### 5.1 Extraction Mechanism
When a user uploads an existing `.pptx` or `.thmx` file:
1. Parse the zip archive using `jszip`.
2. Locate and parse `ppt/theme/theme1.xml`.
3. Extract DrawingML color mapping from `<a:clrScheme>`:
   - `lt1` / `dk1` -> Background and primary text.
   - `accent1`, `accent2`, `accent3` -> Brand accent colors.
4. Extract typography from `<a:fontScheme>`:
   - `<a:majorFont>` -> Title / Heading typeface.
   - `<a:minorFont>` -> Body typeface.
5. Populate the `BrandKit` draft in the UI for user review and confirmation before saving.

### 5.2 Technical Constraints with PPTXGenJS
- `pptxgenjs` constructs presentation slides programmatically using shape primitives and slide masters. It cannot directly accept arbitrary PowerPoint slide masters (`slideMaster1.xml`) with proprietary XML layout definitions.
- Therefore, extracting the **tokenized palette and typography** into a Slidequill Brand Kit provides 100% layout compatibility with our auto-fit responsive layout engine, avoiding corrupted slide layouts.

---

## 6. Implementation Phasing

1. **Phase 1 (Data & UI Model):** Implement `BrandKit` mongoose schema and Brand Kit settings page (`/settings/brand-kit`) allowing manual hex color and font selection.
2. **Phase 2 (Logo Upload & PPTX Placement):** Integrate secure S3/R2 presigned upload pipeline; place logo on exported slide headers.
3. **Phase 3 (PPTX Theme Extractor):** Add drag-and-drop `.pptx` parser that reads `ppt/theme/theme1.xml` and autofills the Brand Kit palette.
