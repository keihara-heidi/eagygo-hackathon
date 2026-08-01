import { describe, expect, it } from "vitest";

import { stubFetch } from "@/lib/kick/test-fetch";
import type { RecordedCall } from "@/lib/kick/test-fetch";

import { connectKickChannel, disconnectKickChannel, isValidKickSlug } from "./kick-connect";

const DEPS = { clientId: "client-id", clientSecret: "client-secret" };

const CHANNEL = {
  active_subscribers_count: 10,
  banner_picture: "https://example.com/banner.jpg",
  broadcaster_user_id: 987654,
  canceled_subscribers_count: 0,
  category: { id: 1, name: "Just Chatting", thumbnail: "https://example.com/cat.jpg" },
  channel_description: "desc",
  slug: "orbitfps",
  stream: {
    custom_tags: [],
    is_live: true,
    is_mature: false,
    key: "key",
    language: "en",
    start_time: "2025-01-01T00:00:00Z",
    thumbnail: "https://example.com/thumb.jpg",
    url: "https://kick.com/orbitfps",
    viewer_count: 123,
  },
  stream_title: "Ranked grind",
};

const EXISTING_SUBSCRIPTION = {
  app_id: "app-1",
  broadcaster_user_id: 111,
  created_at: "2025-01-01T00:00:00Z",
  event: "chat.message.sent",
  id: "old-sub-1",
  method: "webhook",
  updated_at: "2025-01-01T00:00:00Z",
  version: 1,
};

function connectHandler(overrides?: {
  channels?: unknown[];
  existing?: unknown[];
  createResults?: unknown[];
}) {
  return (call: RecordedCall): { status: number; body?: unknown } => {
    const method = call.init.method ?? "GET";
    if (call.url.includes("id.kick.com/oauth/token")) {
      return { status: 200, body: { access_token: "app-token", token_type: "Bearer", expires_in: 3600 } };
    }
    if (call.url.includes("/public/v1/channels") && method === "GET") {
      return { status: 200, body: { data: overrides?.channels ?? [CHANNEL] } };
    }
    if (call.url.includes("/public/v1/events/subscriptions")) {
      if (method === "GET") return { status: 200, body: { data: overrides?.existing ?? [EXISTING_SUBSCRIPTION] } };
      if (method === "DELETE") return { status: 204 };
      return {
        status: 200,
        body: {
          data:
            overrides?.createResults ??
            [{ name: "chat.message.sent", version: 1, subscription_id: "new-sub-1" }],
        },
      };
    }
    return { status: 500, body: { message: `unexpected call: ${method} ${call.url}` } };
  };
}

describe("connectKickChannel", () => {
  it("runs token grant -> channel lookup -> list+delete+create with the right shapes", async () => {
    const { fetchImpl, calls } = stubFetch(connectHandler());

    const result = await connectKickChannel("orbitfps", { ...DEPS, fetch: fetchImpl });

    expect(result).toMatchObject({
      ok: true,
      broadcaster_user_id: 987654,
      channel: {
        slug: "orbitfps",
        stream_title: "Ranked grind",
        category: "Just Chatting",
        is_live: true,
        viewer_count: 123,
        started_at: "2025-01-01T00:00:00Z",
      },
    });

    const [token, lookup, list, del, create] = calls;
    expect(token?.url).toBe("https://id.kick.com/oauth/token");
    expect(token?.init.body).toContain("grant_type=client_credentials");
    expect(lookup?.url).toBe("https://api.kick.com/public/v1/channels?slug=orbitfps");
    expect(lookup?.init.headers?.Authorization).toBe("Bearer app-token");
    expect(list?.url).toBe("https://api.kick.com/public/v1/events/subscriptions");
    expect(del?.init.method).toBe("DELETE");
    expect(del?.url).toContain("id=old-sub-1");
    expect(create?.init.method).toBe("POST");
    const createBody = JSON.parse(create?.init.body ?? "{}") as {
      broadcaster_user_id: number;
      method: string;
      events: Array<{ name: string; version: number }>;
    };
    expect(createBody.broadcaster_user_id).toBe(987654);
    expect(createBody.method).toBe("webhook");
    expect(createBody.events).toHaveLength(10);
    expect(createBody.events.every((event) => event.version === 1)).toBe(true);
  });

  it("skips the delete call when the app has no existing subscriptions", async () => {
    const { fetchImpl, calls } = stubFetch(connectHandler({ existing: [] }));

    await connectKickChannel("orbitfps", { ...DEPS, fetch: fetchImpl });

    expect(calls.some((call) => call.init.method === "DELETE")).toBe(false);
  });

  it("returns 404 with a clear message when the slug does not resolve", async () => {
    const { fetchImpl, calls } = stubFetch(connectHandler({ channels: [] }));

    const result = await connectKickChannel("nobody-here", { ...DEPS, fetch: fetchImpl });

    expect(result).toEqual({
      ok: false,
      status: 404,
      error: 'No Kick channel found for "nobody-here" — check the URL',
    });
    // No subscription mutation happened.
    expect(calls.some((call) => call.url.includes("/events/subscriptions"))).toBe(false);
  });

  it("surfaces per-event errors from the create result array", async () => {
    const { fetchImpl } = stubFetch(
      connectHandler({
        createResults: [
          { name: "chat.message.sent", version: 1, subscription_id: "new-sub-1" },
          { name: "kicks.gifted", version: 1, error: "subscription limit reached" },
        ],
      }),
    );

    const result = await connectKickChannel("orbitfps", { ...DEPS, fetch: fetchImpl });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.subscriptions).toEqual([
        { name: "chat.message.sent", version: 1, subscription_id: "new-sub-1" },
        { name: "kicks.gifted", version: 1, error: "subscription limit reached" },
      ]);
    }
  });

  it("rejects invalid slugs before any network call", async () => {
    const { fetchImpl, calls } = stubFetch(connectHandler());

    const result = await connectKickChannel("bad slug!", { ...DEPS, fetch: fetchImpl });

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(calls).toHaveLength(0);
  });
});

describe("disconnectKickChannel", () => {
  it("deletes all existing subscriptions and reports the count", async () => {
    const { fetchImpl, calls } = stubFetch(connectHandler());

    const result = await disconnectKickChannel({ ...DEPS, fetch: fetchImpl });

    expect(result).toEqual({ deleted: 1 });
    const del = calls.find((call) => call.init.method === "DELETE");
    expect(del?.url).toContain("id=old-sub-1");
  });
});

describe("isValidKickSlug", () => {
  it("matches parseKickStreamLink's slug rules", () => {
    expect(isValidKickSlug("orbitfps")).toBe(true);
    expect(isValidKickSlug("a")).toBe(false);
    expect(isValidKickSlug("has space")).toBe(false);
    expect(isValidKickSlug(42)).toBe(false);
  });
});
