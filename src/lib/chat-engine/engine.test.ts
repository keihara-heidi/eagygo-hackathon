import { describe, expect, it } from "vitest";

import type { KickLivestream } from "@/lib/kick/types";

import { CAST, SIDEKICK_BOT, STREAMER } from "./cast";
import { channelFollowedDelivery, chatMessageDelivery } from "./deliveries";
import { createChatEngine } from "./engine";
import { expectChatMessage, expectRoundTrip } from "./test-helpers";
import type { StampedEvent } from "./types";

function testClock(startIso = "2026-08-01T02:00:00.000Z") {
  let nowMs = Date.parse(startIso);
  return {
    clock: () => new Date(nowMs),
    advance: (ms: number) => {
      nowMs += ms;
    },
  };
}

function firstCastUser() {
  const member = CAST[0];
  if (!member) throw new Error("empty cast");
  return member.user;
}

// Docs-verbatim webhook body (per https://docs.kick.com/events/event-types),
// fed raw to prove publish accepts real wire payloads, not just our builders.
const RAW_FOLLOW_BODY = {
  broadcaster: {
    is_anonymous: false,
    user_id: 123456789,
    username: "broadcaster_name",
    is_verified: true,
    profile_picture: "https://example.com/broadcaster_avatar.jpg",
    channel_slug: "broadcaster_channel",
    identity: null,
  },
  follower: {
    is_anonymous: false,
    user_id: 987654321,
    username: "follower_name",
    is_verified: false,
    profile_picture: "https://example.com/follower_avatar.jpg",
    channel_slug: "follower_channel",
    identity: null,
  },
};

describe("publish", () => {
  it("stamps events with contiguous seqs and the injected clock", () => {
    const { clock, advance } = testClock();
    const engine = createChatEngine({ clock });

    const first = engine.publish({
      eventType: "channel.followed",
      eventVersion: 1,
      body: RAW_FOLLOW_BODY,
    });
    advance(1_000);
    const second = engine.publish(
      chatMessageDelivery({ sender: firstCastUser(), text: "hello" }, clock()),
    );

    expect(first.seq).toBe(1);
    expect(first.received_at).toBe("2026-08-01T02:00:00.000Z");
    expect(first.event.type).toBe("channel.followed");
    expect(second.seq).toBe(2);
    expect(second.received_at).toBe("2026-08-01T02:00:01.000Z");
    expect(engine.getRecent(0)).toEqual([first, second]);
    expectRoundTrip(first);
    expectRoundTrip(second);
  });

  it("throws on unknown event types without consuming a seq", () => {
    const { clock } = testClock();
    const engine = createChatEngine({ clock });

    engine.publish(channelFollowedDelivery(firstCastUser()));
    expect(() =>
      engine.publish({ eventType: "chat.message.deleted", body: {} }),
    ).toThrow("Unknown Kick event type: chat.message.deleted");
    const after = engine.publish(channelFollowedDelivery(firstCastUser()));

    expect(after.seq).toBe(2);
    expect(engine.getRecent(0).map((e) => e.seq)).toEqual([1, 2]);
  });

  it("keeps at most 2000 events but never reuses seqs", () => {
    const { clock } = testClock();
    const engine = createChatEngine({ clock });
    const user = firstCastUser();

    for (let i = 0; i < 2_005; i += 1) {
      engine.publish(channelFollowedDelivery(user));
    }

    const all = engine.getRecent(0);
    expect(all).toHaveLength(2_000);
    expect(all[0]?.seq).toBe(6);
    expect(all[all.length - 1]?.seq).toBe(2_005);
  });
});

describe("getRecent", () => {
  it("returns the last 50 events by default and everything after afterSeq", () => {
    const { clock } = testClock();
    const engine = createChatEngine({ clock });
    const user = firstCastUser();

    for (let i = 0; i < 60; i += 1) {
      engine.publish(channelFollowedDelivery(user));
    }

    const recent = engine.getRecent();
    expect(recent).toHaveLength(50);
    expect(recent[0]?.seq).toBe(11);

    expect(engine.getRecent(57).map((e) => e.seq)).toEqual([58, 59, 60]);
    expect(engine.getRecent(60)).toEqual([]);
  });
});

describe("subscribe", () => {
  it("live-only subscribers see only events stamped after subscribing", () => {
    const { clock } = testClock();
    const engine = createChatEngine({ clock });
    const user = firstCastUser();

    engine.publish(channelFollowedDelivery(user));
    const seen: number[] = [];
    const unsubscribe = engine.subscribe((e) => seen.push(e.seq));
    engine.publish(channelFollowedDelivery(user));
    unsubscribe();
    engine.publish(channelFollowedDelivery(user));

    expect(seen).toEqual([2]);
  });

  it("backfills from fromSeq then continues live, exactly once", () => {
    const { clock } = testClock();
    const engine = createChatEngine({ clock });
    const user = firstCastUser();

    for (let i = 0; i < 5; i += 1) {
      engine.publish(channelFollowedDelivery(user));
    }
    const seen: number[] = [];
    engine.subscribe((e) => seen.push(e.seq), { fromSeq: 3 });
    expect(seen).toEqual([3, 4, 5]);

    engine.publish(channelFollowedDelivery(user));
    expect(seen).toEqual([3, 4, 5, 6]);
  });

  it("delivers in seq order to every subscriber when one publishes reentrantly", () => {
    const { clock } = testClock();
    const engine = createChatEngine({ clock });
    const user = firstCastUser();

    // Mirrors the digest bot: reacts to a chat message by posting an event.
    let reacted = false;
    const reactor: number[] = [];
    engine.subscribe((e) => {
      reactor.push(e.seq);
      if (!reacted && e.event.type === "chat.message.sent") {
        reacted = true;
        engine.publish(channelFollowedDelivery(user));
      }
    });
    const witness: number[] = [];
    engine.subscribe((e) => witness.push(e.seq));

    engine.publish(chatMessageDelivery({ sender: user, text: "hello" }, clock()));
    engine.publish(chatMessageDelivery({ sender: user, text: "again" }, clock()));

    expect(witness).toEqual([1, 2, 3]);
    expect(reactor).toEqual([1, 2, 3]);
  });

  it("stays exactly-once when the subscriber publishes during its own backfill", () => {
    const { clock } = testClock();
    const engine = createChatEngine({ clock });
    const user = firstCastUser();

    for (let i = 0; i < 3; i += 1) {
      engine.publish(channelFollowedDelivery(user));
    }

    let published = false;
    const seen: number[] = [];
    engine.subscribe(
      (e) => {
        seen.push(e.seq);
        if (!published) {
          published = true;
          engine.publish(channelFollowedDelivery(user));
        }
      },
      { fromSeq: 1 },
    );

    expect(seen).toEqual([1, 2, 3, 4]);
  });

  it("isolates subscriber errors from publishers and other subscribers", () => {
    const { clock } = testClock();
    const engine = createChatEngine({ clock });
    const user = firstCastUser();

    engine.subscribe(() => {
      throw new Error("boom");
    });
    const seen: number[] = [];
    engine.subscribe((e) => seen.push(e.seq));

    expect(() => engine.publish(channelFollowedDelivery(user))).not.toThrow();
    expect(seen).toEqual([1]);
  });
});

