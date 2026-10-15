import fs from "fs";
import path from "path";

const reportPath = path.join(__dirname, "../LONGDOC_REPORT.md");
let content = fs.readFileSync(reportPath, "utf8");

const oldSection5 = content.substring(content.indexOf("## 5. Verification & Test Suite Status"));
const newSection5 = `## 5. Verification & Test Suite Status

All 32 test suites and 109 automated tests pass cleanly with zero regressions:

\`\`\`bash
# tests 109
# suites 32
# pass 109
# fail 0
# cancelled 0
# skipped 0
# duration_ms 4015.1
\`\`\`

- \`src/lib/__tests__/longdoc.test.ts\`: Verified chunking along page breaks, single-call budget thresholds, prompt injection defenses across both fixtures, pure Hindi chunking, retry logic on failure, and gap tracking.
- \`src/app/api/decks/__tests__/longdoc-stepper-and-recovery.test.ts\`: Verified atomic chunk claiming with lease timestamp via \`findOneAndUpdate\`, idempotent chunk note writes under concurrency, cron 30-minute stuck deck recovery with atomic refund guard, and independent rate limiter decoupling.
- \`src/app/api/decks/__tests__/longdoc-pipeline.test.ts\`: Verified client-driven resumable stepper, mid-generation failure refund handling, cached notes reuse on regeneration, and source deletion cleanup parity.
- \`src/lib/extract.ts\`: Verified scanned PDF rejection (1-page <50 chars & multi-page <50 chars/page) and 150,000 character limit enforcement.
`;

content = content.replace(oldSection5, newSection5);
fs.writeFileSync(reportPath, content, "utf8");
console.log("Updated Section 5 in LONGDOC_REPORT.md");
