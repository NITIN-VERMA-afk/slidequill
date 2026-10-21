import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isValidObjectId, isValidSlideId } from "../validation";

describe("Input Validation: isValidObjectId & isValidSlideId", () => {
  it("accepts valid 24-character hexadecimal MongoDB ObjectIds", () => {
    assert.equal(isValidObjectId("507f1f77bcf86cd799439011"), true);
    assert.equal(isValidObjectId("65a12b3c4d5e6f7a8b9c0d1e"), true);
    assert.equal(isValidObjectId("000000000000000000000000"), true);
    assert.equal(isValidObjectId("ffffffffffffffffffffffff"), true);
    assert.equal(isValidObjectId({ toString: () => "507f1f77bcf86cd799439011" }), true);
  });

  it("rejects non-hex, malformed, or wrong-length ObjectIds", () => {
    assert.equal(isValidObjectId(""), false);
    assert.equal(isValidObjectId("123"), false);
    assert.equal(isValidObjectId("not-a-valid-id"), false);
    assert.equal(isValidObjectId("507f1f77bcf86cd79943901"), false); // 23 chars
    assert.equal(isValidObjectId("507f1f77bcf86cd7994390111"), false); // 25 chars
    assert.equal(isValidObjectId("507f1f77bcf86cd79943901z"), false); // 'z' not hex
    assert.equal(isValidObjectId(null), false);
    assert.equal(isValidObjectId(undefined), false);
    assert.equal(isValidObjectId(12345), false);
    assert.equal(isValidObjectId({}), false);
  });

  it("accepts valid slide IDs (UUIDs, ObjectIds, and slide-slugs)", () => {
    assert.equal(isValidSlideId("507f1f77bcf86cd799439011"), true);
    assert.equal(isValidSlideId("f47ac10b-58cc-4372-a567-0e02b2c3d479"), true);
    assert.equal(isValidSlideId("slide-1"), true);
    assert.equal(isValidSlideId("slide-stats-1"), true);
    assert.equal(isValidSlideId("slide-b"), true);
  });

  it("rejects invalid slide IDs", () => {
    assert.equal(isValidSlideId(""), false);
    assert.equal(isValidSlideId("   "), false);
    assert.equal(isValidSlideId("slide with spaces"), false);
    assert.equal(isValidSlideId("slide<script>"), false);
    assert.equal(isValidSlideId(null), false);
    assert.equal(isValidSlideId(undefined), false);
  });
});
