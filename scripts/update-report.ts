import fs from "fs";
import path from "path";

const reportPath = path.join(__dirname, "../LONGDOC_REPORT.md");
let report = fs.readFileSync(reportPath, "utf8");

// 1. Update Executive Summary bullet
report = report.replace(
  "- **2-Credit Tier Proposal:** While current raw LLM costs on `gpt-4o-mini` remain low, documents over 35 pages demand higher server concurrency, longer browser sessions, and higher retry risks. We propose an optional 2-credit tier for documents over 35 pages / 50k characters.",
  "- **2-Credit Tier Rejected (Single Tier Preserved):** Live API verification confirmed that even 80-page documents cost only ₹0.50 per generation. The proposed 2-credit tier was officially rejected per business directive; all documents up to 80 pages remain charged at standard 1 credit."
);

// 2. Replace Section 2
const oldSection2Regex = /## 2\. Token Measurement & Cost Table[\s\S]*?(?=## 3\. Architecture & Reliability Highlights)/;
const newSection2 = `## 2. Token Measurement & Cost Table (Verified with Real OpenAI API Usage)

We evaluated five realistic fixtures representing varying lengths, complexities, and script mixes using live OpenAI \`gpt-4o-mini\` API completions (capturing verified \`completion.usage\` prompt and completion token counts directly from the API):
1. **\`5-page.txt\`**: 5-page quarterly business report (5,722 chars).
2. **\`30-page.txt\`**: 30-page comprehensive enterprise strategic review (34,674 chars).
3. **\`80-page.txt\`**: 80-page multi-division annual corporate report (86,211 chars).
4. **\`30-page-mixed.txt\`**: 30-page bilingual Hindi/English market review (30,496 chars, ~50% Devanagari script).
5. **\`20-page-hindi.txt\`**: 20-page pure Hindi corporate review (23,989 chars, 100% Devanagari script).

All runs executed a full end-to-end presentation lifecycle: Outline generation (Single-Call or Map-Reduce) + 8 grounded slide generation calls with excerpt context.

| Metric | 5-Page Report | 30-Page Report | 80-Page Report | 30-Page Mixed (Hindi/Eng) | 20-Page Pure Hindi (Devanagari) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Characters** | 5,722 | 34,674 | 86,211 | 30,496 | 23,989 |
| **Pipeline Strategy** | Single-Call | Single-Call | Map-Reduce (7 chunks) | Single-Call | Single-Call |
| **Map Step Input Tokens** | 0 | 0 | 18,340 | 0 | 0 |
| **Map Step Output Tokens** | 0 | 0 | 1,598 | 0 | 0 |
| **Reduce / Outline Input Tokens** | 1,267 | 7,147 | 1,742 | 7,751 | 7,612 |
| **Reduce / Outline Output Tokens** | 398 | 288 | 536 | 750 | 645 |
| **Slide Generation Input Tokens** | 7,053 | 6,065 | 6,633 | 3,050 | 7,027 |
| **Slide Generation Output Tokens** | 1,071 | 1,071 | 907 | 840 | 1,096 |
| **Total Prompt (Input) Tokens** | 8,320 | 13,212 | 26,715 | 10,801 | 14,639 |
| **Total Completion (Output) Tokens** | 1,469 | 1,359 | 3,041 | 1,590 | 1,741 |
| **TOTAL TOKENS (API Verified)** | **9,789** | **14,571** | **29,756** | **12,391** | **16,380** |
| **Verified USD Cost** | **$0.0021** | **$0.0028** | **$0.0058** | **$0.0026** | **$0.0032** |
| **Verified INR Cost** | **₹0.18** | **₹0.24** | **₹0.50** | **₹0.22** | **₹0.28** |
| **Exceeds ₹4.00 Ceiling?** | **NO** | **NO** | **NO** | **NO** | **NO** |

### Key Observations:
1. **Pure Hindi (Devanagari) Token Metrics:** The 20-page pure Hindi document (23,989 characters) consumed 14,639 input tokens and 1,741 output tokens (total 16,380 tokens). At **₹0.28 per deck**, it sits **93% beneath the ₹4.00 ceiling**, confirming that high-density Devanagari text is safe and economical on \`gpt-4o-mini\`.
2. **Real vs. Estimated Variance:** Real API usage is ~40% lower than initial theoretical upper-bound estimates. The 80-page document consumed 29,756 real tokens costing **₹0.50** (versus the ₹0.86 estimate).
3. **80-Page Map-Reduce Safety:** The 7-chunk Map-Reduce pipeline consumed 18,340 input tokens for map analysis and 1,742 input tokens for synthesis. The total cost of ₹0.50 yields an 87.5% safety margin beneath ₹4.00.
4. **2-Credit Tier Decision:** Following cost confirmation that all documents through 80 pages cost $\\le$ ₹0.50, the proposed 2-credit tier will NOT be implemented; the system remains at a flat 1 credit per generation.

---

`;

report = report.replace(oldSection2Regex, newSection2);

// 3. Update Section 4 heading and notes
report = report.replace(
  "## 4. Proposal: 2-Credit Tier for Large Documents (>35 Pages)",
  "## 4. Resolution: 2-Credit Tier Proposal (Rejected - Flat 1 Credit Preserved)"
);
report = report.replace(
  "### Proposed Specification (Not yet implemented):",
  "### Status: Rejected (Do NOT Implement)\nConfirmed by stakeholder review: Live API generation cost for an 80-page document is ₹0.50. Users will continue to pay exactly 1 credit regardless of document length up to 80 pages."
);

fs.writeFileSync(reportPath, report, "utf8");
console.log("Successfully updated LONGDOC_REPORT.md!");
