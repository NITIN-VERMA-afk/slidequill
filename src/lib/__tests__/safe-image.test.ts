import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isDisallowedIp,
  detectImageMagicBytes,
  resolveAndValidateHostname,
  fetchSafeImage,
  fetchSafeImageStrict,
  validateImageUrlServerSide,
  BUNDLED_PLACEHOLDER_DATA_URL,
} from "../safe-image-fetcher";

describe("isDisallowedIp", () => {
  it("blocks IPv4 loopback (127.0.0.0/8)", () => {
    assert.equal(isDisallowedIp("127.0.0.1"), true);
    assert.equal(isDisallowedIp("127.0.0.53"), true);
    assert.equal(isDisallowedIp("127.255.255.255"), true);
  });

  it("blocks AWS/GCP/Azure cloud metadata and link-local (169.254.0.0/16)", () => {
    assert.equal(isDisallowedIp("169.254.169.254"), true);
    assert.equal(isDisallowedIp("169.254.1.1"), true);
  });

  it("blocks RFC 1918 private IPv4 ranges", () => {
    // 10.0.0.0/8
    assert.equal(isDisallowedIp("10.0.0.1"), true);
    assert.equal(isDisallowedIp("10.255.255.255"), true);
    // 172.16.0.0/12
    assert.equal(isDisallowedIp("172.16.0.1"), true);
    assert.equal(isDisallowedIp("172.31.255.255"), true);
    // 192.168.0.0/16
    assert.equal(isDisallowedIp("192.168.1.1"), true);
    assert.equal(isDisallowedIp("192.168.0.254"), true);
  });

  it("blocks 0.0.0.0/8, CGNAT, multicast, and broadcast", () => {
    assert.equal(isDisallowedIp("0.0.0.0"), true);
    assert.equal(isDisallowedIp("100.64.0.1"), true);
    assert.equal(isDisallowedIp("224.0.0.1"), true);
    assert.equal(isDisallowedIp("240.0.0.1"), true);
    assert.equal(isDisallowedIp("255.255.255.255"), true);
  });

  it("blocks IPv6 loopback, link-local, unique local, and multicast", () => {
    assert.equal(isDisallowedIp("::1"), true);
    assert.equal(isDisallowedIp("fe80::1"), true);
    assert.equal(isDisallowedIp("fc00::1"), true);
    assert.equal(isDisallowedIp("fd00::1"), true);
    assert.equal(isDisallowedIp("ff02::1"), true);
  });

  it("blocks IPv4-mapped IPv6 addresses for private destinations", () => {
    assert.equal(isDisallowedIp("::ffff:127.0.0.1"), true);
    assert.equal(isDisallowedIp("::ffff:169.254.169.254"), true);
    assert.equal(isDisallowedIp("::ffff:10.0.0.1"), true);
    assert.equal(isDisallowedIp("::ffff:192.168.1.1"), true);
  });

  it("permits public IPv4 and IPv6 addresses", () => {
    assert.equal(isDisallowedIp("8.8.8.8"), false);
    assert.equal(isDisallowedIp("1.1.1.1"), false);
    assert.equal(isDisallowedIp("93.184.216.34"), false);
    assert.equal(isDisallowedIp("2606:4700:4700::1111"), false);
  });
});

describe("detectImageMagicBytes", () => {
  it("recognizes valid JPEG headers", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    assert.equal(detectImageMagicBytes(jpeg), "image/jpeg");
  });

  it("recognizes valid PNG headers", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    assert.equal(detectImageMagicBytes(png), "image/png");
  });

  it("recognizes valid WebP headers", () => {
    const webp = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.from([0x20, 0x00, 0x00, 0x00]),
      Buffer.from("WEBP"),
    ]);
    assert.equal(detectImageMagicBytes(webp), "image/webp");
  });

  it("strictly rejects SVG and XML payloads", () => {
    const svg1 = Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100\" height=\"100\"><circle/></svg>");
    const svg2 = Buffer.from("<?xml version=\"1.0\" encoding=\"UTF-8\"?><svg viewBox=\"0 0 10 10\"></svg>");
    assert.equal(detectImageMagicBytes(svg1), null);
    assert.equal(detectImageMagicBytes(svg2), null);
  });

  it("rejects HTML or arbitrary text", () => {
    const html = Buffer.from("<!DOCTYPE html><html><body><h1>Title</h1></body></html>");
    assert.equal(detectImageMagicBytes(html), null);
  });
});

