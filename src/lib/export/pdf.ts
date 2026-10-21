import fs from "fs";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { isAllowedPdfRequest } from "./pdf-interception";

/**
 * Searches for a system-installed Chromium/Chrome binary for local development environments
 * where AWS Lambda / Vercel @sparticuz/chromium tarballs may not be pre-extracted.
 */
export function findSystemChrome(): string | undefined {
  if (process.env.CHROME_EXECUTABLE_PATH && fs.existsSync(process.env.CHROME_EXECUTABLE_PATH)) {
    return process.env.CHROME_EXECUTABLE_PATH;
  }
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }
  const candidates = [
    // Windows
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    // Linux
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    // macOS
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

export interface RenderPdfOptions {
  deckId: string;
  printToken: string;
  appOrigin: string;
  timeoutMs?: number;
}

/**
 * Renders a presentation into a paginated 16:9 PDF using Puppeteer and @sparticuz/chromium.
 * - Strict SSRF interception via isAllowedPdfRequest.
 * - Waits for theme fonts and images to load before snapshot.
 * - Always closes browser in finally block to avoid orphan processes.
 */
export async function renderDeckToPdf({
  deckId,
  printToken,
  appOrigin,
  timeoutMs = 35000,
}: RenderPdfOptions): Promise<Buffer> {
  let executablePath: string;

  try {
    const sparticuzPath = await chromium.executablePath();
    if (sparticuzPath && fs.existsSync(sparticuzPath)) {
      executablePath = sparticuzPath;
    } else {
      const fallback = findSystemChrome();
      if (!fallback) {
        throw new Error("Chromium binary not found.");
      }
      executablePath = fallback;
    }
  } catch {
    const fallback = findSystemChrome();
    if (!fallback) {
      throw new Error("Chromium executable path could not be resolved.");
    }
    executablePath = fallback;
  }

  // Use chromium.args from @sparticuz/chromium; no --single-process unless proven needed
  const args = [...chromium.args];

  const browser = await puppeteer.launch({
    args,
    defaultViewport: { width: 1920, height: 1080 },
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();

    // Enable request interception for strict SSRF protection
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (isAllowedPdfRequest(url, appOrigin)) {
        req.continue();
      } else {
        req.abort("blockedbyclient");
      }
    });

    const targetUrl = `${appOrigin}/render/deck/${deckId}?token=${encodeURIComponent(printToken)}`;
    await page.goto(targetUrl, {
      waitUntil: "networkidle0",
      timeout: timeoutMs,
    });

    // Wait for fonts and images in the rendered DOM
    await page.evaluate(async () => {
      if (document.fonts && typeof (document.fonts as any).ready === "object") {
        await (document.fonts as any).ready;
      }
      const imgs = Array.from(document.querySelectorAll("img"));
      await Promise.all(
        imgs.map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete) return resolve(true);
              img.onload = () => resolve(true);
              img.onerror = () => resolve(false);
              setTimeout(() => resolve(false), 5000);
            })
        )
      );
    });

    const pdfBuffer = await page.pdf({
      printBackground: true,
      width: "1920px",
      height: "1080px",
      margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
      preferCSSPageSize: true,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close().catch(() => {});
  }
}
