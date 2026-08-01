/**
 * Webhook event payloads, mirroring https://docs.kick.com/events/event-types.
 *
 * `parseWebhookEvent` turns a raw webhook delivery (Kick-Event-Type header +
 * JSON body) into the discriminated `KickEvent` union. The switch is
 * exhaustive: adding a new event to `KickEventPayloadMap` without handling it
 * here is a compile error.
 */

import type {
  KickCategory,
  KickEmote,
  KickRedemptionStatus,
  KickUser,
  KickWebhookUser,
} from "./types";

export interface ChatMessageReply {
  message_id: string;
  content: string;
  sender: KickUser;
}

export interface ChatMessageEvent {
  message_id: string;
  replies_to?: ChatMessageReply | null;
  broadcaster: KickUser;
  sender: KickUser;
  content: string;
  emotes: KickEmote[];
  created_at: string;
}

export interface ChannelFollowedEvent {
  broadcaster: KickUser;
  follower: KickUser;
}

export interface ChannelSubscriptionNewEvent {
  broadcaster: KickUser;
  subscriber: KickUser;
  duration: number;
  created_at: string;
  expires_at: string;
}

export type ChannelSubscriptionRenewalEvent = ChannelSubscriptionNewEvent;

export interface ChannelSubscriptionGiftsEvent {
  broadcaster: KickUser;
  gifter: KickUser;
  giftees: KickUser[];
  created_at: string;
  expires_at: string;
}

export interface ChannelRewardRedemptionUpdatedEvent {
  id: string;
  user_input: string;
  status: KickRedemptionStatus;
  redeemed_at: string;
  reward: {
    id: string;
    title: string;
    cost: number;
    description: string;
  };
  redeemer: KickWebhookUser;
  broadcaster: KickWebhookUser;
}

export interface LivestreamStatusUpdatedEvent {
  broadcaster: KickUser;
  is_live: boolean;
  title: string;
  started_at: string;
  ended_at: string | null;
}

export interface LivestreamMetadataUpdatedEvent {
  broadcaster: KickUser;
  metadata: {
    title: string;
    language: string;
    has_mature_content: boolean;
    category: KickCategory;
  };
}

export interface ModerationBannedEvent {
  broadcaster: KickUser;
  moderator: KickUser;
  banned_user: KickUser;
  metadata: {
    reason: string;
    created_at: string;
    expires_at: string | null;
  };
}

export interface KicksGiftedEvent {
  broadcaster: KickWebhookUser;
  sender: KickWebhookUser;
  gift: {
    amount: number;
    name: string;
    type: string;
    tier: string;
    message: string;
    pinned_time_seconds: number;
  };
  created_at: string;
}

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

export interface KickEventPayloadMap {
  "chat.message.sent": ChatMessageEvent;
  "channel.followed": ChannelFollowedEvent;
  "channel.subscription.new": ChannelSubscriptionNewEvent;
  "channel.subscription.renewal": ChannelSubscriptionRenewalEvent;
  "channel.subscription.gifts": ChannelSubscriptionGiftsEvent;
  "channel.reward.redemption.updated": ChannelRewardRedemptionUpdatedEvent;
  "livestream.status.updated": LivestreamStatusUpdatedEvent;
  "livestream.metadata.updated": LivestreamMetadataUpdatedEvent;
  "moderation.banned": ModerationBannedEvent;
  "kicks.gifted": KicksGiftedEvent;
}

export type KickEventType = keyof KickEventPayloadMap;

export type KickEvent = {
  [T in KickEventType]: {
    type: T;
    version: number;
    payload: KickEventPayloadMap[T];
  };
}[KickEventType];

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export interface WebhookDelivery {
  /** Value of the Kick-Event-Type header. */
  eventType: string;
  /** Value of the Kick-Event-Version header, if present. */
  eventVersion?: number;
  /** Parsed JSON body. */
  body: unknown;
}

export const KICK_EVENT_TYPES = [
  "chat.message.sent",
  "channel.followed",
  "channel.subscription.new",
  "channel.subscription.renewal",
  "channel.subscription.gifts",
  "channel.reward.redemption.updated",
  "livestream.status.updated",
  "livestream.metadata.updated",
  "moderation.banned",
  "kicks.gifted",
] as const satisfies readonly KickEventType[];

// Compile-time completeness: adding a key to KickEventPayloadMap without
// adding it to KICK_EVENT_TYPES (and the parse switch below) fails the build.
type MissingEventType = Exclude<KickEventType, (typeof KICK_EVENT_TYPES)[number]>;
const _assertEventTypeListComplete: [MissingEventType] extends [never] ? true : never = true;
void _assertEventTypeListComplete;

const KICK_EVENT_TYPE_SET: ReadonlySet<string> = new Set(KICK_EVENT_TYPES);

export function isKickEventType(value: string): value is KickEventType {
  return KICK_EVENT_TYPE_SET.has(value);
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Kick event type: ${String(value)}`);
}

export function parseWebhookEvent(delivery: WebhookDelivery): KickEvent {
  const version = delivery.eventVersion ?? 1;
  const { body } = delivery;

  if (!isKickEventType(delivery.eventType)) {
    throw new Error(`Unknown Kick event type: ${delivery.eventType}`);
  }
  const eventType = delivery.eventType;

  switch (eventType) {
    case "chat.message.sent":
      return { type: eventType, version, payload: body as ChatMessageEvent };
    case "channel.followed":
      return { type: eventType, version, payload: body as ChannelFollowedEvent };
    case "channel.subscription.new":
      return { type: eventType, version, payload: body as ChannelSubscriptionNewEvent };
    case "channel.subscription.renewal":
      return { type: eventType, version, payload: body as ChannelSubscriptionRenewalEvent };
    case "channel.subscription.gifts":
      return { type: eventType, version, payload: body as ChannelSubscriptionGiftsEvent };
    case "channel.reward.redemption.updated":
      return { type: eventType, version, payload: body as ChannelRewardRedemptionUpdatedEvent };
    case "livestream.status.updated":
      return { type: eventType, version, payload: body as LivestreamStatusUpdatedEvent };
    case "livestream.metadata.updated":
      return { type: eventType, version, payload: body as LivestreamMetadataUpdatedEvent };
    case "moderation.banned":
      return { type: eventType, version, payload: body as ModerationBannedEvent };
    case "kicks.gifted":
      return { type: eventType, version, payload: body as KicksGiftedEvent };
    default:
      return assertNever(eventType);
  }
}