describe("resolveAndValidateHostname", () => {
  it("rejects localhost and local domain patterns", async () => {
    await assert.rejects(async () => {
      await resolveAndValidateHostname("localhost");
    }, /Disallowed hostname/);

    await assert.rejects(async () => {
      await resolveAndValidateHostname("app.localhost");
    }, /Disallowed hostname/);

    await assert.rejects(async () => {
      await resolveAndValidateHostname("server.local");
    }, /Disallowed hostname/);

    await assert.rejects(async () => {
      await resolveAndValidateHostname("metadata.google.internal");
    }, /Disallowed hostname/);
  });

  it("rejects direct private IP literals", async () => {
    await assert.rejects(async () => {
      await resolveAndValidateHostname("127.0.0.1");
    }, /Disallowed IP/);

    await assert.rejects(async () => {
      await resolveAndValidateHostname("169.254.169.254");
    }, /Disallowed IP/);
  });
});

describe("fetchSafeImageStrict", () => {
  it("rejects non-HTTPS protocols (http, file, ftp)", async () => {
    await assert.rejects(async () => {
      await fetchSafeImageStrict("http://example.com/image.png");
    }, /Only HTTPS is allowed/);

    await assert.rejects(async () => {
      await fetchSafeImageStrict("file:///etc/passwd");
    }, /Only HTTPS is allowed/);

    await assert.rejects(async () => {
      await fetchSafeImageStrict("ftp://example.com/image.png");
    }, /Only HTTPS is allowed/);
  });

  it("rejects requests targeting loopback or private hostnames", async () => {
    await assert.rejects(async () => {
      await fetchSafeImageStrict("https://localhost/image.png");
    }, /Disallowed hostname/);

    await assert.rejects(async () => {
      await fetchSafeImageStrict("https://127.0.0.1:8080/image.png");
    }, /Disallowed IP/);

    await assert.rejects(async () => {
      await fetchSafeImageStrict("https://169.254.169.254/latest/meta-data/");
    }, /Disallowed IP/);
  });
});

describe("fetchSafeImage resilient fallback", () => {
  it("never throws when given null or empty URL and returns placeholder", async () => {
    const res = await fetchSafeImage("");
    assert.equal(res.isPlaceholder, true);
    assert.equal(res.dataUrl, BUNDLED_PLACEHOLDER_DATA_URL);
    assert.equal(res.contentType, "image/png");
  });

  it("never throws on SSRF blocked URLs and returns placeholder", async () => {
    const res = await fetchSafeImage("https://169.254.169.254/secret.jpg");
    assert.equal(res.isPlaceholder, true);
    assert.equal(res.dataUrl, BUNDLED_PLACEHOLDER_DATA_URL);
  });

  it("never throws on non-HTTPS URL and returns placeholder", async () => {
    const res = await fetchSafeImage("http://images.unsplash.com/photo-123.jpg");
    assert.equal(res.isPlaceholder, true);
    assert.equal(res.dataUrl, BUNDLED_PLACEHOLDER_DATA_URL);
  });
});

describe("validateImageUrlServerSide", () => {
  it("rejects non-https URLs", async () => {
    const res = await validateImageUrlServerSide("http://images.unsplash.com/test.jpg");
    assert.equal(res.valid, false);
    assert.match(res.error || "", /HTTPS/);
  });

  it("rejects loopback/metadata IPs", async () => {
    const res1 = await validateImageUrlServerSide("https://127.0.0.1/test.png");
    assert.equal(res1.valid, false);

    const res2 = await validateImageUrlServerSide("https://169.254.169.254/test.png");
    assert.equal(res2.valid, false);
  });

  it("rejects localhost and local hostnames", async () => {
    const res = await validateImageUrlServerSide("https://localhost/test.png");
    assert.equal(res.valid, false);
  });
});

describe("SSRF Redirect & Spoofed Content-Type Protections", () => {
  it("rejects redirect location pointing to private IP (e.g. 169.254.169.254)", async () => {
    // Testing validation when redirect Location header targets private IP
    const targetRedirectUrl = new URL("https://169.254.169.254/secret-meta-data");
    await assert.rejects(async () => {
      await resolveAndValidateHostname(targetRedirectUrl.hostname);
    }, /Disallowed IP/);
  });

  it("rejects redirect location pointing to loopback or local hostnames", async () => {
    const targetRedirectUrl = new URL("https://metadata.google.internal/computeMetadata/v1/");
    await assert.rejects(async () => {
      await resolveAndValidateHostname(targetRedirectUrl.hostname);
    }, /Disallowed hostname/);
  });

  it("strictly rejects spoofed Content-Type where payload is HTML or SVG", () => {
    // Server sends Content-Type: image/jpeg or image/png, but payload is malicious SVG/HTML
    const spoofedSvg = Buffer.from("<svg onload='alert(1)'>fake jpeg</svg>");
    assert.equal(detectImageMagicBytes(spoofedSvg), null);

    const spoofedHtml = Buffer.from("<!DOCTYPE html><html><body>fake png</body></html>");
    assert.equal(detectImageMagicBytes(spoofedHtml), null);

    const spoofedBinary = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
    assert.equal(detectImageMagicBytes(spoofedBinary), null);
  });
});

