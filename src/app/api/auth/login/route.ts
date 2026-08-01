import { NextRequest, NextResponse } from "next/server";

import {
  authCookieOptions,
  getKickAuthConfig,
  KICK_AUTH_SCOPES,
  KICK_OAUTH_STATE_COOKIE,
  KICK_OAUTH_VERIFIER_COOKIE,
} from "@/lib/auth/session";
import {
  buildAuthorizeUrl,
  generatePkceChallenge,
  generateState,
} from "@/lib/kick/oauth";

const OAUTH_COOKIE_MAX_AGE_SECONDS = 10 * 60;

export async function GET(request: NextRequest) {
  let config;
  try {
    config = getKickAuthConfig();
  } catch {
    return NextResponse.redirect(new URL("/login?error=not_configured", request.url));
  }

  const state = generateState();
  const { codeVerifier, codeChallenge } = await generatePkceChallenge();
  const response = NextResponse.redirect(
    buildAuthorizeUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      scopes: KICK_AUTH_SCOPES,
      state,
      codeChallenge,
    }),
  );
  const cookieOptions = authCookieOptions(OAUTH_COOKIE_MAX_AGE_SECONDS);
  response.cookies.set(KICK_OAUTH_STATE_COOKIE, state, cookieOptions);
  response.cookies.set(KICK_OAUTH_VERIFIER_COOKIE, codeVerifier, cookieOptions);
  return response;
}
