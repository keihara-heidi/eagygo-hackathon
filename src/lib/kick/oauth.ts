/**
 * KICK OAuth 2.1 flow, mirroring
 * https://docs.kick.com/getting-started/generating-tokens-oauth2-flow.
 *
 * The OAuth server lives at id.kick.com (not api.kick.com). Covers PKCE
 * generation, the authorize URL, and the three token grants:
 * authorization_code, refresh_token, and client_credentials (app access
 * token). Revoke and introspect are documented but not needed by the
 * prototype — add them here if that changes.
 */

import { defaultFetch, parseResponse } from "./http";
import type { FetchLike } from "./http";

const DEFAULT_OAUTH_BASE_URL = "https://id.kick.com";

// ---------------------------------------------------------------------------
// PKCE (RFC 7636)
// ---------------------------------------------------------------------------

export interface PkceChallenge {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function randomBase64Url(byteLength: number): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export function generateState(byteLength = 16): string {
  return randomBase64Url(byteLength);
}

export async function computeCodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  return base64UrlEncode(new Uint8Array(digest));
}

export async function generatePkceChallenge(): Promise<PkceChallenge> {
  const codeVerifier = randomBase64Url(32);
  return {
    codeVerifier,
    codeChallenge: await computeCodeChallenge(codeVerifier),
    codeChallengeMethod: "S256",
  };
}

// ---------------------------------------------------------------------------
// Authorize URL
// ---------------------------------------------------------------------------

export interface BuildAuthorizeUrlParams {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  codeChallenge: string;
}

export function buildAuthorizeUrl(
  params: BuildAuthorizeUrlParams,
  baseUrl: string = DEFAULT_OAUTH_BASE_URL,
): string {
  const url = new URL("/oauth/authorize", baseUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", params.scopes.join(" "));
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

// ---------------------------------------------------------------------------
// Token endpoint
// ---------------------------------------------------------------------------

export interface KickTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  refresh_expires_in?: number;
  scope?: string;
}

export interface KickOAuthClientOptions {
  clientId: string;
  clientSecret: string;
  fetch?: FetchLike;
  baseUrl?: string;
}

export function createOAuthClient(options: KickOAuthClientOptions) {
  const { clientId, clientSecret, fetch: fetchImpl = defaultFetch, baseUrl = DEFAULT_OAUTH_BASE_URL } =
    options;

  function postToken(form: Record<string, string>): Promise<KickTokenResponse> {
    return fetchImpl(`${baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    }).then((res) => parseResponse<KickTokenResponse>(res));
  }

  return {
    exchangeCode: (params: {
      code: string;
      redirectUri: string;
      codeVerifier: string;
    }): Promise<KickTokenResponse> =>
      postToken({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: params.redirectUri,
        code_verifier: params.codeVerifier,
        code: params.code,
      }),

    refresh: (refreshToken: string): Promise<KickTokenResponse> =>
      postToken({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),

    /** App access token — server-to-server, no user context. */
    clientCredentials: (): Promise<KickTokenResponse> =>
      postToken({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
  };
}

export type KickOAuthClient = ReturnType<typeof createOAuthClient>;
