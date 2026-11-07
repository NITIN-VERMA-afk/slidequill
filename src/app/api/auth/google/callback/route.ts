import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import User from "@/app/models/User";
import Session from "@/app/models/Session";
import { signAccessToken } from "@/lib/auth";
import {
  generateRefreshToken,
  hashToken,
  setAuthCookies,
  verifyOAuthState,
  clearOAuthStateCookie,
  OAUTH_STATE_COOKIE,
} from "@/lib/cookies";

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state");
  const storedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (!verifyOAuthState(state, storedState)) {
    const res = NextResponse.redirect(new URL("/login?error=oauth_state", req.url));
    clearOAuthStateCookie(res.cookies);
    return res;
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    const res = NextResponse.redirect(new URL("/login?error=Google authentication failed", req.url));
    clearOAuthStateCookie(res.cookies);
    return res;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  let baseUrl = process.env.APP_URL;
  if (!baseUrl || (process.env.NODE_ENV === "production" && baseUrl.includes("localhost"))) {
    baseUrl = req.nextUrl.origin;
  }
  const redirectUri = new URL("/api/auth/google/callback", baseUrl).toString();

  if (!clientId || !clientSecret) {
    const res = NextResponse.json(
      { error: "Google OAuth is not configured. Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET." },
      { status: 500 }
    );
    clearOAuthStateCookie(res.cookies);
    return res;
  }

  try {
    // Exchange code for token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error("Google token error:", tokenData);
      const res = NextResponse.redirect(new URL("/login?error=Failed to retrieve access token from Google", req.url));
      clearOAuthStateCookie(res.cookies);
      return res;
    }

    // Get user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    
    const userData = await userRes.json();
    if (!userData.email) {
      const res = NextResponse.redirect(new URL("/login?error=Google account has no email associated", req.url));
      clearOAuthStateCookie(res.cookies);
      return res;
    }

    await connectDB();

    let user = await User.findOne({ email: userData.email.toLowerCase() });

    if (user) {
      // If user exists but doesn't have Google ID, link it
      if (!user.googleId) {
        user.googleId = userData.sub;
        if (!user.authProvider) user.authProvider = "google";
        user.emailVerified = true;
        await user.save();
      }
    } else {
      // Create new user
      user = await User.create({
        email: userData.email.toLowerCase(),
        name: userData.name || "User",
        googleId: userData.sub,
        authProvider: "google",
        emailVerified: userData.email_verified === true,
      });
    }

    // Issue tokens
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    
    const [accessToken, rawRefresh] = await Promise.all([
      signAccessToken(user._id.toString(), user.role),
      Promise.resolve(generateRefreshToken()),
    ]);

    await Session.create({
      userId: user._id,
      tokenHash: hashToken(rawRefresh),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userAgent: req.headers.get("user-agent") ?? "",
      ip,
    });

    const res = NextResponse.redirect(new URL("/dashboard", req.url));
    setAuthCookies(res.cookies, accessToken, rawRefresh);
    clearOAuthStateCookie(res.cookies);
    return res;

  } catch (error) {
    console.error("Google callback error:", error);
    const res = NextResponse.redirect(new URL("/login?error=An unexpected error occurred during Google Sign-In", req.url));
    clearOAuthStateCookie(res.cookies);
    return res;
  }
}
