/**
 * Scripted demo timelines, expressed as data: each scenario is a list of
 * scheduled steps whose deliveries are built at fire time (so `created_at`
 * matches delivery time). All randomness comes through the injected RNG,
 * which keeps every scenario deterministic under a seeded generator.
 */

import type { WebhookDelivery } from "@/lib/kick/events";

import {
  AMBIENT_LINES,
  CAST,
  HYPE_LINES,
  NEWCOMER_GREETINGS,
  QUESTION_TOPICS,
  SENS_TOPIC,
  newcomerUser,
  type CastMember,
} from "./cast";
import {
  channelFollowedDelivery,
  chatMessageDelivery,
  kicksGiftedDelivery,
  subscriptionGiftsDelivery,
  subscriptionNewDelivery,
} from "./deliveries";

export interface ScenarioStep {
  at_ms: number;
  build: (now: Date) => WebhookDelivery;
}

type Rng = () => number;

function pick<T>(random: Rng, items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error("pick() from empty array");
  return item;
}

function shuffled<T>(random: Rng, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i];
    const b = result[j];
    if (a === undefined || b === undefined) continue;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

function castAt(members: CastMember[], index: number): CastMember {
  const member = members[index % members.length];
  if (member === undefined) throw new Error("empty cast");
  return member;
}

// ---------------------------------------------------------------------------
// question_flood — SPEC demo step 3: 8 viewers ask about sensitivity in
// different words, from distinct cast members.
// ---------------------------------------------------------------------------

const QUESTION_SPACING_MS = 1_100;

export function buildQuestionFlood(random: Rng): ScenarioStep[] {
  const askers = shuffled(random, CAST);
  return SENS_TOPIC.phrasings.map((phrasing, i) => {
    const asker = castAt(askers, i);
    return {
      at_ms: i * QUESTION_SPACING_MS,
      build: (now: Date) =>
        chatMessageDelivery({ sender: asker.user, text: phrasing }, now),
    };
  });
}

// ---------------------------------------------------------------------------
// hype_spike — emote flood plus kicks.gifted and sub events.
// ---------------------------------------------------------------------------

const HYPE_MESSAGE_COUNT = 12;
const HYPE_MESSAGE_SPACING_MS = 700;
export const HYPE_WINDOW_MS = 20_000;

export function buildHypeSpike(random: Rng): ScenarioStep[] {
  const chatters = shuffled(random, CAST);
  const steps: ScenarioStep[] = [];

  for (let i = 0; i < HYPE_MESSAGE_COUNT; i += 1) {
    const sender = castAt(chatters, i).user;
    const line = pick(random, HYPE_LINES);
    const step: ScenarioStep = {
      at_ms: i * HYPE_MESSAGE_SPACING_MS,
      build: (now) => {
        if (i % 3 === 0) {
          return chatMessageDelivery(
            { sender, text: "", emoteNames: ["HYPERCLAP", "HYPERCLAP"] },
            now,
          );
        }
        if (i % 3 === 1) {
          return chatMessageDelivery(
            { sender, text: line, emoteNames: ["KEKW"] },
            now,
          );
        }
        return chatMessageDelivery({ sender, text: line }, now);
      },
    };
    steps.push(step);
  }

  const gifter = CAST.find((member) => member.kind === "sub") ?? castAt(CAST, 0);
  const newSub = CAST.find((member) => member.kind === "regular") ?? castAt(CAST, 1);
  const giftees = CAST.filter((member) => member.kind === "fresh").map(
    (member) => member.user,
  );

  steps.push({
    at_ms: 2_500,
    build: (now) =>
      kicksGiftedDelivery(
        { sender: gifter.user, amount: 100, name: "Level Up", message: "LETS GOOO" },
        now,
      ),
  });
  steps.push({
    at_ms: 5_000,
    build: (now) => subscriptionNewDelivery(newSub.user, now),
  });
  steps.push({
    at_ms: 9_000,
    build: (now) => subscriptionGiftsDelivery(gifter.user, giftees, now),
  });

  return steps;
}

// ---------------------------------------------------------------------------
// new_viewer — channel.followed plus a first message from an unseen chatter.
// (KICK has no "viewer joined" event type; a follow is the closest real one.)
// ---------------------------------------------------------------------------

const NEWCOMER_GREETING_DELAY_MS = 1_500;

export function buildNewViewer(newcomerIndex: number): ScenarioStep[] {
  const user = newcomerUser(newcomerIndex);
  const greeting =
    NEWCOMER_GREETINGS[newcomerIndex % NEWCOMER_GREETINGS.length] ??
    "hi, just got here";
  return [
    { at_ms: 0, build: () => channelFollowedDelivery(user) },
    {
      at_ms: NEWCOMER_GREETING_DELAY_MS,
      build: (now) => chatMessageDelivery({ sender: user, text: greeting }, now),
    },
  ];
}

// ---------------------------------------------------------------------------
// Baseline ambient timeline — one potential delivery per tick.
// ---------------------------------------------------------------------------

export const BASELINE_TICK_MS = 500;
/** Every ~60s of ticks, the baseline emits a platform event instead. */
const PLATFORM_EVENT_EVERY_TICKS = 120;

export interface BaselineTickContext {
  tick: number;
  intensity: number;
  hyped: boolean;
}

export function buildBaselineTick(
  random: Rng,
  ctx: BaselineTickContext,
): ((now: Date) => WebhookDelivery) | null {
  if (!ctx.hyped && ctx.tick % PLATFORM_EVENT_EVERY_TICKS === 0) {
    return buildAmbientPlatformEvent(random);
  }

  const chance = ctx.hyped ? 0.95 : ctx.intensity;
  if (random() >= chance) return null;

  const sender = pick(random, CAST).user;
  const roll = random();

  if (ctx.hyped) {
    if (roll < 0.35) {
      return (now) =>
        chatMessageDelivery(
          { sender, text: "", emoteNames: ["HYPERCLAP", "HYPERCLAP"] },
          now,
        );
    }
    const line = pick(random, HYPE_LINES);
    if (roll < 0.55) {
      return (now) =>
        chatMessageDelivery({ sender, text: line, emoteNames: ["KEKW"] }, now);
    }
    return (now) => chatMessageDelivery({ sender, text: line }, now);
  }

  if (roll < 0.12) {
    const line = pick(random, AMBIENT_LINES);
    return (now) =>
      chatMessageDelivery({ sender, text: line, emoteNames: ["KEKW"] }, now);
  }
  if (roll < 0.2) {
    // Organic single question so insight detection always has material.
    const topic = pick(random, QUESTION_TOPICS);
    const phrasing = pick(random, topic.phrasings);
    return (now) => chatMessageDelivery({ sender, text: phrasing }, now);
  }
  const line = pick(random, AMBIENT_LINES);
  return (now) => chatMessageDelivery({ sender, text: line }, now);
}

function buildAmbientPlatformEvent(
  random: Rng,
): (now: Date) => WebhookDelivery {
  const nonMods = CAST.filter((member) => member.kind !== "mod");
  const actor = pick(random, nonMods).user;
  const roll = random();
  if (roll < 0.5) {
    return () => channelFollowedDelivery(actor);
  }
  if (roll < 0.8) {
    return (now) => subscriptionNewDelivery(actor, now);
  }
  return (now) =>
    kicksGiftedDelivery(
      { sender: actor, amount: 50, name: "Rage Quit", message: "take my kicks" },
      now,
    );
}
