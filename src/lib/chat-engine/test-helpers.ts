/** Shared assertions for chat-engine tests. */

import { expect } from "vitest";

import { parseWebhookEvent, type ChatMessageEvent } from "@/lib/kick/events";

import type { StampedEvent } from "./types";

/** Rebuild a raw delivery from a stamped event and prove it still parses. */
export function expectRoundTrip(stamped: StampedEvent) {
  const reparsed = parseWebhookEvent({
    eventType: stamped.event.type,
    eventVersion: stamped.event.version,
    body: stamped.event.payload,
  });
  expect(reparsed).toEqual(stamped.event);
}

/** Narrows a stamped event to chat.message.sent and returns its payload. */
export function expectChatMessage(stamped: StampedEvent): ChatMessageEvent {
  if (stamped.event.type !== "chat.message.sent") {
    throw new Error(`expected chat.message.sent, got ${stamped.event.type}`);
  }
  return stamped.event.payload;
}
