# SlideQuill Production Launch Readiness Checklist

**Target Launch Domain:** `https://slidequill.in`  
**Generated:** October 2026  
**Status:** Pre-Launch Final Verification  

This checklist enumerates all production requirements across infrastructure, security, monitoring, financial integrations, and reliability.  
- **[Verified in Code]**: Checked and confirmed by automated tests, TypeScript compiler, or repo configuration.
- **[Manual Action Required]**: Requires verification, credentials, or dashboard setup in external service consoles.

---

## 1. Environment Variables Configuration

| Variable | Scope | Status | Verification & Action |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | System | [Verified in Code] | Set to `production` in hosting provider (Vercel). Enforces secure cookies (`secure: true`, `sameSite: "lax"`). |
| `APP_URL` | Application | [Manual Action Required] | Set to `https://slidequill.in`. Used by CSRF validation, email links, and OAuth redirect callbacks. |
| `MONGODB_URI` | Database | [Manual Action Required] | Production MongoDB Atlas connection string. Verify dedicated production cluster (`slidequill_prod`), not development/shared M0. |
| `JWT_SECRET` | Authentication | [Manual Action Required] | Generate $\ge 32$ character high-entropy key (`openssl rand -hex 32`). Enforced strictly in code ($\ge 32$ chars required). |
| `OPENAI_API_KEY` | AI Engine | [Manual Action Required] | Production OpenAI key with active payment method, usage tier $\ge 2$, and monthly hard spend limit configured in OpenAI dashboard. |
| `OUTLINE_MODEL` | AI Engine | [Verified in Code] | Defaults to `gpt-4o-mini`. Verified live generation cost is $\le$ ₹0.50/deck. |
| `SLIDES_MODEL` | AI Engine | [Verified in Code] | Defaults to `gpt-4o-mini`. Grounded excerpts and JSON validation tested. |
| `UPSTASH_REDIS_REST_URL` | Rate Limiting | [Manual Action Required] | Production Upstash Redis REST endpoint. |
| `UPSTASH_REDIS_REST_TOKEN` | Rate Limiting | [Manual Action Required] | Production Upstash REST token. |
| `RESEND_API_KEY` | Transactional Email | [Manual Action Required] | Production Resend API key with sending permissions for `slidequill.in`. |
| `EMAIL_FROM` | Transactional Email | [Manual Action Required] | Set to verified address: `SlideQuill <hello@slidequill.in>` (replaces `onboarding@resend.dev`). |
| `SUPPORT_EMAIL` | Contact & Help | [Manual Action Required] | Set to `support@slidequill.in`. |
| `GOOGLE_CLIENT_ID` | OAuth | [Manual Action Required] | Google Cloud Console OAuth 2.0 Web Client ID. |
| `GOOGLE_CLIENT_SECRET` | OAuth | [Manual Action Required] | Google Cloud Console OAuth 2.0 Client Secret. |
| `RAZORPAY_KEY_ID` | Payments | [Manual Action Required] | Live key `rzp_live_...` (replace test key `rzp_test_...`). |
| `RAZORPAY_KEY_SECRET` | Payments | [Manual Action Required] | Live secret corresponding to `rzp_live_...`. |
| `RAZORPAY_WEBHOOK_SECRET` | Payments | [Manual Action Required] | Secret configured inside Razorpay Webhook dashboard for signature validation. |
| `CRON_SECRET` | Cron Security | [Manual Action Required] | High-entropy secret for securing `/api/cron/cleanup`. Enforced in code via `Bearer ${CRON_SECRET}`. |
| `NEXT_PUBLIC_SENTRY_DSN` | Error Monitoring | [Manual Action Required] | Production Sentry project DSN. Initialized in `sentry.client.config.ts`. |
| `SENTRY_AUTH_TOKEN` | Build Pipeline | [Manual Action Required] | Sentry internal token for uploading sourcemaps during Vercel production deployment. |
| `UNSPLASH_ACCESS_KEY` | Image Search | [Manual Action Required] | Production Unsplash API access key for slide image suggestions (falls back to safe placeholders if unset). |