describe("postBotMessage", () => {
  it("loops a docs-verbatim chat.message.sent from the bot back through publish", async () => {
    const { clock } = testClock();
    const engine = createChatEngine({ clock });
    const seen: StampedEvent[] = [];
    engine.subscribe((e) => seen.push(e));

    const stamped = await engine.postBotMessage(
      "8 people have asked about your sensitivity in the last 5 min",
    );

    expect(stamped.seq).toBe(1);
    expect(seen).toEqual([stamped]);
    const payload = expectChatMessage(stamped);
    expect(payload.sender).toEqual(SIDEKICK_BOT);
    expect(payload.broadcaster).toEqual(STREAMER);
    expect(payload.content).toBe(
      "8 people have asked about your sensitivity in the last 5 min",
    );
    expect(payload.emotes).toEqual([]);
    expect(payload.message_id).toBeTruthy();
    expect(payload.created_at).toBe("2026-08-01T02:00:00.000Z");
    expectRoundTrip(stamped);
  });

  it("builds replies_to from the buffered parent message", async () => {
    const { clock } = testClock();
    const engine = createChatEngine({ clock });
    const user = firstCastUser();

    const question = engine.publish(
      chatMessageDelivery({ sender: user, text: "what's your sens?" }, clock()),
    );
    const parentId = expectChatMessage(question).message_id;

    const reply = await engine.postBotMessage("answered on stream: 800 DPI, 0.8", {
      reply_to_message_id: parentId,
    });

    expect(expectChatMessage(reply).replies_to).toEqual({
      message_id: parentId,
      content: "what's your sens?",
      sender: user,
    });
    expectRoundTrip(reply);
  });

  it("posts without replies_to when the parent message is unknown", async () => {
    const { clock } = testClock();
    const engine = createChatEngine({ clock });

    const reply = await engine.postBotMessage("hello chat", {
      reply_to_message_id: "no-such-message",
    });

    expect(expectChatMessage(reply).replies_to).toBeUndefined();
  });
});

describe("getStreamContext", () => {
  it("returns a docs-shaped livestream for the mock broadcaster", () => {
    const { clock } = testClock();
    const engine = createChatEngine({ clock });

    const context: KickLivestream = engine.getStreamContext();

    expect(context.broadcaster_user).toEqual({
      id: STREAMER.user_id,
      profile_picture: STREAMER.profile_picture,
      username: STREAMER.username,
    });
    expect(context.channel).toEqual({ slug: STREAMER.channel_slug });
    expect(context.category.name).toBe("Call of Duty: Warzone");
    expect(context.language_code).toBe("en");
    expect(context.has_mature_content).toBe(false);
    expect(context.viewer_count).toBeGreaterThan(0);
    expect(Array.isArray(context.tags)).toBe(true);
    // Stream "started" 84 minutes before the engine came up.
    expect(context.started_at).toBe("2026-08-01T00:36:00.000Z");
  });
});

describe("persistence tap seam", () => {
  it("a tap subscriber sees every event exactly once — the rows a DB adapter would write", async () => {
    const { clock } = testClock();
    const engine = createChatEngine({ clock });
    const user = firstCastUser();

    interface Row {
      seq: number;
      event_type: string;
    }
    const rows: Row[] = [];
    engine.subscribe(
      (e) => rows.push({ seq: e.seq, event_type: e.event.type }),
      { fromSeq: 1 },
    );

    engine.publish(chatMessageDelivery({ sender: user, text: "one" }, clock()));
    engine.publish(channelFollowedDelivery(user));
    engine.publish(chatMessageDelivery({ sender: user, text: "two" }, clock()));
    await engine.postBotMessage("digest");

    const all = engine.getRecent(0);
    expect(rows).toHaveLength(all.length);
    expect(rows.map((r) => r.seq)).toEqual(all.map((e) => e.seq));
    expect(new Set(rows.map((r) => r.seq)).size).toBe(rows.length);

    // A late tap (adapter attached after the fact) replays identical rows.
    const replayed: Row[] = [];
    engine.subscribe(
      (e) => replayed.push({ seq: e.seq, event_type: e.event.type }),
      { fromSeq: 1 },
    );
    expect(replayed).toEqual(rows);
  });
});
