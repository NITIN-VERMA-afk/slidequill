import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeAnalyticsErrorMessage } from "@/lib/analytics";

describe("sanitizeAnalyticsErrorMessage", () => {
  it("never leaks raw prompt or document content into analytics category", () => {
    const errorWithSensitiveContent = new Error(
      "OpenAI call failed for document: 'CONFIDENTIAL FINANCIAL ACQUISITION STRATEGY 2026' with prompt: 'You are a presentation generator...'"
    );

    const sanitized = sanitizeAnalyticsErrorMessage(errorWithSensitiveContent);
    assert.equal(sanitized, "generation_internal_error");
    assert.equal(sanitized.includes("CONFIDENTIAL"), false);
    assert.equal(sanitized.includes("ACQUISITION"), false);
    assert.equal(sanitized.includes("presentation generator"), false);
  });

  it("classifies rate limit errors", () => {
    assert.equal(
      sanitizeAnalyticsErrorMessage(new Error("Rate limit reached: 429 Too Many Requests")),
      "rate_limit_exceeded"
    );
  });

  it("classifies timeout errors", () => {
    assert.equal(
      sanitizeAnalyticsErrorMessage(new Error("Connection aborted: request timeout after 30000ms")),
      "timeout"
    );
  });

  it("classifies parse errors", () => {
    assert.equal(
      sanitizeAnalyticsErrorMessage(new Error("JSON Parse error: Unexpected token <")),
      "parse_error"
    );
  });

  it("classifies validation errors", () => {
    assert.equal(
      sanitizeAnalyticsErrorMessage(new Error("Zod validation failed on slides array")),
      "validation_error"
    );
  });

  it("classifies quota errors", () => {
    assert.equal(
      sanitizeAnalyticsErrorMessage(new Error("insufficient_quota: You exceeded your current quota")),
      "quota_exceeded"
    );
  });

  it("classifies authentication errors", () => {
    assert.equal(
      sanitizeAnalyticsErrorMessage(new Error("401 Unauthorized API key")),
      "auth_error"
    );
  });

  it("classifies network connection errors", () => {
    assert.equal(
      sanitizeAnalyticsErrorMessage(new Error("connect ECONNREFUSED 127.0.0.1:443")),
      "network_error"
    );
  });

  it("handles null, undefined, or empty values safely", () => {
    assert.equal(sanitizeAnalyticsErrorMessage(null), "unknown_error");
    assert.equal(sanitizeAnalyticsErrorMessage(undefined), "unknown_error");
    assert.equal(sanitizeAnalyticsErrorMessage(""), "unknown_error");
  });
});
