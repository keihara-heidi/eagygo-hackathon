import { describe, expect, it } from "vitest";

import { createKickClient, KickApiError } from "./client";
import type { FetchLike } from "./client";

interface RecordedCall {
  url: string;
  init: { method?: string; headers?: Record<string, string>; body?: string };
}

function stubFetch(
  handler: (call: RecordedCall) => { status: number; body?: unknown },
): { fetchImpl: FetchLike; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetchImpl: FetchLike = async (input, init = {}) => {
    const call: RecordedCall = { url: input, init };
    calls.push(call);
    const { status, body } = handler(call);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    };
  };
  return { fetchImpl, calls };
}

const client = (fetchImpl: FetchLike) => createKickClient({ token: "test-token", fetch: fetchImpl });

describe("chat", () => {
  it("send posts to /public/v1/chat with auth and unwraps the envelope", async () => {
    const { fetchImpl, calls } = stubFetch(() => ({
      status: 200,
      body: { data: { is_sent: true, message_id: "msg-1" }, message: "OK" },
    }));

    const result = await client(fetchImpl).chat.send({
      content: "Pog",
      type: "bot",
      reply_to_message_id: "parent-1",
    });

    expect(result).toEqual({ is_sent: true, message_id: "msg-1" });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.kick.com/public/v1/chat");
    expect(calls[0]!.init.method).toBe("POST");
    expect(calls[0]!.init.headers?.Authorization).toBe("Bearer test-token");
    expect(JSON.parse(calls[0]!.init.body!)).toEqual({
      content: "Pog",
      type: "bot",
      reply_to_message_id: "parent-1",
    });
  });

  it("delete hits /public/v1/chat/{message_id} and tolerates 204", async () => {
    const { fetchImpl, calls } = stubFetch(() => ({ status: 204 }));

    await expect(client(fetchImpl).chat.delete("msg 1")).resolves.toBeUndefined();
    expect(calls[0]!.url).toBe("https://api.kick.com/public/v1/chat/msg%201");
    expect(calls[0]!.init.method).toBe("DELETE");
  });
});

describe("channels", () => {
  it("list repeats slug query params (collectionFormat multi)", async () => {
    const { fetchImpl, calls } = stubFetch(() => ({ status: 200, body: { data: [], message: "OK" } }));

    await client(fetchImpl).channels.list({ slug: ["alice", "bob"] });

    const url = new URL(calls[0]!.url);
    expect(url.searchParams.getAll("slug")).toEqual(["alice", "bob"]);
  });

  it("update patches stream metadata", async () => {
    const { fetchImpl, calls } = stubFetch(() => ({ status: 204 }));

    await client(fetchImpl).channels.update({ stream_title: "Chat is popping off" });

    expect(calls[0]!.init.method).toBe("PATCH");
    expect(JSON.parse(calls[0]!.init.body!)).toEqual({ stream_title: "Chat is popping off" });
  });
});

describe("rewards", () => {
  it("redemptions unwraps paginated envelope with next cursor", async () => {
    const { fetchImpl } = stubFetch(() => ({
      status: 200,
      body: {
        data: [{ reward: { id: "r1", title: "Unban" }, redemptions: [] }],
        message: "OK",
        pagination: { next_cursor: "cursor-2" },
      },
    }));

    const page = await client(fetchImpl).rewards.redemptions({ status: "pending" });

    expect(page.nextCursor).toBe("cursor-2");
    expect(page.data).toHaveLength(1);
  });

  it("acceptRedemptions posts ids and returns failures", async () => {
    const { fetchImpl, calls } = stubFetch(() => ({
      status: 200,
      body: { data: [{ id: "r1", reason: "NOT_OWNED" }], message: "OK" },
    }));

    const failed = await client(fetchImpl).rewards.acceptRedemptions(["r1"]);

    expect(failed).toEqual([{ id: "r1", reason: "NOT_OWNED" }]);
    expect(calls[0]!.url).toBe("https://api.kick.com/public/v1/channels/rewards/redemptions/accept");
    expect(JSON.parse(calls[0]!.init.body!)).toEqual({ ids: ["r1"] });
  });
});

describe("errors", () => {
  it("non-2xx throws KickApiError with status and API message", async () => {
    const { fetchImpl } = stubFetch(() => ({ status: 401, body: { message: "Unauthorized" } }));

    const err = await client(fetchImpl)
      .chat.send({ content: "hi", type: "bot" })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(KickApiError);
    expect((err as KickApiError).status).toBe(401);
    expect((err as KickApiError).message).toBe("Unauthorized");
  });
});

describe("publicKey", () => {
  it("returns the key string", async () => {
    const { fetchImpl } = stubFetch(() => ({
      status: 200,
      body: { data: { public_key: "-----BEGIN PUBLIC KEY-----" }, message: "OK" },
    }));

    await expect(client(fetchImpl).publicKey()).resolves.toBe("-----BEGIN PUBLIC KEY-----");
  });
});
