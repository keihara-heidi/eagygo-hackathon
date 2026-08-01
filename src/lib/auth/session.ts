import "server-only";

import { EncryptJWT, jwtDecrypt, type JWTPayload } from "jose";
import { cookies } from "next/headers";

import type { KickTokenResponse } from "@/lib/kick/oauth";
import type { KickGetUser } from "@/lib/kick/types";

export const KICK_SESSION_COOKIE = "kick_session";
export const KICK_OAUTH_STATE_COOKIE = "kick_oauth_state";
export const KICK_OAUTH_VERIFIER_COOKIE = "kick_oauth_verifier";
export const KICK_AUTH_SCOPES = ["user:read"];

const MAX_SESSION_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface KickAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface KickSession extends JWTPayload {
  user: Pick<KickGetUser, "user_id" | "name" | "profile_picture">;
  access_token: string;
  access_token_expires_at: number;
  scope?: string;
}

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function sessionSecret(): string {
  const secret = requiredEnvironmentVariable("SESSION_SECRET");
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return secret;
}

export function getKickAuthConfig(): KickAuthConfig {
  const redirectUri = requiredEnvironmentVariable("KICK_REDIRECT_URI");
  const protocol = new URL(redirectUri).protocol;
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error("KICK_REDIRECT_URI must use http or https");
  }

  return {
    clientId: requiredEnvironmentVariable("KICK_CLIENT_ID"),
    clientSecret: requiredEnvironmentVariable("KICK_CLIENT_SECRET"),
    redirectUri,
  };
}

export function isKickAuthConfigured(): boolean {
  try {
    getKickAuthConfig();
    sessionSecret();
    return true;
  } catch {
    return false;
  }
}

async function sessionKey(): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(sessionSecret()),
  );
  return new Uint8Array(digest);
}

function isKickSession(value: unknown): value is KickSession {
  if (!value || typeof value !== "object") return false;

  const session = value as Partial<KickSession>;
  return (
    typeof session.user?.user_id === "number" &&
    typeof session.user.name === "string" &&
    typeof session.user.profile_picture === "string" &&
    typeof session.access_token === "string" &&
    typeof session.access_token_expires_at === "number" &&
    (session.scope === undefined || typeof session.scope === "string")
  );
}

export async function sealKickSession(
  tokens: KickTokenResponse,
  user: KickGetUser,
): Promise<{ value: string; maxAge: number }> {
  const now = Math.floor(Date.now() / 1000);
  const maxAge = Math.min(
    Math.max(Math.floor(tokens.expires_in), 60),
    MAX_SESSION_AGE_SECONDS,
  );
  const session: KickSession = {
    user: {
      user_id: user.user_id,
      name: user.name,
      profile_picture: user.profile_picture,
    },
    access_token: tokens.access_token,
    access_token_expires_at: now + maxAge,
    scope: tokens.scope,
  };

  const value = await new EncryptJWT(session)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt(now)
    .setExpirationTime(now + maxAge)
    .encrypt(await sessionKey());

  return { value, maxAge };
}

export async function getKickSession(): Promise<KickSession | null> {
  const value = (await cookies()).get(KICK_SESSION_COOKIE)?.value;
  if (!value) return null;

  try {
    const { payload } = await jwtDecrypt(value, await sessionKey(), {
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
    });
    return isKickSession(payload) ? payload : null;
  } catch {
    return null;
  }
}

export function authCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
