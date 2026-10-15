/**
 * src/lib/extract.ts
 * Extract plain text from PDF (via unpdf) or DOCX (via mammoth).
 * Preserves page boundaries and real page counts for PDFs.
 * Never logs the extracted content.
 */
import { fileTypeFromBuffer } from "file-type";

export const MAX_TEXT_CHARS = 150_000;

export type ExtractResult =
  | {
      ok: true;
      text: string;
      mime: string;
      pageCount?: number;
    }
  | { ok: false; error: string };

/**
 * Determine file type via magic bytes (not Content-Type / extension).
 * Returns the mime string or null if unrecognised.
 */
export async function detectMime(buf: Uint8Array): Promise<string | null> {
  const result = await fileTypeFromBuffer(buf);
  return result?.mime ?? null;
}

/**
 * Extract text from a PDF buffer using unpdf while retaining page boundaries.
 * Returns formatted text with page markers and total page count.
 */
async function extractPdf(buf: Uint8Array): Promise<{ text: string; pageCount: number }> {
  const { extractText } = await import("unpdf");
  const result = await extractText(buf, { mergePages: false });
  const pageTexts: string[] = Array.isArray(result.text) ? result.text : [result.text || ""];
  const pageCount = result.totalPages || pageTexts.length;

  const formattedPages = pageTexts
    .map((pageStr, idx) => {
      const clean = pageStr.trim();
      return clean.length > 0 ? `--- [Page ${idx + 1}] ---\n${clean}` : "";
    })
    .filter((chunk) => chunk.length > 0);

  return {
    text: formattedPages.join("\n\n"),
    pageCount,
  };
}

/** Extract text from a DOCX buffer using mammoth. */
async function extractDocx(buf: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: buf });
  return result.value ?? "";
}

/**
 * Given a raw file buffer, detect its type, extract text and enforce limits.
 */
export async function extractText(buf: Buffer): Promise<ExtractResult> {
  const mime = await detectMime(buf);

  if (mime === "application/pdf") {
    let pdfData: { text: string; pageCount: number };
    try {
      pdfData = await extractPdf(new Uint8Array(buf));
    } catch {
      return { ok: false, error: "Could not read the PDF file." };
    }
    const text = pdfData.text.trim();
    if (!text) {
      return {
        ok: false,
        error:
          "No readable text found. This looks like a scanned PDF. Please export it with selectable text or use an OCR tool.",
      };
    }
    // Detect scanned/image-only PDFs (1 page < 50 chars, or >= 2 pages averaging < 50 chars per page)
    if ((pdfData.pageCount === 1 && text.length < 50) || (pdfData.pageCount >= 2 && text.length / pdfData.pageCount < 50)) {
      console.warn(
        `[Extract] Scanned/image-only PDF rejected: pageCount=${pdfData.pageCount}, charCount=${text.length}`
      );
      return {
        ok: false,
        error:
          "This PDF appears to be scanned or image-based with very little readable text (less than 50 characters per page). Please use an OCR tool or upload a text-based document.",
      };
    }
    if (text.length > MAX_TEXT_CHARS) {
      return {
        ok: false,
        error:
          "Document exceeds maximum supported size of 150,000 characters (approx. 50–60 pages). Please upload a shorter document or extract relevant chapters.",
      };
    }
    return {
      ok: true,
      text,
      mime,
      pageCount: pdfData.pageCount,
    };
  }

  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    let raw: string;
    try {
      raw = await extractDocx(buf);
    } catch {
      return { ok: false, error: "Could not read the DOCX file." };
    }
    const text = raw.trim();
    if (!text) {
      return { ok: false, error: "The DOCX file appears to be empty." };
    }
    if (text.length > MAX_TEXT_CHARS) {
      return {
        ok: false,
        error:
          "Document exceeds maximum supported size of 150,000 characters (approx. 50–60 pages). Please upload a shorter document or extract relevant chapters.",
      };
    }
    return {
      ok: true,
      text,
      mime,
      pageCount: undefined, // Non-PDF formats do not have verified physical page boundaries
    };
  }


  if (!mime) {
    return {
      ok: false,
      error: "Could not detect file type. Please upload a PDF or DOCX file.",
    };
  }

  return {
    ok: false,
    error: `File type "${mime}" is not supported. Please upload a PDF or DOCX.`,
  };
}
