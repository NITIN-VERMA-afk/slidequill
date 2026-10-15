# SlideQuill Security & Resilience Hardening Review (HARDENING.md)

This document provides a comprehensive summary of the hardening review, architectural fixes, security protections, and testing verification executed for **SlideQuill** (`slidequill.in`).

---

## 1. Executive Summary

| Dimension | Primary Vulnerability / Risk | Mitigation & Architecture Fix | Test Coverage |
| :--- | :--- | :--- | :--- |
| **1. SSRF & Image Fetching** | Server-Side Request Forgery targeting loopbacks/cloud metadata (`169.254.169.254`), DNS rebinding, spoofed SVG/HTML payloads. | Created [`safe-image-fetcher.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/safe-image-fetcher.ts) with custom DNS lookup pinning to validated public IP, max 3 manual redirect hops with re-validation, 7s timeout, 5 MB stream cap, magic bytes inspection (JPEG/PNG/WebP), SVG rejection, and bundled placeholder fallback. Server-side validation on URL saves. Base64/buffer piped to PPTX export. | 8 test suites passing (`safe-image.test.ts`) |
| **2. Image Licensing & Attribution** | Uncredited stock fallback images, missing Unsplash API download tracking, removed photographer attribution. | Corrected default fallback attribution to Austin Distel ([`image-search.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/image-search.ts)). Added Unsplash download-tracking proxy ([`track-download/route.ts`](file:///e:/projects/Slidequill/slidequill/src/app/api/images/track-download/route.ts)). Preserved non-removable photographer credit in slide model and PPTX export ([`export/pptx.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/export/pptx.ts)). | 2 test suites passing (`image-search.test.ts`) |
| **3. Page-Aware Document Extraction** | AI model hallucinating non-existent slide page numbers; ambiguous page boundaries in PDFs/DOCX. | Updated [`extract.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/extract.ts) to parse per-page text via `unpdf` with `mergePages: false`, inject `--- [Page X] ---` markers, and count total pages. In [`slides-schema.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/slides-schema.ts), `validateAndSanitizeSourcePage` strips `sourcePage` for DOCX/text and bounds `1 <= sourcePage <= sourcePageCount` for PDFs. | 5 tests passing (`slides-schema.test.ts`) |
| **4. Rate Limiting & Abuse Prevention** | Multi-account spam via Gmail dot/plus tricks, disposable email providers, unverified free accounts exhausting AI quotas. | Implemented [`disposable-emails.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/disposable-emails.ts) (blocking 40+ burner providers), `normalizeEmail` (canonicalizing Gmail dots/plus aliases), [`ip.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/ip.ts) (safe header extraction with `net.isIP`), signup IP rate limiting (10/24h), user generation limits (20/day free, 100/day paid in [`ratelimit.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/ratelimit.ts)), and required email verification for free generations. | 12 tests passing (`ratelimit-auth.test.ts`) |
| **5. Refund Safety & Financial Concurrency** | Race conditions causing double-refunds on generation failure, or refunding free-tier/ready decks. | Added `creditCharged` and `creditRefunded` flags to [`Deck.ts`](file:///e:/projects/Slidequill/slidequill/src/app/models/Deck.ts). Implemented atomic `Deck.findOneAndUpdate` guard `executeAtomicRefund` in [`generate/route.ts`](file:///e:/projects/Slidequill/slidequill/src/app/api/decks/[id]/generate/route.ts) ensuring only charged, non-refunded, non-ready decks are refunded, and concurrent executions yield at most one refund. | 4 tests passing with `mongodb-memory-server` (`refund-safety.test.ts`) |
| **6. Privacy, Retention & Analytics** | Document and prompt leakage into analytics events; vague document storage copy in privacy policy and FAQ. | Updated [`privacy/page.tsx`](file:///e:/projects/Slidequill/slidequill/src/app/(Landingpage)/privacy/page.tsx) and [`page.tsx`](file:///e:/projects/Slidequill/slidequill/src/app/(Landingpage)/page.tsx) declaring exact 30-day automatic deletion. Added `DELETE /api/decks/[id]/source` endpoint ([`source/route.ts`](file:///e:/projects/Slidequill/slidequill/src/app/api/decks/[id]/source/route.ts)) and UI button to permanently erase source text instantly. Created `sanitizeAnalyticsErrorMessage` in [`analytics.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/analytics.ts) ensuring error categories never leak document or prompt excerpts. | 12 tests passing (`analytics-sanitization.test.ts`, `source-text-deletion.test.ts`) |
| **7. Schema & Payload Sanitization** | LLM generating unbounded strings or invalid schemas crashing frontend rendering. | Implemented `sanitizeSlidePayload`, `countWords`, and `truncateWordsAndChars` in [`slides-schema.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/slides-schema.ts). Over-long strings truncated at word boundaries, arrays capped, fallback slides marked with `meta.fallback = true`, and telemetry counters tracked without document text. | 16 tests passing (`slides-schema.test.ts`) |
| **8. Export & Admin Hardening** | PPTX export crashing on missing assets; unauthorized access to admin metrics. | PPTX export passes downloaded buffer/base64 directly to `pptxgenjs` with resilient fallbacks. Tested admin funnel access controls ([`admin-funnel.test.ts`](file:///e:/projects/Slidequill/slidequill/src/app/api/admin/__tests__/admin-funnel.test.ts)) enforcing 401 unauthenticated and 403 non-admin rejection. | 5 tests passing (`admin-funnel.test.ts`) |

---

## 2. Detailed Technical Implementations

### 2.1 SSRF-Safe Image Fetching
- **Location:** [`src/lib/safe-image-fetcher.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/safe-image-fetcher.ts)
- **Mechanisms:**
  - **DNS Resolution Pinning:** Custom `dns.lookup` callback ensures the socket connects directly to the IP validated against private ranges (RFC 1918, RFC 3927, RFC 4193, loopback, IPv4-mapped IPv6), neutralizing DNS rebinding attacks.
  - **SNI Preservation:** Passes original `hostname` in `servername` options for TLS validation.
  - **Redirect Safety:** Enforces `redirect: "manual"` up to 3 hops, re-verifying scheme (HTTPS only) and destination IP before initiating each hop.
  - **Stream & Byte Validation:** 5 MB cap enforced during download stream (`content-length` check + chunk counter). Verifies magic bytes (`FF D8 FF` for JPEG, `89 50 4E 47` for PNG, `52 49 46 46...57 45 42 50` for WebP). Explicitly rejects SVG and XML payloads.
  - **Bundled Fallback:** On any network, DNS, validation, or timeout failure, returns `BUNDLED_PLACEHOLDER_DATA_URL`, ensuring export operations never throw.
  - **Server-Side URL Validation:** Exported `validateImageUrlServerSide(url)` invoked in [`src/app/api/decks/[id]/route.ts`](file:///e:/projects/Slidequill/slidequill/src/app/api/decks/[id]/route.ts) whenever a user edits or saves custom slide images.

### 2.2 Image Licensing & Attribution
- **Location:** [`src/lib/image-search.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/image-search.ts), [`src/app/api/images/track-download/route.ts`](file:///e:/projects/Slidequill/slidequill/src/app/api/images/track-download/route.ts)
- **Mechanisms:**
  - Audited all curated fallbacks; identified uncredited fallback in `CURATED_FALLBACKS.default` and mapped to photographer Austin Distel (`https://unsplash.com/@austindistel`).
  - Implemented `trackUnsplashDownload` proxy endpoint sending API-authorized GET requests to Unsplash `download_location` upon user slide selection.
  - Attribution metadata (`photographer`, `photographerUrl`) is stored within slide content and rendered into PPTX speaker notes / attribution metadata.

### 2.3 Page-Aware Extraction & `sourcePage` Validation
- **Location:** [`src/lib/extract.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/extract.ts), [`src/lib/slides-schema.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/slides-schema.ts), [`src/app/models/Deck.ts`](file:///e:/projects/Slidequill/slidequill/src/app/models/Deck.ts)
- **Mechanisms:**
  - PDF extraction uses `unpdf` with `mergePages: false` to extract page-by-page text, injecting delimiter markers `--- [Page X] ---` and setting `sourcePageCount`.
  - Non-PDF uploads (DOCX and plain text) set `sourcePageCount: undefined`.
  - `validateAndSanitizeSourcePage(candidate, sourcePageCount)` validates that `1 <= sourcePage <= sourcePageCount` for PDFs and strips `sourcePage` for DOCX/text.
  - Enforced in outline generation, slide generation, slide regeneration, and manual PATCH saves.

### 2.4 Abuse Prevention & Rate Limiting
- **Location:** [`src/lib/disposable-emails.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/disposable-emails.ts), [`src/lib/ip.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/ip.ts), [`src/lib/ratelimit.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/ratelimit.ts), [`src/app/api/auth/signup/route.ts`](file:///e:/projects/Slidequill/slidequill/src/app/api/auth/signup/route.ts)
- **Mechanisms:**
  - `normalizeEmail()` strips dots from Gmail addresses, strips `+` alias tags, and maps `googlemail.com` to `gmail.com`.
  - `isDisposableEmail()` checks a comprehensive blocklist of 40+ temporary inbox domains (e.g. `mailinator.com`, `tempmail.com`, `guerrillamail.com`).
  - `getClientIp()` resolves real client IP prioritizing trusted infrastructure headers (`x-vercel-forwarded-for`, `cf-connecting-ip`, `x-real-ip`, leftmost `x-forwarded-for`), verified with `net.isIP()`.
  - Signup IP rate limiter (`getSignupIpLimiter`) caps signups to 10 per 24-hour window per IP.
  - Deck generation requires verified email (`emailVerified === true`) for free accounts, with tiered rate limits (20 generations/day free, 100 generations/day paid).

### 2.5 Refund Safety & Financial Concurrency
- **Location:** [`src/app/models/Deck.ts`](file:///e:/projects/Slidequill/slidequill/src/app/models/Deck.ts), [`src/app/api/decks/[id]/generate/route.ts`](file:///e:/projects/Slidequill/slidequill/src/app/api/decks/[id]/generate/route.ts)
- **Mechanisms:**
  - Deck schema includes `creditCharged: { type: Boolean, default: false }` and `creditRefunded: { type: Boolean, default: false }`.
  - On generation failure, `executeAtomicRefund(deckId, userId)` executes an atomic update query:
    ```ts
    Deck.findOneAndUpdate(
      { _id: deckId, userId, creditCharged: true, creditRefunded: false, status: { $ne: "ready" } },
      { $set: { creditRefunded: true, status: "failed" } }
    )
    ```
  - User credits are incremented if and only if the atomic update modified a document. A deck with status `"ready"` is never refunded. Concurrent failure events trigger at most one refund.

### 2.6 Privacy, Instant Source Deletion & Sanitized Analytics
- **Location:** [`src/app/(Landingpage)/privacy/page.tsx`](file:///e:/projects/Slidequill/slidequill/src/app/(Landingpage)/privacy/page.tsx), [`src/app/(Landingpage)/page.tsx`](file:///e:/projects/Slidequill/slidequill/src/app/(Landingpage)/page.tsx), [`src/app/api/decks/[id]/source/route.ts`](file:///e:/projects/Slidequill/slidequill/src/app/api/decks/[id]/source/route.ts), [`src/lib/analytics.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/analytics.ts)
- **Mechanisms:**
  - Updated FAQ and Privacy Policy declaring: *"Uploaded documents and source text are automatically permanently deleted after 30 days. You can also delete your uploaded source text immediately at any time from your deck editor using the 'Delete source text now' button."*
  - Decks store `sourceExpiresAt` defaulted to `now + 30 days`, cleaned up automatically by [`src/app/api/cron/cleanup/route.ts`](file:///e:/projects/Slidequill/slidequill/src/app/api/cron/cleanup/route.ts).
  - Added `DELETE /api/decks/[id]/source` endpoint and UI control allowing authenticated owners to immediately and permanently purge `sourceText` and `sourceName`.
  - Added `sanitizeAnalyticsErrorMessage(err)` in [`src/lib/analytics.ts`](file:///e:/projects/Slidequill/slidequill/src/lib/analytics.ts), mapping exceptions to clean category identifiers (`rate_limit_exceeded`, `timeout`, `parse_error`, `validation_error`, `quota_exceeded`, `auth_error`, `network_error`, `generation_internal_error`). Zero document snippets or prompt text can enter analytics tables.

---

## 3. Test Suite Verification

All automated tests executed with `tsx --test` against real in-memory MongoDB (`mongodb-memory-server`):

```text
# tests 85
# suites 22
# pass 85
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

### Breakdown of Test Suites
1. **SSRF Protections (`safe-image.test.ts`):** 17 tests
   - IP range blocking (RFC 1918, RFC 3927, loopback, IPv6 mapped)
   - Magic byte validation (JPEG, PNG, WebP)
   - SVG and XML strict rejection
   - Resilient placeholder fallback
   - Redirect to private IP (e.g. `169.254.169.254`) blocking
   - Spoofed Content-Type blocking
2. **Stock Search & Licensing (`image-search.test.ts`):** 2 tests
   - Austin Distel attribution verification
   - Curated fallbacks integrity
3. **Extraction & Source Page Bounds (`slides-schema.test.ts`):** 21 tests
   - Word counting and unicode/Hindi support
   - String truncation at word boundaries
   - Payload sanitization and array capping
   - `validateAndSanitizeSourcePage` bound enforcement
   - Hallucinated page number rejection
4. **Rate Limiting & Auth Abuse (`ratelimit-auth.test.ts`):** 12 tests
   - Gmail dot and plus normalization
   - Disposable email domain blocking
   - Client IP extraction & header spoofing defense
5. **Refund Safety & Concurrency (`refund-safety.test.ts`):** 4 tests
   - Exactly-once refund on failed charged deck
   - Non-charged (free-tier) decks never refunded
   - Ready status decks never refunded
   - Concurrent double-refund race condition guarantees exactly 1 refund
6. **Admin Funnel Access (`admin-funnel.test.ts`):** 5 tests
   - Unauthenticated 401 rejection
   - Non-admin 403 rejection
   - Admin 200 authorization
7. **Analytics Leakage Defense (`analytics-sanitization.test.ts`):** 9 tests
   - Prompt and confidential document text scrubbing
   - Classification of rate limits, timeouts, validation, quota, and parse errors
8. **Instant Source Deletion (`source-text-deletion.test.ts`):** 3 tests
   - Permanent unsetting of `sourceText` and `sourceName`
   - Rejection during active outlining
   - Rejection on non-owner attempts

### Codebase Health
- **TypeScript:** `npx tsc --noEmit` exited with code 0 (0 errors).
- **ESLint:** `npm run lint` exited with code 0 (0 errors, 28 warnings from pre-existing unused vars).
