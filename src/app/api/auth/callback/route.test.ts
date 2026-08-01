import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchangeCode: vi.fn(async () => ({ access_token: "access-token" })),
  listUsers: vi.fn(async () => [{ user_id: 42, name: "viewer", profile_picture: "avatar" }]),
}));

vi.mock("@/lib/auth/session", () => ({
  authCookieOptions: (maxAge: number) => ({ maxAge, path: "/" }),
  getKickAuthConfig: () => ({
    clientId: "client-id",
    clientSecret: "client-secret",
    redirectUri: "http://localhost:3000/api/auth/callback",
  }),
  KICK_OAUTH_STATE_COOKIE: "kick_oauth_state",
  KICK_OAUTH_VERIFIER_COOKIE: "kick_oauth_verifier",
  KICK_SESSION_COOKIE: "kick_session",
  sealKickSession: async () => ({ value: "sealed-session", maxAge: 3_600 }),
}));

vi.mock("@/lib/kick/client", () => ({
  createKickClient: () => ({ users: { list: mocks.listUsers } }),
}));

vi.mock("@/lib/kick/oauth", () => ({
  createOAuthClient: () => ({ exchangeCode: mocks.exchangeCode }),
}));

import { GET } from "./route";

describe("KICK OAuth callback", () => {
  it("redirects successful authentication to chat", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/auth/callback?code=code&state=state",
      {
        headers: {
          cookie: "kick_oauth_state=state; kick_oauth_verifier=verifier",
        },
      },
    );

    const response = await GET(request);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/chat");
    expect(response.cookies.get("kick_session")?.value).toBe("sealed-session");
  });
});
