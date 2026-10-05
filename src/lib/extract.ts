/**
 * src/lib/extract.ts
 * Extract plain text from PDF (via unpdf) or DOCX (via mammoth).
 * Never logs the extracted content.
 */
import { fileTypeFromBuffer } from "file-type";

const MAX_TEXT_CHARS = 50_000;

export type ExtractResult =
  | { ok: true; text: string; mime: string }
  | { ok: false; error: string };

/**
 * Determine file type via magic bytes (not Content-Type / extension).
 * Returns the mime string or null if unrecognised.
 */
export async function detectMime(buf: Uint8Array): Promise<string | null> {
  const result = await fileTypeFromBuffer(buf);
  return result?.mime ?? null;
}

/** Extract text from a PDF buffer using unpdf. */
async function extractPdf(buf: Uint8Array): Promise<string> {
  const { extractText } = await import("unpdf");
  const { text } = await extractText(buf, { mergePages: true });
  return text ?? "";
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
    let raw: string;
    try {
      raw = await extractPdf(new Uint8Array(buf));
    } catch {
      return { ok: false, error: "Could not read the PDF file." };
    }
    const text = raw.trim();
    if (!text) {
      return {
        ok: false,
        error:
          "No readable text found. This looks like a scanned PDF. Please export it with selectable text.",
      };
    }
    return { ok: true, text: text.slice(0, MAX_TEXT_CHARS), mime };
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
    return { ok: true, text: text.slice(0, MAX_TEXT_CHARS), mime };
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
