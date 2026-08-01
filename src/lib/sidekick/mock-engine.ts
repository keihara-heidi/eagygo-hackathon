/**
 * Scripted mock chat engine. Emits docs-faithful Kick webhook events
 * (`chat.message.sent`, `channel.followed`, ...) on a timeline, with demo
 * triggers for hype spikes, question floods and new-viewer joins.
 */

import type { ChatMessageEvent, KickEvent } from "@/lib/kick/events";
import type { KickEmote, KickUser } from "@/lib/kick/types";

import {
  AMBIENT_LINES,
  EMOTES,
  HYPE_LINES,
  NEWCOMER_GREETINGS,
  NEWCOMER_NAMES,
  PERSONAS,
  QUESTION_TOPICS,
  STREAMER,
  type Persona,
} from "./personas";

const TICK_MS = 500;
const HYPE_DURATION_MS = 20_000;
const QUESTION_FLOOD_COUNT = 8;
const QUESTION_FLOOD_SPACING_MS = 1_100;

function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) throw new Error("pick() from empty array");
  return item;
}

/** Builds message content with Kick's inline emote syntax + positions. */
function withEmotes(text: string, emoteNames: (keyof typeof EMOTES)[]): {
  content: string;
  emotes: KickEmote[];
} {
  let content = text;
  const emotes: KickEmote[] = [];
  for (const name of emoteNames) {
    const emote = EMOTES[name];
    const token = `[emote:${emote.emote_id}:${emote.name}]`;
    const start = content.length === 0 ? 0 : content.length + 1;
    content = content.length === 0 ? token : `${content} ${token}`;
    const existing = emotes.find((entry) => entry.emote_id === emote.emote_id);
    const position = { s: start, e: start + token.length - 1 };
    if (existing) existing.positions.push(position);
    else emotes.push({ emote_id: emote.emote_id, positions: [position] });
  }
  return { content, emotes };
}

export function buildChatMessage(
  sender: KickUser,
  text: string,
  emoteNames: (keyof typeof EMOTES)[] = [],
  createdAt?: Date,
): KickEvent {
  const { content, emotes } = withEmotes(text, emoteNames);
  const payload: ChatMessageEvent = {
    message_id: crypto.randomUUID(),
    broadcaster: STREAMER,
    sender,
    content,
    emotes,
    created_at: (createdAt ?? new Date()).toISOString(),
  };
  return { type: "chat.message.sent", version: 1, payload };
}

function newcomerUser(username: string): KickUser {
  return {
    user_id: 3_000_000 + Math.floor(Math.random() * 900_000),
    username,
    is_anonymous: false,
    is_verified: false,
    profile_picture: `https://api.dicebear.com/9.x/thumbs/svg?seed=${username}`,
    channel_slug: username.toLowerCase(),
    identity: { username_color: "#AAAAAA", badges: [] },
  };
}

export interface MockEngineOptions {
  onEvent: (event: KickEvent) => void;
}

export class MockEngine {
  private readonly onEvent: (event: KickEvent) => void;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pending: ReturnType<typeof setTimeout>[] = [];
  private hypeUntil = 0;
  private intensity = 0.15;
  private usedNewcomers = 0;
  private tickCount = 0;

  constructor(options: MockEngineOptions) {
    this.onEvent = options.onEvent;
  }

