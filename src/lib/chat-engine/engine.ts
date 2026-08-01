/**
 * The chat engine: a seq-stamped, replayable event bus over docs-faithful
 * KICK webhook deliveries. `publish` is the sole ingress (mock scenarios now,
 * a real webhook receiver later); subscribers get backfill-then-live,
 * seq-ordered, exactly-once delivery.
 */

import {
  parseWebhookEvent,
  type ChatMessageEvent,
  type WebhookDelivery,
} from "@/lib/kick/events";
import type { KickLivestream } from "@/lib/kick/types";

import { createLoopbackBotPoster } from "./bot-poster";
import { STREAMER, STREAM_INFO } from "./cast";
import {
  BASELINE_TICK_MS,
  HYPE_WINDOW_MS,
  buildBaselineTick,
  buildHypeSpike,
  buildNewViewer,
  buildQuestionFlood,
  buildWarmup,
  type ScenarioStep,
} from "./scenarios";
import type {
  BotPoster,
  ChatEngine,
  ChatEngineDeps,
  ChatEngineSubscriber,
  DemoControls,
  DemoScenario,
  DemoState,
  PostBotMessageOptions,
  StampedEvent,
  SubscribeOptions,
} from "./types";

const MAX_BUFFER = 2_000;
const DEFAULT_RECENT_LIMIT = 50;
const DEFAULT_INTENSITY = 0.4;

function assertNever(value: never): never {
  throw new Error(`Unhandled demo scenario: ${String(value)}`);
}

class ChatEngineImpl implements ChatEngine {
  private readonly clock: () => Date;
  private readonly random: () => number;
  private readonly startedAt: Date;
  private readonly botPoster: BotPoster;

  private readonly events: StampedEvent[] = [];
  private headSeq = 0;
  private readonly subscribers = new Set<ChatEngineSubscriber>();
  private readonly dispatchQueue: StampedEvent[] = [];
  private dispatching = false;

  private baselineTimer: ReturnType<typeof setInterval> | null = null;
  private readonly pendingSteps = new Set<ReturnType<typeof setTimeout>>();
  private tickCount = 0;
  private intensity = DEFAULT_INTENSITY;
  private hypeUntil = 0;
  private newcomersSpawned = 0;
  private warmedUp = false;

  constructor(deps: ChatEngineDeps = {}) {
    this.clock = deps.clock ?? (() => new Date());
    this.random = deps.random ?? Math.random;
    this.startedAt = this.clock();
    this.botPoster = createLoopbackBotPoster({
      deliver: (delivery) => void this.publish(delivery),
      lookupMessage: (message_id) => this.findChatMessage(message_id),
      clock: () => this.clock(),
    });
  }

  publish(delivery: WebhookDelivery): StampedEvent {
    const event = parseWebhookEvent(delivery);
    this.headSeq += 1;
    const stamped: StampedEvent = {
      seq: this.headSeq,
      received_at: this.clock().toISOString(),
      event,
    };
    this.events.push(stamped);
    if (this.events.length > MAX_BUFFER) {
      this.events.splice(0, this.events.length - MAX_BUFFER);
    }
    this.dispatchQueue.push(stamped);
    this.drainDispatchQueue();
    return stamped;
  }

  /**
   * Fans queued events out one at a time. Reentrant publishes (a subscriber
   * reacting by publishing, e.g. the digest bot) only append to the queue, so
   * every subscriber still observes strict seq order.
   */
  private drainDispatchQueue() {
    if (this.dispatching) return;
    this.dispatching = true;
    try {
      let next: StampedEvent | undefined;
      while ((next = this.dispatchQueue.shift()) !== undefined) {
        for (const subscriber of this.subscribers) {
          try {
            subscriber(next);
          } catch (error) {
            console.error("[chat-engine] subscriber failed:", error);
          }
        }
      }
    } finally {
      this.dispatching = false;
    }
  }

  subscribe(fn: ChatEngineSubscriber, options?: SubscribeOptions): () => void {
    const fromSeq = options?.fromSeq;
    // The guard makes delivery exactly-once across the backfill/live
    // boundary: anything at or below lastDelivered has already been seen.
    let lastDelivered = fromSeq !== undefined ? fromSeq - 1 : this.headSeq;
    const guarded: ChatEngineSubscriber = (event) => {
      if (event.seq <= lastDelivered) return;
      lastDelivered = event.seq;
      fn(event);
    };

    if (fromSeq !== undefined) {
      // Snapshot: fn may publish reentrantly and grow/trim the buffer.
      for (const event of [...this.events]) guarded(event);
    }
    this.subscribers.add(guarded);
    if (fromSeq !== undefined) {
      // Catch up on events stamped during backfill, before we went live.
      for (const event of this.events) {
        if (event.seq > lastDelivered) guarded(event);
      }
    }

    return () => {
      this.subscribers.delete(guarded);
    };
  }

  getRecent(afterSeq?: number): StampedEvent[] {
    if (afterSeq === undefined) return this.events.slice(-DEFAULT_RECENT_LIMIT);
    return this.events.filter((event) => event.seq > afterSeq);
  }

