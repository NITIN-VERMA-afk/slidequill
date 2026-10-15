/**
 * src/lib/openai.ts
 * Singleton OpenAI client — validated at import time.
 */
import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY || "dummy-key-for-build";
export const openai = new OpenAI({ apiKey });

export const OUTLINE_MODEL = process.env.OUTLINE_MODEL ?? "gpt-4o-mini";
