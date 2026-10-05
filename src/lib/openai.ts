/**
 * src/lib/openai.ts
 * Singleton OpenAI client — validated at import time.
 */
import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error("[openai] OPENAI_API_KEY env var must be set.");
}

export const openai = new OpenAI({ apiKey });

export const OUTLINE_MODEL = process.env.OUTLINE_MODEL ?? "gpt-4o-mini";
