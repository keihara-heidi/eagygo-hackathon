import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CAST, NEWCOMER_USER_ID_BASE, SENS_TOPIC } from "./cast";
import { createChatEngine } from "./engine";
import { expectRoundTrip } from "./test-helpers";
import type { ChatEngine, StampedEvent } from "./types";

/** Deterministic RNG (mulberry32) so scenario content is pinned per seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function collect(engine: ChatEngine): StampedEvent[] {
  const events: StampedEvent[] = [];
  engine.subscribe((e) => events.push(e));
  return events;
}

function chatPayloads(events: StampedEvent[]) {
  return events.flatMap((e) =>
    e.event.type === "chat.message.sent" ? [e.event.payload] : [],
  );
}

const CAST_USER_IDS = new Set(CAST.map((member) => member.user.user_id));

describe("demo scenarios", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-08-01T02:00:00.000Z") });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("question_flood publishes 8 paraphrased sens questions from distinct cast members", () => {
    const engine = createChatEngine({ random: mulberry32(42) });
    const events = collect(engine);

    engine.demo.trigger("question_flood");
    vi.advanceTimersByTime(8 * 1_100);

    expect(events).toHaveLength(8);
    const payloads = chatPayloads(events);
    expect(payloads).toHaveLength(8);

    const askers = payloads.map((p) => p.sender.user_id);
    expect(new Set(askers).size).toBe(8);
    for (const asker of askers) expect(CAST_USER_IDS.has(asker)).toBe(true);

    const contents = payloads.map((p) => p.content);
    expect(new Set(contents).size).toBe(8);
    for (const content of contents) {
      expect(SENS_TOPIC.phrasings).toContain(content);
    }

    for (const event of events) expectRoundTrip(event);
  });

  it("hype_spike floods emote messages and mixes in kicks.gifted and sub events", () => {
    const engine = createChatEngine({ random: mulberry32(7) });
    const events = collect(engine);

    engine.demo.trigger("hype_spike");
    expect(engine.demo.getState().hype_active).toBe(true);
    vi.advanceTimersByTime(20_000);

    const byType = new Map<string, number>();
    for (const e of events) {
      byType.set(e.event.type, (byType.get(e.event.type) ?? 0) + 1);
    }
    expect(byType.get("chat.message.sent")).toBe(12);
    expect(byType.get("kicks.gifted")).toBe(1);
    expect(byType.get("channel.subscription.new")).toBe(1);
    expect(byType.get("channel.subscription.gifts")).toBe(1);

    const withEmotes = chatPayloads(events).filter((p) => p.emotes.length > 0);
    expect(withEmotes.length).toBeGreaterThanOrEqual(4);
    for (const payload of withEmotes) {
      const first = payload.emotes[0]?.positions[0];
      expect(first).toBeDefined();
      // Positions must index real [emote:id:name] tokens in the content.
      expect(payload.content.slice(first!.s, first!.e + 1)).toMatch(
        /^\[emote:\d+:\w+\]$/,
      );
    }

    expect(engine.demo.getState().hype_active).toBe(false);
    for (const event of events) expectRoundTrip(event);
  });

  it("new_viewer emits channel.followed then a first message from an unseen chatter", () => {
    const engine = createChatEngine({ random: mulberry32(1) });
    const events = collect(engine);

    engine.demo.trigger("new_viewer");
    vi.advanceTimersByTime(1_500);

    expect(events.map((e) => e.event.type)).toEqual([
      "channel.followed",
      "chat.message.sent",
    ]);
    const follow = events[0];
    if (follow?.event.type !== "channel.followed") throw new Error("unreachable");
    const newcomer = follow.event.payload.follower;
    expect(newcomer.user_id).toBe(NEWCOMER_USER_ID_BASE);
    expect(CAST_USER_IDS.has(newcomer.user_id)).toBe(false);

    const greeting = chatPayloads(events)[0];
    expect(greeting?.sender.user_id).toBe(newcomer.user_id);

    // A second trigger spawns a different unseen account.
    engine.demo.trigger("new_viewer");
    vi.advanceTimersByTime(1_500);
    const secondFollow = events[2];
    if (secondFollow?.event.type !== "channel.followed") {
      throw new Error("unreachable");
    }
    expect(secondFollow.event.payload.follower.user_id).toBe(
      NEWCOMER_USER_ID_BASE + 1,
    );

    for (const event of events) expectRoundTrip(event);
    expect(engine.demo.getState().newcomers_spawned).toBe(2);
  });

  it("demo.stop cancels pending scenario steps", () => {
    const engine = createChatEngine({ random: mulberry32(3) });
    const events = collect(engine);

    engine.demo.trigger("question_flood");
    vi.advanceTimersByTime(2_200);
    expect(events).toHaveLength(3);

    engine.demo.stop();
    vi.advanceTimersByTime(60_000);
    expect(events).toHaveLength(3);
  });
});

describe("baseline timeline", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-08-01T02:00:00.000Z") });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits ambient events while running and halts on stop", () => {
    const engine = createChatEngine({ random: mulberry32(1234) });
    const events = collect(engine);

    expect(engine.demo.getState().running).toBe(false);
    engine.demo.start();
    expect(engine.demo.getState().running).toBe(true);

    vi.advanceTimersByTime(10_000);
    const whileRunning = events.length;
    expect(whileRunning).toBeGreaterThan(0);
    for (const event of events) expectRoundTrip(event);

    engine.demo.stop();
    vi.advanceTimersByTime(10_000);
    expect(events).toHaveLength(whileRunning);
    expect(engine.demo.getState().running).toBe(false);
  });

  it("clamps intensity into 0.05..1", () => {
    const engine = createChatEngine({ random: mulberry32(5) });

    engine.demo.setIntensity(3);
    expect(engine.demo.getState().intensity).toBe(1);
    engine.demo.setIntensity(0);
    expect(engine.demo.getState().intensity).toBe(0.05);
    engine.demo.setIntensity(0.4);
    expect(engine.demo.getState().intensity).toBe(0.4);
  });

  it("reports head_seq and buffer_size through getState", () => {
    const engine = createChatEngine({ random: mulberry32(9) });

    engine.demo.trigger("new_viewer");
    vi.advanceTimersByTime(1_500);

    const state = engine.demo.getState();
    expect(state.head_seq).toBe(2);
    expect(state.buffer_size).toBe(2);
  });
});
