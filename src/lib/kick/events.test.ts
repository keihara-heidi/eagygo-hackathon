import { describe, expect, it } from "vitest";

import { isKickEventType, parseWebhookEvent } from "./events";

// Fixtures copied verbatim from https://docs.kick.com/events/event-types —
// the brief requires mocks to reflect real KICK data, so tests pin the shapes.

const CHAT_MESSAGE_SENT_BODY = {
  message_id: "unique_message_id_123",
  replies_to: {
    message_id: "unique_message_id_456",
    content: "This is the parent message!",
    sender: {
      is_anonymous: false,
      user_id: 12345,
      username: "parent_sender_name",
      is_verified: false,
      profile_picture: "https://example.com/parent_sender_avatar.jpg",
      channel_slug: "parent_sender_channel",
      identity: null,
    },
  },
  broadcaster: {
    is_anonymous: false,
    user_id: 123456789,
    username: "broadcaster_name",
    is_verified: true,
    profile_picture: "https://example.com/broadcaster_avatar.jpg",
    channel_slug: "broadcaster_channel",
    identity: null,
  },
  sender: {
    is_anonymous: false,
    user_id: 987654321,
    username: "sender_name",
    is_verified: false,
    profile_picture: "https://example.com/sender_avatar.jpg",
    channel_slug: "sender_channel",
    identity: {
      username_color: "#FF5733",
      badges: [
      { text: "Moderator", type: "moderator" },
      { text: "Sub Gifter", type: "sub_gifter", count: 5 },
      { text: "Subscriber", type: "subscriber", count: 3 },
      ],
    },
  },
  content: "Hello [emote:4148074:HYPERCLAP] [emote:4148074:HYPERCLAP] [emote:37226:KEKW]",
  emotes: [
    { emote_id: "4148074", positions: [{ s: 6, e: 30 }, { s: 32, e: 56 }] },
    { emote_id: "37226", positions: [{ s: 58, e: 75 }] },
  ],
  created_at: "2025-01-14T16:08:06Z",
};

const KICKS_GIFTED_BODY = {
  broadcaster: {
    user_id: 123456789,
    username: "broadcaster_name",
    is_verified: true,
    profile_picture: "https://example.com/broadcaster_avatar.jpg",
    channel_slug: "broadcaster_channel",
  },
  sender: {
    user_id: 987654321,
    username: "gift_sender",
    is_verified: false,
    profile_picture: "https://example.com/sender_avatar.jpg",
    channel_slug: "gift_sender_channel",
  },
  gift: {
    amount: 500,
    name: "Rage Quit",
    type: "LEVEL_UP",
    tier: "MID",
    message: "w",
    pinned_time_seconds: 600,
  },
  created_at: "2025-10-20T04:00:08.634Z",
};

describe("parseWebhookEvent", () => {
  it("parses chat.message.sent with emotes, badges, and reply intact", () => {
    const event = parseWebhookEvent({
      eventType: "chat.message.sent",
      eventVersion: 1,
      body: CHAT_MESSAGE_SENT_BODY,
    });

    expect(event.type).toBe("chat.message.sent");
    expect(event.version).toBe(1);
    if (event.type !== "chat.message.sent") throw new Error("unreachable");
    expect(event.payload.sender.identity?.badges).toHaveLength(3);
    expect(event.payload.emotes[0]!.positions).toHaveLength(2);
    expect(event.payload.replies_to?.sender.username).toBe("parent_sender_name");
  });

  it("parses kicks.gifted with gift details", () => {
    const event = parseWebhookEvent({ eventType: "kicks.gifted", body: KICKS_GIFTED_BODY });

    if (event.type !== "kicks.gifted") throw new Error("unreachable");
    expect(event.payload.gift.pinned_time_seconds).toBe(600);
    expect(event.version).toBe(1);
  });

  it("throws on unknown event types", () => {
    expect(() => parseWebhookEvent({ eventType: "chat.message.deleted", body: {} })).toThrow(
      "Unknown Kick event type: chat.message.deleted",
    );
  });
});

describe("isKickEventType", () => {
  it("accepts documented types and rejects others", () => {
    expect(isKickEventType("chat.message.sent")).toBe(true);
    expect(isKickEventType("channel.reward.redemption.updated")).toBe(true);
    expect(isKickEventType("chat.message.sent.v2")).toBe(false);
  });
});
