/**
 * Builders for raw webhook deliveries (Kick-Event-Type header + JSON body),
 * mirroring what KICK's servers would POST to a webhook receiver. The engine
 * ingests ONLY deliveries, so every mock event round-trips through
 * `parseWebhookEvent` exactly like production traffic will.
 */

import type {
  ChannelFollowedEvent,
  ChannelSubscriptionGiftsEvent,
  ChannelSubscriptionNewEvent,
  ChatMessageEvent,
  ChatMessageReply,
  KicksGiftedEvent,
  WebhookDelivery,
} from "@/lib/kick/events";
import type { KickEmote, KickUser, KickWebhookUser } from "@/lib/kick/types";

import { EMOTES, STREAMER, type EmoteName } from "./cast";

const DAY_MS = 86_400_000;

/**
 * Appends `[emote:id:name]` tokens to `text` and computes the docs' inclusive
 * `{s, e}` character positions for each emote occurrence.
 */
export function withEmotes(
  text: string,
  emoteNames: readonly EmoteName[],
): { content: string; emotes: KickEmote[] } {
  let content = text;
  const emotes: KickEmote[] = [];
  for (const name of emoteNames) {
    const emote = EMOTES[name];
    const token = `[emote:${emote.emote_id}:${emote.name}]`;
    const start = content.length === 0 ? 0 : content.length + 1;
    content = content.length === 0 ? token : `${content} ${token}`;
    const position = { s: start, e: start + token.length - 1 };
    const existing = emotes.find((entry) => entry.emote_id === emote.emote_id);
    if (existing) existing.positions.push(position);
    else emotes.push({ emote_id: emote.emote_id, positions: [position] });
  }
  return { content, emotes };
}

export interface ChatMessageInput {
  sender: KickUser;
  text: string;
  emoteNames?: readonly EmoteName[];
  replies_to?: ChatMessageReply | null;
  message_id?: string;
}

export function chatMessageDelivery(
  input: ChatMessageInput,
  now: Date,
): WebhookDelivery {
  const { content, emotes } = withEmotes(input.text, input.emoteNames ?? []);
  const body: ChatMessageEvent = {
    message_id: input.message_id ?? crypto.randomUUID(),
    broadcaster: STREAMER,
    sender: input.sender,
    content,
    emotes,
    created_at: now.toISOString(),
    ...(input.replies_to !== undefined ? { replies_to: input.replies_to } : {}),
  };
  return { eventType: "chat.message.sent", eventVersion: 1, body };
}

export function channelFollowedDelivery(
  follower: KickUser,
): WebhookDelivery {
  const body: ChannelFollowedEvent = { broadcaster: STREAMER, follower };
  return { eventType: "channel.followed", eventVersion: 1, body };
}

export function subscriptionNewDelivery(
  subscriber: KickUser,
  now: Date,
): WebhookDelivery {
  const body: ChannelSubscriptionNewEvent = {
    broadcaster: STREAMER,
    subscriber,
    duration: 1,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 30 * DAY_MS).toISOString(),
  };
  return { eventType: "channel.subscription.new", eventVersion: 1, body };
}

export function subscriptionGiftsDelivery(
  gifter: KickUser,
  giftees: KickUser[],
  now: Date,
): WebhookDelivery {
  const body: ChannelSubscriptionGiftsEvent = {
    broadcaster: STREAMER,
    gifter,
    giftees,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 30 * DAY_MS).toISOString(),
  };
  return { eventType: "channel.subscription.gifts", eventVersion: 1, body };
}

/** kicks.gifted carries the reduced webhook user shape (no identity). */
function toWebhookUser(user: KickUser): KickWebhookUser {
  return {
    user_id: user.user_id,
    username: user.username,
    is_verified: user.is_verified,
    profile_picture: user.profile_picture,
    channel_slug: user.channel_slug,
  };
}

export interface KicksGiftInput {
  sender: KickUser;
  amount: number;
  name: string;
  message: string;
}

export function kicksGiftedDelivery(
  input: KicksGiftInput,
  now: Date,
): WebhookDelivery {
  const body: KicksGiftedEvent = {
    broadcaster: toWebhookUser(STREAMER),
    sender: toWebhookUser(input.sender),
    gift: {
      amount: input.amount,
      name: input.name,
      type: "LEVEL_UP",
      tier: "MID",
      message: input.message,
      pinned_time_seconds: 600,
    },
    created_at: now.toISOString(),
  };
  return { eventType: "kicks.gifted", eventVersion: 1, body };
}