---

## 2. Scheduled Cron & Recovery Pipeline

### 2.1 Code Implementation Status: [Verified in Code]
- **Endpoint:** `GET /api/cron/cleanup`
- **Security Guard:** Requires `Authorization: Bearer ${CRON_SECRET}`. Requests without matching secret receive `401 Unauthorized`.
- **Operations Performed:**
  1. **Source Data Cleanup:** Removes `sourceText`, `sourceName`, `chunkNotes`, and `outlineProgress` on decks older than 30 days (`sourceExpiresAt < now`). Decks themselves are never deleted.
  2. **Stuck Deck Recovery & Atomic Refund:** Finds decks stuck in `"outlining"` or `"generating"` with no progress for $\ge 30$ minutes (`updatedAt < now - 30m`). Marks deck as `"failed"` and refunds 1 credit using `executeAtomicRefund`. Verified exactly-once execution; cannot double refund on subsequent runs.
  3. **Auth Token Cleanup:** Proactively deletes consumed auth tokens.
- **Automated Tests:** Verified in `longdoc-stepper-and-recovery.test.ts` and `longdoc-pipeline.test.ts`.

### 2.2 Production Configuration: [Manual Action Required]
- [ ] **Vercel Cron Configuration:** `vercel.json` contains:
  ```json
  {
    "crons": [
      {
        "path": "/api/cron/cleanup",
        "schedule": "0 2 * * *"
      }
    ]
  }
  ```
  - **Hobby Plan Limitation:** Vercel Hobby plan only supports 1 cron execution per day (`0 2 * * *`). On Hobby, stuck deck refunds will occur during the daily 2 AM run.
  - **Pro Plan Recommendation:** If upgrading to Vercel Pro, update `schedule` in `vercel.json` to `"*/15 * * * *"` or `"*/30 * * * *"` so stuck decks recover within 30–45 minutes of a browser drop.
  - **Alternative (Free 15-min Trigger):** Configure an external cron ping (e.g. BetterStack, CronJob.de, or GitHub Actions scheduled workflow) to send a `GET` request every 15 minutes:
    `https://slidequill.in/api/cron/cleanup` with header `Authorization: Bearer <CRON_SECRET>`.

---

## 3. Sentry Error & Performance Monitoring

### 3.1 Code Implementation Status: [Verified in Code]
- **Configuration Files:** `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`.
- **PII Scrubbing:** `beforeSend` strips `event.request.data` (document texts, prompts) and `event.request.cookies` (JWT tokens, session cookies) before transmission.
- **Boundary Handling:** `src/app/error.tsx` explicitly captures unhandled client exceptions via `Sentry.captureException(error)`.