  async postBotMessage(
    content: string,
    options?: PostBotMessageOptions,
  ): Promise<StampedEvent> {
    const response = await this.botPoster.post({
      content,
      type: "bot",
      broadcaster_user_id: STREAMER.user_id,
      ...(options?.reply_to_message_id !== undefined
        ? { reply_to_message_id: options.reply_to_message_id }
        : {}),
    });
    // The loopback poster echoes synchronously; a real adapter would await
    // the webhook echo the same way — by watching for its message_id.
    const stamped = this.findStampedChatMessage(response.message_id);
    if (!stamped) {
      throw new Error(
        `bot message ${response.message_id} did not echo back into the stream`,
      );
    }
    return stamped;
  }

  getStreamContext(): KickLivestream {
    const startedAt = new Date(
      this.startedAt.getTime() - STREAM_INFO.started_minutes_ago * 60_000,
    );
    return {
      broadcaster_user: {
        id: STREAMER.user_id,
        profile_picture: STREAMER.profile_picture,
        username: STREAMER.username,
      },
      category: { ...STREAM_INFO.category },
      channel: { slug: STREAMER.channel_slug },
      has_mature_content: false,
      id: STREAM_INFO.livestream_id,
      language_code: STREAM_INFO.language_code,
      started_at: startedAt.toISOString(),
      tags: [...STREAM_INFO.tags],
      thumbnail: STREAM_INFO.thumbnail,
      title: STREAM_INFO.title,
      viewer_count: STREAM_INFO.viewer_count,
    };
  }

  readonly demo: DemoControls = {
    start: () => {
      if (this.baselineTimer) return;
      this.warmup();
      this.baselineTimer = setInterval(
        () => this.baselineTick(),
        BASELINE_TICK_MS,
      );
    },
    stop: () => {
      if (this.baselineTimer) clearInterval(this.baselineTimer);
      this.baselineTimer = null;
      for (const handle of this.pendingSteps) clearTimeout(handle);
      this.pendingSteps.clear();
    },
    setIntensity: (value: number) => {
      this.intensity = Math.min(1, Math.max(0.05, value));
    },
    trigger: (scenario: DemoScenario) => {
      switch (scenario) {
        case "question_flood":
          this.schedule(buildQuestionFlood(this.random));
          break;
        case "hype_spike":
          this.hypeUntil = this.clock().getTime() + HYPE_WINDOW_MS;
          this.schedule(buildHypeSpike(this.random));
          break;
        case "new_viewer":
          this.schedule(buildNewViewer(this.newcomersSpawned));
          this.newcomersSpawned += 1;
          break;
        default:
          assertNever(scenario);
      }
    },
    getState: (): DemoState => ({
      running: this.baselineTimer !== null,
      intensity: this.intensity,
      hype_active: this.clock().getTime() < this.hypeUntil,
      head_seq: this.headSeq,
      buffer_size: this.events.length,
      newcomers_spawned: this.newcomersSpawned,
    }),
  };

  private schedule(steps: ScenarioStep[]) {
    for (const step of steps) {
      if (step.at_ms <= 0) {
        this.publish(step.build(this.clock()));
        continue;
      }
      const handle = setTimeout(() => {
        this.pendingSteps.delete(handle);
        this.publish(step.build(this.clock()));
      }, step.at_ms);
      this.pendingSteps.add(handle);
    }
  }

  /** Seeds backdated history once, so insight windows are alive immediately. */
  private warmup() {
    if (this.warmedUp) return;
    this.warmedUp = true;
    const now = this.clock().getTime();
    for (const step of buildWarmup(this.random)) {
      this.publish(step.build(new Date(now + step.at_ms)));
    }
  }

  private baselineTick() {
    this.tickCount += 1;
    const build = buildBaselineTick(this.random, {
      tick: this.tickCount,
      intensity: this.intensity,
      hyped: this.clock().getTime() < this.hypeUntil,
    });
    if (build) this.publish(build(this.clock()));
  }

  private findStampedChatMessage(message_id: string): StampedEvent | undefined {
    for (let i = this.events.length - 1; i >= 0; i -= 1) {
      const stamped = this.events[i];
      if (
        stamped?.event.type === "chat.message.sent" &&
        stamped.event.payload.message_id === message_id
      ) {
        return stamped;
      }
    }
    return undefined;
  }

  private findChatMessage(message_id: string): ChatMessageEvent | undefined {
    const stamped = this.findStampedChatMessage(message_id);
    return stamped?.event.type === "chat.message.sent"
      ? stamped.event.payload
      : undefined;
  }
}

export function createChatEngine(deps: ChatEngineDeps = {}): ChatEngine {
  return new ChatEngineImpl(deps);
}

const globalForChatEngine = globalThis as typeof globalThis & {
  sidekickChatEngine?: ChatEngine;
};

/**
 * HMR-safe process-wide singleton. Real webhook data is the default; opt into
 * the mock baseline only when explicitly demoing without KICK webhooks.
 */
export function getChatEngine(): ChatEngine {
  if (!globalForChatEngine.sidekickChatEngine) {
    const engine = createChatEngine();
    if (process.env.CHAT_ENGINE_DEMO === "on") {
      engine.demo.start();
    }
    globalForChatEngine.sidekickChatEngine = engine;
  }
  return globalForChatEngine.sidekickChatEngine;
}
