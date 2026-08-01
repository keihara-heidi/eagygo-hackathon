/**
 * Public contract of the chat engine — the one seam between event producers
 * (mock scenario scripts now, a KICK webhook receiver later) and every
 * consumer (insight engine, SSE stream, bot digest, voice agent).
 */

import type { KickEvent, WebhookDelivery } from "@/lib/kick/events";
import type {
  KickChatMessageResponse,
  KickLivestream,
  PostChatParams,
} from "@/lib/kick/types";

/** A Kick webhook event stamped with a stream-local sequence number. */
export interface StampedEvent {
  /** Monotonically increasing, never reused, starts at 1. */
  seq: number;
  /** ISO timestamp when the engine ingested the event. */
  received_at: string;
  event: KickEvent;
}

export type ChatEngineSubscriber = (event: StampedEvent) => void;

export interface SubscribeOptions {
  /**
   * Backfill buffered events with `seq >= fromSeq` (buffer-bounded), then
   * continue live. Omit to receive only events stamped after subscribing.
   */
  fromSeq?: number;
}

export const DEMO_SCENARIOS = [
  "question_flood",
  "hype_spike",
  "new_viewer",
] as const;

export type DemoScenario = (typeof DEMO_SCENARIOS)[number];

export function isDemoScenario(value: string): value is DemoScenario {
  return (DEMO_SCENARIOS as readonly string[]).includes(value);
}

export interface DemoState {
  running: boolean;
  intensity: number;
  hype_active: boolean;
  head_seq: number;
  buffer_size: number;
  newcomers_spawned: number;
}

export interface DemoControls {
  /** Starts the baseline ambient chat timeline. Idempotent. */
  start(): void;
  /** Stops the baseline and cancels pending scheduled scenario events. */
  stop(): void;
  /** Baseline messages-per-tick probability, clamped to 0.05..1. */
  setIntensity(value: number): void;
  /** Fires a scripted demo scenario. Works whether or not baseline runs. */
  trigger(scenario: DemoScenario): void;
  getState(): DemoState;
}

export interface PostBotMessageOptions {
  /** Message id the bot message replies to (mirrors PostChatParams). */
  reply_to_message_id?: string;
}

export interface ChatEngine {
  /**
   * Sole ingress. Parses the delivery via `parseWebhookEvent` (throws on
   * unknown event types), stamps it, buffers it, and fans it out to
   * subscribers in seq order. Returns the stamped event.
   */
  publish(delivery: WebhookDelivery): StampedEvent;
  /** Backfill-then-live, seq-ordered, exactly-once. Returns unsubscribe. */
  subscribe(fn: ChatEngineSubscriber, options?: SubscribeOptions): () => void;
  /**
   * Buffered events after `afterSeq` (exclusive); without an argument, the
   * most recent 50.
   */
  getRecent(afterSeq?: number): StampedEvent[];
  /**
   * Posts a chat message as the Sidekick bot through the bot-poster adapter;
   * the loopback adapter re-enters `publish` with a docs-verbatim
   * `chat.message.sent`. Resolves with the stamped echo of that message.
   */
  postBotMessage(
    content: string,
    options?: PostBotMessageOptions,
  ): Promise<StampedEvent>;
  /** Docs-shaped livestream context for the mocked stream. */
  getStreamContext(): KickLivestream;
  demo: DemoControls;
}

/**
 * The bot-posting seam, shaped exactly like the real `POST /public/v1/chat`
 * call so a KICK-client-backed implementation can replace the loopback one
 * without touching the engine.
 */
export interface BotPoster {
  post(params: PostChatParams): Promise<KickChatMessageResponse>;
}

/** Injectable sources of nondeterminism — tests pin both. */
export interface ChatEngineDeps {
  clock?: () => Date;
  random?: () => number;
}
