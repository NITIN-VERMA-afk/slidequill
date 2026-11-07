process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-mock-key-12345678901234567890";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";
process.env.APP_URL = "http://localhost:3000";
process.env.GOOGLE_CLIENT_ID = "mock-google-client-id-12345";
process.env.GOOGLE_CLIENT_SECRET = "mock-google-client-secret-67890";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import { GET as googleInitGet } from "../google/route";
import { GET as googleCallbackGet } from "../google/callback/route";
import {
  OAUTH_STATE_COOKIE,
  generateOAuthState,
  verifyOAuthState,
} from "@/lib/cookies";
import User from "@/app/models/User";

describe("Google OAuth CSRF Protection", () => {
  let mongoServer: MongoMemoryServer;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri);
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe("Unit: verifyOAuthState", () => {
    it("returns true for identical valid states", () => {
      const state = generateOAuthState();
      assert.equal(verifyOAuthState(state, state), true);
    });

    it("returns false for mismatched states", () => {
      const state1 = generateOAuthState();
      const state2 = generateOAuthState();
      assert.equal(verifyOAuthState(state1, state2), false);
    });

    it("returns false for different length states without throwing RangeError", () => {
      assert.equal(verifyOAuthState("short", "much_longer_state_string_value"), false);
      assert.equal(verifyOAuthState("much_longer_state_string_value", "short"), false);
    });

    it("returns false for null, undefined, or empty values", () => {
      assert.equal(verifyOAuthState(null, "state"), false);
      assert.equal(verifyOAuthState("state", null), false);
      assert.equal(verifyOAuthState(undefined, "state"), false);
      assert.equal(verifyOAuthState("state", undefined), false);
      assert.equal(verifyOAuthState("", ""), false);
      assert.equal(verifyOAuthState("", "state"), false);
    });
  });

  describe("Initiator: /api/auth/google", () => {
    it("generates a random state, passes it to Google, and sets httpOnly, secure, sameSite=lax 10-min cookie", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/google");
      const res = await googleInitGet(req);

      assert.equal(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location, "Redirect location header must be set");

      const authUrl = new URL(location);
      assert.equal(authUrl.origin, "https://accounts.google.com");
      assert.equal(authUrl.pathname, "/o/oauth2/v2/auth");
      assert.equal(authUrl.searchParams.get("client_id"), process.env.GOOGLE_CLIENT_ID);
      assert.equal(
        authUrl.searchParams.get("redirect_uri"),
        "http://localhost:3000/api/auth/google/callback"
      );
      assert.equal(authUrl.searchParams.get("response_type"), "code");

      const urlState = authUrl.searchParams.get("state");
      assert.ok(urlState, "State parameter must be included in authorization URL");
      assert.ok(urlState.length >= 32, "State must be cryptographically random (>= 32 chars)");

      // Verify cookie
      const cookie = res.cookies.get(OAUTH_STATE_COOKIE);
      assert.ok(cookie, `Cookie ${OAUTH_STATE_COOKIE} must be set`);
      assert.equal(cookie.value, urlState, "Cookie value must match the URL state");
      assert.equal(cookie.httpOnly, true, "Cookie must be httpOnly");
      assert.equal(String(cookie.sameSite).toLowerCase(), "lax", "Cookie sameSite must be lax");
      assert.equal(cookie.maxAge, 600, "Cookie maxAge must be 600 seconds (10 min)");
      assert.equal(cookie.path, "/", "Cookie path must be root");
    });
  });

  describe("Callback: /api/auth/google/callback CSRF Verification", () => {
    it("rejects with redirect to /login?error=oauth_state when state query param is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/google/callback?code=mock_code", {
        headers: {
          cookie: `${OAUTH_STATE_COOKIE}=valid_session_state`,
        },
      });

      const res = await googleCallbackGet(req);
      assert.equal(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location);
      assert.match(location, /\/login\?error=oauth_state/);

      // Verify cookie is cleared
      const cookie = res.cookies.get(OAUTH_STATE_COOKIE);
      assert.ok(cookie?.maxAge === 0 || cookie?.value === "", "oauth_state cookie must be cleared on mismatch");
    });

    it("rejects with redirect to /login?error=oauth_state when oauth_state cookie is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/google/callback?code=mock_code&state=some_state");

      const res = await googleCallbackGet(req);
      assert.equal(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location);
      assert.match(location, /\/login\?error=oauth_state/);

      const cookie = res.cookies.get(OAUTH_STATE_COOKIE);
      assert.ok(cookie?.maxAge === 0 || cookie?.value === "", "oauth_state cookie must be cleared");
    });

    it("rejects with redirect to /login?error=oauth_state when state query param does not match cookie", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/auth/google/callback?code=mock_code&state=attacker_forged_state",
        {
          headers: {
            cookie: `${OAUTH_STATE_COOKIE}=legitimate_client_state`,
          },
        }
      );

      const res = await googleCallbackGet(req);
      assert.equal(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location);
      assert.match(location, /\/login\?error=oauth_state/);

      const cookie = res.cookies.get(OAUTH_STATE_COOKIE);
      assert.ok(cookie?.maxAge === 0 || cookie?.value === "", "oauth_state cookie must be cleared");
    });

    it("accepts valid matching state, clears cookie, and succeeds OAuth flow", async () => {
      const validState = generateOAuthState();

      // Mock global fetch for Google token exchange and userinfo
      const originalFetch = global.fetch;
      global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const urlStr = typeof input === "string" ? input : input.toString();
        if (urlStr.includes("oauth2.googleapis.com/token")) {
          return new Response(
            JSON.stringify({
              access_token: "mock_google_access_token_abc",
              token_type: "Bearer",
              expires_in: 3600,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (urlStr.includes("googleapis.com/oauth2/v3/userinfo")) {
          return new Response(
            JSON.stringify({
              sub: "google_user_unique_id_999",
              email: "oauth.verified.user@gmail.com",
              name: "OAuth Verified User",
              email_verified: true,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return originalFetch(input, init);
      };

      try {
        const req = new NextRequest(
          `http://localhost:3000/api/auth/google/callback?code=valid_auth_code_123&state=${validState}`,
          {
            headers: {
              cookie: `${OAUTH_STATE_COOKIE}=${validState}`,
            },
          }
        );

        const res = await googleCallbackGet(req);
        assert.equal(res.status, 307);
        const location = res.headers.get("location");
        assert.ok(location);
        assert.match(location, /\/dashboard/);

        // State cookie must be cleared on success
        const stateCookie = res.cookies.get(OAUTH_STATE_COOKIE);
        assert.ok(
          stateCookie?.maxAge === 0 || stateCookie?.value === "",
          "oauth_state cookie must be cleared after successful verification"
        );

        // Session cookies must be established
        const accessCookie = res.cookies.get("sq_at");
        const refreshCookie = res.cookies.get("sq_rt");
        assert.ok(accessCookie?.value, "sq_at access token cookie must be set");
        assert.ok(refreshCookie?.value, "sq_rt refresh token cookie must be set");

        // User must be created in DB with emailVerified true
        const user = await User.findOne({ email: "oauth.verified.user@gmail.com" });
        assert.ok(user, "User must be created in database");
        assert.equal(user.googleId, "google_user_unique_id_999");
        assert.equal(user.emailVerified, true);
        assert.equal(user.credits, 3);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
