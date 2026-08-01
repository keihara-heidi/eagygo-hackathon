import { NextRequest, NextResponse } from "next/server";

import {
  authCookieOptions,
  KICK_SESSION_COOKIE,
} from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(KICK_SESSION_COOKIE, "", authCookieOptions(0));
  return response;
}
