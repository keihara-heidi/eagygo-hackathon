import { describe, expect, it } from "vitest";

// Avoids a @types/node dependency just to read two env vars in this file.
declare const process: { env: Record<string, string | undefined> };

import { KickApiError } from "./http";
import type { FetchLike } from "./http";
import {
  buildAuthorizeUrl,
  computeCodeChallenge,
  createOAuthClient,
  generatePkceChallenge,
} from "./oauth";
import { stubFetch } from "./test-fetch";

const oauth = (fetchImpl: FetchLike) =>
  createOAuthClient({ clientId: "cid", clientSecret: "secret", fetch: fetchImpl });

describe("PKCE", () => {
  it("computes the RFC 7636 Appendix B test vector", async () => {
    const challenge = await computeCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("generates a verifier/challenge pair that round-trips", async () => {
    const { codeVerifier, codeChallenge, codeChallengeMethod } = await generatePkceChallenge();

    expect(codeVerifier).toMatch(/^[A-Za-z0-9\-_]{43}$/);
    expect(codeChallengeMethod).toBe("S256");
    expect(await computeCodeChallenge(codeVerifier)).toBe(codeChallenge);
  });
});

describe("buildAuthorizeUrl", () => {
  it("builds the documented authorize URL", () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: "cid",
        redirectUri: "http://localhost/callback",
        scopes: ["chat:write", "events:subscribe"],
        state: "state-1",
        codeChallenge: "challenge-1",
      }),
    );

    expect(url.origin).toBe("https://id.kick.com");
    expect(url.pathname).toBe("/oauth/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost/callback");
    expect(url.searchParams.get("scope")).toBe("chat:write events:subscribe");
    expect(url.searchParams.get("state")).toBe("state-1");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-1");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
});

describe("token endpoint", () => {
  const tokenBody = {
    access_token: "at",
    token_type: "Bearer",
    expires_in: 7200,
    refresh_token: "rt",
    scope: "chat:write",
  };

  it("exchangeCode posts the documented authorization_code form", async () => {
    const { fetchImpl, calls } = stubFetch(() => ({ status: 200, body: tokenBody }));

    const token = await oauth(fetchImpl).exchangeCode({
      code: "code-1",
      redirectUri: "http://localhost/callback",
      codeVerifier: "verifier-1",
    });

    expect(token.access_token).toBe("at");
    expect(calls[0]!.url).toBe("https://id.kick.com/oauth/token");
    expect(calls[0]!.init.headers?.["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const form = new URLSearchParams(calls[0]!.init.body);
    expect(Object.fromEntries(form)).toEqual({
      grant_type: "authorization_code",
      client_id: "cid",
      client_secret: "secret",
      redirect_uri: "http://localhost/callback",
      code_verifier: "verifier-1",
      code: "code-1",
    });
  });

  it("refresh posts grant_type=refresh_token", async () => {
    const { fetchImpl, calls } = stubFetch(() => ({ status: 200, body: tokenBody }));

    await oauth(fetchImpl).refresh("rt-1");

    const form = new URLSearchParams(calls[0]!.init.body);
    expect(form.get("grant_type")).toBe("refresh_token");
    expect(form.get("refresh_token")).toBe("rt-1");
  });

  it("clientCredentials posts grant_type=client_credentials", async () => {
    const { fetchImpl, calls } = stubFetch(() => ({ status: 200, body: tokenBody }));

    await oauth(fetchImpl).clientCredentials();

    const form = new URLSearchParams(calls[0]!.init.body);
    expect(form.get("grant_type")).toBe("client_credentials");
    expect(form.get("refresh_token")).toBeNull();
  });

  it("non-2xx throws KickApiError with the docs' error field", async () => {
    const { fetchImpl } = stubFetch(() => ({ status: 400, body: { error: "Invalid request" } }));

    const err = await oauth(fetchImpl)
      .clientCredentials()
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(KickApiError);
    expect((err as KickApiError).message).toBe("Invalid request");
  });
});

// Live integration test: runs only when real app credentials are provided.
// KICK_CLIENT_ID=... KICK_CLIENT_SECRET=... pnpm test
const LIVE_CREDS = {
  clientId: process.env.KICK_CLIENT_ID,
  clientSecret: process.env.KICK_CLIENT_SECRET,
};

describe.skipIf(!LIVE_CREDS.clientId || !LIVE_CREDS.clientSecret)("live OAuth", () => {
  it("client_credentials grant returns an app access token from id.kick.com", async () => {
    const client = createOAuthClient({
      clientId: LIVE_CREDS.clientId!,
      clientSecret: LIVE_CREDS.clientSecret!,
    });

    const token = await client.clientCredentials();

    expect(token.access_token.length).toBeGreaterThan(0);
    expect(token.token_type).toBe("Bearer");
  }, 15000);
});
