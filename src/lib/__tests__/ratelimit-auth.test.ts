import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeEmail, isDisposableEmail } from "../disposable-emails";
import { getClientIp } from "../ip";
import { NextRequest } from "next/server";

describe("normalizeEmail", () => {
  it("removes periods from Gmail addresses", () => {
    assert.equal(normalizeEmail("john.doe@gmail.com"), "johndoe@gmail.com");
    assert.equal(normalizeEmail("j.o.h.n.d.o.e@gmail.com"), "johndoe@gmail.com");
  });

  it("removes plus aliases from Gmail addresses", () => {
    assert.equal(normalizeEmail("johndoe+promo@gmail.com"), "johndoe@gmail.com");
    assert.equal(normalizeEmail("johndoe+signup123@gmail.com"), "johndoe@gmail.com");
  });

  it("removes both dots and plus aliases simultaneously", () => {
    assert.equal(normalizeEmail("john.doe+testing@gmail.com"), "johndoe@gmail.com");
    assert.equal(normalizeEmail("  J.O.H.N.doe+freebie@GMAIL.COM  "), "johndoe@gmail.com");
  });

  it("normalizes googlemail.com to gmail.com and strips dots", () => {
    assert.equal(normalizeEmail("john.doe@googlemail.com"), "johndoe@gmail.com");
    assert.equal(normalizeEmail("user+test@googlemail.com"), "user@gmail.com");
  });

  it("strips plus alias for standard providers while preserving dots", () => {
    assert.equal(normalizeEmail("jane.smith+filter@outlook.com"), "jane.smith@outlook.com");
    assert.equal(normalizeEmail("developer+staging@company.org"), "developer@company.org");
  });
});

describe("isDisposableEmail", () => {
  it("detects common temporary and disposable email services", () => {
    assert.equal(isDisposableEmail("attacker@mailinator.com"), true);
    assert.equal(isDisposableEmail("bot@yopmail.com"), true);
    assert.equal(isDisposableEmail("fake@tempmail.com"), true);
    assert.equal(isDisposableEmail("scam@10minutemail.com"), true);
    assert.equal(isDisposableEmail("user@sharklasers.com"), true);
    assert.equal(isDisposableEmail("spam@guerrillamail.com"), true);
    assert.equal(isDisposableEmail("test@burnermail.io"), true);
  });

  it("permits standard legitimate domains", () => {
    assert.equal(isDisposableEmail("user@gmail.com"), false);
    assert.equal(isDisposableEmail("person@outlook.com"), false);
    assert.equal(isDisposableEmail("employee@company.co"), false);
    assert.equal(isDisposableEmail("founder@startup.io"), false);
  });

  it("handles empty or malformed strings gracefully", () => {
    assert.equal(isDisposableEmail(""), false);
    assert.equal(isDisposableEmail("invalid-email"), false);
  });
});

describe("getClientIp", () => {
  it("extracts from x-vercel-forwarded-for header first", () => {
    const req = new NextRequest("http://localhost:3000", {
      headers: {
        "x-vercel-forwarded-for": "198.51.100.22",
        "x-forwarded-for": "127.0.0.1",
      },
    });
    assert.equal(getClientIp(req), "198.51.100.22");
  });

  it("extracts from cf-connecting-ip when present", () => {
    const req = new NextRequest("http://localhost:3000", {
      headers: {
        "cf-connecting-ip": "203.0.113.88",
        "x-forwarded-for": "10.0.0.1",
      },
    });
    assert.equal(getClientIp(req), "203.0.113.88");
  });

  it("extracts leftmost client IP from x-forwarded-for list", () => {
    const req = new NextRequest("http://localhost:3000", {
      headers: {
        "x-forwarded-for": "198.51.100.14, 10.0.0.2, 172.16.0.1",
      },
    });
    assert.equal(getClientIp(req), "198.51.100.14");
  });

  it("falls back to 127.0.0.1 on header injection or garbage values", () => {
    const req = new NextRequest("http://localhost:3000", {
      headers: {
        "x-forwarded-for": "not-an-ip; DROP TABLE users;",
      },
    });
    assert.equal(getClientIp(req), "127.0.0.1");
  });
});