  start() {
    if (this.timer) return;
    this.warmup();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  /**
   * Seeds ~4 minutes of backdated history so the chat column and insight
   * windows look alive from the very first query after a cold start.
   */
  private warmup() {
    const now = Date.now();
    const messageCount = 45;
    for (let i = 0; i < messageCount; i += 1) {
      const at = new Date(now - (messageCount - i) * 5_300);
      const persona = pick(PERSONAS);
      const roll = Math.random();
      if (roll < 0.12) {
        this.onEvent(buildChatMessage(persona.user, pick(AMBIENT_LINES), ["KEKW"], at));
      } else if (roll < 0.18) {
        const topic = pick(QUESTION_TOPICS);
        this.onEvent(buildChatMessage(persona.user, pick(topic.phrasings), [], at));
      } else {
        this.onEvent(buildChatMessage(persona.user, pick(AMBIENT_LINES), [], at));
      }
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const handle of this.pending) clearTimeout(handle);
    this.pending = [];
  }

  setIntensity(value: number) {
    this.intensity = Math.min(1, Math.max(0.05, value));
  }

  triggerHype() {
    this.hypeUntil = Date.now() + HYPE_DURATION_MS;
  }

  triggerQuestionFlood(topicId?: string) {
    const topic =
      QUESTION_TOPICS.find((entry) => entry.id === topicId) ?? QUESTION_TOPICS[0];
    if (!topic) return;
    const askers = [...PERSONAS].sort(() => Math.random() - 0.5);
    for (let i = 0; i < QUESTION_FLOOD_COUNT; i += 1) {
      const asker = askers[i % askers.length];
      const phrasing = topic.phrasings[i % topic.phrasings.length];
      if (!asker || !phrasing) continue;
      this.later(i * QUESTION_FLOOD_SPACING_MS, () => {
        this.onEvent(buildChatMessage(asker.user, phrasing));
      });
    }
  }

  triggerNewViewer() {
    const name =
      NEWCOMER_NAMES[this.usedNewcomers % NEWCOMER_NAMES.length] ?? "new_viewer";
    this.usedNewcomers += 1;
    const user = newcomerUser(name);
    this.onEvent({
      type: "channel.followed",
      version: 1,
      payload: { broadcaster: STREAMER, follower: user },
    });
    this.later(1_500, () => {
      this.onEvent(buildChatMessage(user, pick(NEWCOMER_GREETINGS)));
    });
    return user;
  }

  private later(delayMs: number, fn: () => void) {
    const handle = setTimeout(() => {
      this.pending = this.pending.filter((entry) => entry !== handle);
      fn();
    }, delayMs);
    this.pending.push(handle);
  }

  private tick() {
    this.tickCount += 1;
    const hyped = Date.now() < this.hypeUntil;
    const chance = hyped ? 0.95 : this.intensity;
    if (Math.random() < chance) this.emitChat(hyped);
    // Occasional ambient platform events (~ every 60s of ticks).
    if (!hyped && this.tickCount % 120 === 0) this.emitAmbientPlatformEvent();
  }

  private emitChat(hyped: boolean) {
    const persona = pick(PERSONAS);
    if (hyped) {
      const roll = Math.random();
      if (roll < 0.35) {
        this.onEvent(buildChatMessage(persona.user, "", ["HYPERCLAP", "HYPERCLAP"]));
      } else if (roll < 0.55) {
        this.onEvent(buildChatMessage(persona.user, pick(HYPE_LINES), ["KEKW"]));
      } else {
        this.onEvent(buildChatMessage(persona.user, pick(HYPE_LINES)));
      }
      return;
    }
    const roll = Math.random();
    if (roll < 0.12) {
      this.onEvent(buildChatMessage(persona.user, pick(AMBIENT_LINES), ["KEKW"]));
    } else if (roll < 0.2) {
      // Organic single question so the radar always has something to show.
      const topic = pick(QUESTION_TOPICS);
      this.onEvent(buildChatMessage(persona.user, pick(topic.phrasings)));
    } else {
      this.onEvent(buildChatMessage(persona.user, pick(AMBIENT_LINES)));
    }
  }

  private emitAmbientPlatformEvent() {
    const persona = pick(PERSONAS.filter((entry: Persona) => entry.kind !== "mod"));
    const roll = Math.random();
    const now = new Date();
    if (roll < 0.5) {
      this.onEvent({
        type: "channel.followed",
        version: 1,
        payload: { broadcaster: STREAMER, follower: persona.user },
      });
    } else if (roll < 0.8) {
      this.onEvent({
        type: "channel.subscription.new",
        version: 1,
        payload: {
          broadcaster: STREAMER,
          subscriber: persona.user,
          duration: 1,
          created_at: now.toISOString(),
          expires_at: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
        },
      });
    } else {
      this.onEvent({
        type: "kicks.gifted",
        version: 1,
        payload: {
          broadcaster: STREAMER,
          sender: persona.user,
          gift: {
            amount: pick([50, 100, 500] as const),
            name: pick(["Rage Quit", "Level Up", "Clutch"] as const),
            type: "LEVEL_UP",
            tier: "MID",
            message: pick(["W stream", "take my kicks", "clutch king"] as const),
            pinned_time_seconds: 600,
          },
          created_at: now.toISOString(),
        },
      });
    }
  }
}
