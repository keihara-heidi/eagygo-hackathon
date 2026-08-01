import { NextRequest, NextResponse } from "next/server";

import {
  authCookieOptions,
  getKickAuthConfig,
  KICK_OAUTH_STATE_COOKIE,
  KICK_OAUTH_VERIFIER_COOKIE,
  KICK_SESSION_COOKIE,
  sealKickSession,
} from "@/lib/auth/session";
import { createKickClient } from "@/lib/kick/client";
import { createOAuthClient } from "@/lib/kick/oauth";

function clearOAuthCookies(response: NextResponse) {
  const expiredCookie = authCookieOptions(0);
  response.cookies.set(KICK_OAUTH_STATE_COOKIE, "", expiredCookie);
  response.cookies.set(KICK_OAUTH_VERIFIER_COOKIE, "", expiredCookie);
}

function redirectToLogin(request: NextRequest, error: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  const response = NextResponse.redirect(url);
  clearOAuthCookies(response);
  return response;
}

export async function GET(request: NextRequest) {
  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) {
    return redirectToLogin(
      request,
      providerError === "access_denied" ? "access_denied" : "oauth_failed",
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(KICK_OAUTH_STATE_COOKIE)?.value;
  const codeVerifier = request.cookies.get(KICK_OAUTH_VERIFIER_COOKIE)?.value;
  if (!code || !state || !expectedState || state !== expectedState || !codeVerifier) {
    return redirectToLogin(request, "invalid_callback");
  }

  try {
    const config = getKickAuthConfig();
    const tokens = await createOAuthClient({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    }).exchangeCode({
      code,
      redirectUri: config.redirectUri,
      codeVerifier,
    });
    const [user] = await createKickClient({ token: tokens.access_token }).users.list();
    if (!user) return redirectToLogin(request, "oauth_failed");

    const session = await sealKickSession(tokens, user);
    const response = NextResponse.redirect(new URL("/", request.url), 303);
    response.cookies.set(
      KICK_SESSION_COOKIE,
      session.value,
      authCookieOptions(session.maxAge),
    );
    clearOAuthCookies(response);
    return response;
  } catch (error) {
    console.error("KICK OAuth callback failed", error);
    return redirectToLogin(request, "oauth_failed");
  }
}