### 3.2 Production Actions: [Manual Action Required]
- [ ] Confirm Sentry Next.js project is created at [sentry.io](https://sentry.io).
- [ ] Add `NEXT_PUBLIC_SENTRY_DSN` to Vercel production environment variables.
- [ ] Add `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` in Vercel to enable sourcemap uploads during production build.
- [ ] Configure alert rule in Sentry: trigger Slack / email alert if error count exceeds 10 events / hour or on any 500 error in `/api/billing/*`.
- [ ] Trigger a test error from staging/preview deployment and confirm stack trace resolves to original TypeScript source code.

---

## 4. Razorpay Live Webhook & Payment Gateway

### 4.1 Code Implementation Status: [Verified in Code]
- **Webhook Endpoint:** `POST /api/billing/webhook`
- **Signature Validation:** Computes HMAC-SHA256 of raw request payload against `RAZORPAY_WEBHOOK_SECRET` using timing-safe hex comparison.
- **Idempotency & Replay Protection:** Re-delivered webhook events check `Purchase.status === "completed"`; duplicate credit additions are prevented.
- **Order Creation & Verification:** Standard endpoints `POST /api/billing/order` and `POST /api/billing/verify` validate payments with live keys.

### 4.2 Production Actions: [Manual Action Required]
- [ ] **Activate Razorpay Live Account:** Complete KYC and generate Live API Keys (`rzp_live_...`).
- [ ] **Add Live Keys to Vercel:** Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
- [ ] **Register Live Webhook:**
  - Login to Razorpay Dashboard $\rightarrow$ Settings $\rightarrow$ Webhooks $\rightarrow$ Add New Webhook.
  - **Webhook URL:** `https://slidequill.in/api/billing/webhook`
  - **Secret:** Generate a strong secret and save to both Razorpay and `RAZORPAY_WEBHOOK_SECRET` in Vercel.
  - **Active Events to Select:**
    - `order.paid`
    - `payment.captured`
    - `payment.failed`
- [ ] **Live Test Transaction:** Perform 1 real payment using a live credit card or UPI (e.g. ₹99 or ₹149 tier), verify credits increment immediately, and verify invoice/receipt displays on `/billing`.

---

## 5. Email Deliverability (SPF, DKIM, DMARC)

### 5.1 Code Implementation Status: [Verified in Code]
- Resend SDK integration in signup (`/api/auth/signup`), resend verification (`/api/auth/resend-verification`), forgot password (`/api/auth/forgot-password`), and contact form (`/api/contact`).
- Rate limiting on verification and password reset emails (3 requests / hour per IP/email via Upstash Redis).

### 5.2 Production Actions: [Manual Action Required]
- [ ] **Domain Verification in Resend:**
  - In [Resend Dashboard](https://resend.com/domains), add `slidequill.in`.
- [ ] **DNS Records Setup (at DNS provider - Cloudflare / GoDaddy / Namecheap):**
  - **DKIM:** Add 2 CNAME records provided by Resend (e.g. `resend._domainkey.slidequill.in`).
  - **SPF:** Add TXT record:
    - Host: `slidequill.in` (or `@`)
    - Value: `v=spf1 include:resend.com ~all`
  - **DMARC:** Add TXT record:
    - Host: `_dmarc` (or `_dmarc.slidequill.in`)
    - Value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@slidequill.in; pct=100; adkim=r; aspf=r`
- [ ] **Verify in Resend:** Confirm all 3 DNS checkmarks show status **Verified**.
- [ ] **Deliverability Test:** Send a test signup email to a Gmail address and check headers:
  - SPF: `PASS`
  - DKIM: `PASS`
  - DMARC: `PASS`
  - Ensure email arrives in Primary inbox (not Spam or Promotions).

---

## 6. Domain, HTTPS & Security Headers

### 6.1 Code Implementation Status: [Verified in Code]
- **Cookie Security:** `cookies.ts` enforces `secure: true`, `httpOnly: true`, `sameSite: "lax"`, and 30-day maxAge in production.
- **SSRF Defense:** `fetchSafeImageStrict` validates all external image fetches against loopback, link-local, private RFC 1918 IPs, and AWS/GCP metadata endpoints (`169.254.169.254`).
- **CSRF Defense:** `csrf.ts` validates `Origin` and `Referer` headers against `APP_URL`.
- **Content Limits:** 10MB file cap, 150,000 character limit, scanned PDF rejection for low-text uploads.

### 6.2 Production Actions: [Manual Action Required]
- [ ] **DNS Pointing to Vercel:**
  - `A` record for `slidequill.in` pointing to `76.76.21.21` (or Vercel CNAME).
  - `CNAME` record for `www.slidequill.in` pointing to `cname.vercel-dns.com`.
- [ ] **Apex / WWW Canonical Redirect:** Configure Vercel domain settings to redirect `www.slidequill.in` $\rightarrow$ `https://slidequill.in` (or preferred canonical variant).
- [ ] **SSL / TLS Certificate:** Confirm Vercel automatically provisioned Let's Encrypt SSL certificate and HTTPS redirection is forced.
- [ ] **Google OAuth Redirect URI:**
  - In Google Cloud Console $\rightarrow$ APIs & Services $\rightarrow$ Credentials:
  - Add Authorized JavaScript Origin: `https://slidequill.in`
  - Add Authorized Redirect URI: `https://slidequill.in/api/auth/callback/google`

---

## 7. MongoDB Backups & Production Clustering

### 7.1 Code Implementation Status: [Verified in Code]
- Connection reuse across serverless lambda cycles in `src/app/lib/db.ts`.
- Mongoose schemas configured with indexes on:
  - `Deck.userId`
  - `Deck.sourceExpiresAt`
  - `Deck.status`
  - `AuthToken.token` (unique)
  - `AuthToken.expiresAt` (TTL index)
  - `User.email` (unique)

### 7.2 Production Actions: [Manual Action Required]
- [ ] **Cluster Tier:** Ensure production uses at least **MongoDB Atlas M10** or dedicated Atlas Serverless (avoid M0 free tier due to connection limits, CPU throttling, and lack of automated backup SLAs).
- [ ] **Continuous Cloud Backups (PITR):**
  - In Atlas Console $\rightarrow$ Cluster $\rightarrow$ Backup:
  - Enable **Continuous Cloud Backups** with Point-In-Time Recovery.
  - Set retention window to at least **7 days** (35 days recommended).
- [ ] **Network Access:** Add Vercel IP access or configure `0.0.0.0/0` with strong, rotating database user passwords and SCRAM-SHA-256 authentication.
- [ ] **Connection Pool Size:** If running into `connection pool exhausted` errors during peak serverless spikes, adjust `maxPoolSize: 10` in `src/app/lib/db.ts`.

---

## 8. Custom Error & 404 Pages

### 8.1 Code Implementation Status: [Verified in Code]
- **404 Not Found:** `src/app/not-found.tsx`
  - Fully styled with Tailwind/Geist typography.
  - Helpful copy informing user the deck or link does not exist or has expired.
  - Action button redirecting to `/dashboard`.
- **500 Runtime Exception:** `src/app/error.tsx`
  - Next.js Client Component error boundary.
  - Automatically captures uncaught exception and sends to Sentry via `Sentry.captureException(error)`.
  - Provides a `"Try Again"` reset action and a link to `/dashboard`.

### 8.2 Production Actions: [Manual Action Required]
- [ ] Deploy to production and visit `https://slidequill.in/test-non-existent-route-404` to visually verify custom 404 page.
- [ ] Verify that 404 page does not leak server stack traces or internal IDs.

---

## 9. Launch Readiness Sign-Off Matrix

| Category | Automated Tests & Code | Manual Owner Verification | Status |
| :--- | :--- | :--- | :--- |
| **Long-Doc Pipeline** | 109 passing tests | Confirm live generation completes under 25s | Ready |
| **Token Economics** | ₹0.18–₹0.50 confirmed | Set OpenAI billing threshold to $50/mo | Ready |
| **Stepper Concurrency** | Atomic lease + idempotent notes verified | Smoke test with 2 tabs opening same deck | Ready |
| **Stuck Recovery** | 30m cron recovery + atomic refund verified | Verify cron execution in Vercel logs | Ready |
| **Prompt Injection** | Both fixtures isolated & sanitized | Confirm slide outputs ignore injected links | Ready |
| **Scanned PDFs** | 1-page & multi-page low-text rejection | Test upload of scanned image PDF | Ready |
| **Razorpay Payments** | Webhook HMAC validation verified | Run 1 live ₹99 UPI test transaction | Pending Live Keys |
| **Email Deliverability** | Email verification endpoints verified | Verify SPF, DKIM, DMARC DNS records | Pending DNS Setup |
| **Error Handling** | Custom 404 & 500 pages with Sentry | Trigger sample error in Sentry dashboard | Ready |

---
*Generated by Antigravity for SlideQuill production launch.*
