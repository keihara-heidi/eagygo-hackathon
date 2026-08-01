import { describe, expect, it } from "vitest";

import type { ChatMessageEvent, KickEvent } from "@/lib/kick/events";
import type { KickBadge, KickEmote, KickUser } from "@/lib/kick/types";

import { getInsights } from "./insights";
import { QUESTION_TOPICS, SIDEKICK_BOT, STREAMER, type QuestionTopic } from "./personas";
import { StreamSession } from "./session";

// Fixtures follow the docs-faithful payload shapes from
// https://docs.kick.com/events/event-types (chat.message.sent), matching the
// style of src/lib/kick/events.test.ts. The engine has no injected clock, so
// tests drive time via the payload's created_at offset from real now — the
// same field warmup history uses.

function makeUser(id: number, username: string, badges: KickBadge[] = []): KickUser {
  return {
    user_id: id,
    username,
    is_anonymous: false,
    is_verified: false,
    profile_picture: `https://example.com/${username}.jpg`,
    channel_slug: username.toLowerCase(),
    identity: { username_color: "#AAAAAA", badges },
  };
}

function chatEvent(
  sender: KickUser,
  content: string,
  options: { msAgo?: number; emotes?: KickEmote[] } = {},
): KickEvent {
  const payload: ChatMessageEvent = {
    message_id: crypto.randomUUID(),
    broadcaster: STREAMER,
    sender,
    content,
    emotes: options.emotes ?? [],
    created_at: new Date(Date.now() - (options.msAgo ?? 0)).toISOString(),
  };
  return { type: "chat.message.sent", version: 1, payload };
}

function followEvent(follower: KickUser): KickEvent {
  return {
    type: "channel.followed",
    version: 1,
    payload: { broadcaster: STREAMER, follower },
  };
}

/** A fresh session + engine pair, wired the same way getSession wires prod. */
function rig() {
  const session = new StreamSession();
  const engine = getInsights(session);
  return { session, engine };
}

function topic(id: string): QuestionTopic {
  const found = QUESTION_TOPICS.find((entry) => entry.id === id);
  if (!found) throw new Error(`personas question topic "${id}" missing`);
  return found;
}
const SENS_TOPIC = topic("sens");
const LOADOUT_TOPIC = topic("loadout");

describe("question clustering", () => {
  it("clusters differently-worded phrasings of the same question", () => {
    const { session, engine } = rig();
    const phrasings = SENS_TOPIC.phrasings;
    phrasings.forEach((phrasing, index) => {
      session.ingest(chatEvent(makeUser(100 + index, `asker_${index}`), phrasing));
    });

    // Statement-form phrasings ("yo orbit what sens…", "sens/dpi pls") are
    // not detected as questions today — the assertion pins clustering of the
    // detected ones, not the detector's recall.
    const clusters = engine.questions();
    const sensClusters = clusters.filter((cluster) =>
      SENS_TOPIC.phrasings.includes(cluster.representative),
    );
    expect(sensClusters).toHaveLength(1);
    expect(sensClusters[0]?.count).toBeGreaterThanOrEqual(6);
    expect(sensClusters[0]?.askers.length).toBe(sensClusters[0]?.count);
  });

  it("keeps unrelated topics in separate clusters", () => {
    const { session, engine } = rig();
    session.ingest(chatEvent(makeUser(100, "a"), SENS_TOPIC.phrasings[0] ?? ""));
    session.ingest(chatEvent(makeUser(101, "b"), SENS_TOPIC.phrasings[1] ?? ""));
    session.ingest(chatEvent(makeUser(102, "c"), LOADOUT_TOPIC.phrasings[0] ?? ""));
    session.ingest(chatEvent(makeUser(103, "d"), LOADOUT_TOPIC.phrasings[1] ?? ""));

    expect(engine.questions()).toHaveLength(2);
  });

  it("does not treat all-caps hype shouts with '?' as questions", () => {
    const { session, engine } = rig();
    session.ingest(chatEvent(makeUser(100, "hype_beast"), "1v4?!?!"));
    session.ingest(chatEvent(makeUser(101, "hype_beast_2"), "NO WAY?!"));

    expect(engine.questions()).toHaveLength(0);
  });
});

describe("digest + !answered loop", () => {
  function floodSens(session: StreamSession) {
    for (let index = 0; index < 3; index += 1) {
      session.ingest(
        chatEvent(makeUser(100 + index, `asker_${index}`), SENS_TOPIC.phrasings[index] ?? ""),
      );
    }
  }

  it("posts a chat digest as the Sidekick bot once 3 people ask", () => {
    const { session } = rig();
    floodSens(session);

    const botMessages = session
      .backlog(50)
      .filter(
        (entry) =>
          entry.event.type === "chat.message.sent" &&
          entry.event.payload.sender.user_id === SIDEKICK_BOT.user_id,
      );
    expect(botMessages).toHaveLength(1);
    const digest = botMessages[0];
    if (digest?.event.type !== "chat.message.sent") throw new Error("unreachable");
    expect(digest.event.payload.content).toContain("3 people have asked");
  });

  it("resolves the digested cluster on a mod's !answered and recalls the answer", () => {
    const { session, engine } = rig();
    floodSens(session);
    const mod = makeUser(200, "mod_andy", [{ text: "Moderator", type: "moderator" }]);
    session.ingest(chatEvent(mod, "!answered"));

    const answered = engine.questions().find((entry) => entry.answered);
    expect(answered).toBeDefined();
    expect(answered?.answer).toBe(SENS_TOPIC.answer);

    const recall = engine.findAnswered("yo what dpi do you play on??");
    expect(recall?.id).toBe(answered?.id);
  });

  it("ignores !answered from a regular viewer", () => {
    const { session, engine } = rig();
    floodSens(session);
    session.ingest(chatEvent(makeUser(201, "random_andy"), "!answered"));

    expect(engine.questions().every((entry) => !entry.answered)).toBe(true);
  });

  it("does not let the bot's own digest feed the clusters", () => {
    const { session, engine } = rig();
    floodSens(session);

    const all = engine.questions();
    expect(all).toHaveLength(1);
    expect(all[0]?.askers).not.toContain(SIDEKICK_BOT.username);
  });
});

describe("vibe", () => {
  it("reports dead with no traffic", () => {
    const { engine } = rig();
    expect(engine.vibe().vibe).toBe("dead");
  });

  it("flips to hype on a message burst", () => {
    const { session, engine } = rig();
    for (let index = 0; index < 50; index += 1) {
      session.ingest(chatEvent(makeUser(300 + index, `viewer_${index}`), "LETS GOOO"));
    }

    const vibe = engine.vibe();
    expect(vibe.vibe).toBe("hype");
    expect(vibe.messages_per_minute).toBe(50);
  });

  it("counts backdated history into the baseline, not the current minute", () => {
    const { session, engine } = rig();
    for (let index = 0; index < 30; index += 1) {
      session.ingest(
        chatEvent(makeUser(300 + (index % 5), `viewer_${index % 5}`), "nice play", {
          msAgo: 4 * 60_000,
        }),
      );
    }
    session.ingest(chatEvent(makeUser(400, "viewer_now"), "hello"));

    const vibe = engine.vibe();
    expect(vibe.messages_per_minute).toBe(1);
    expect(vibe.baseline_per_minute).toBeGreaterThan(1);
  });
});

describe("trending", () => {
  it("counts words minus stopwords, and emotes from the payload", () => {
    const { session, engine } = rig();
    const kekw: KickEmote = { emote_id: "37226", positions: [{ s: 0, e: 15 }] };
    session.ingest(chatEvent(makeUser(500, "a"), "loadout check", { emotes: [kekw] }));
    session.ingest(chatEvent(makeUser(501, "b"), "loadout again", { emotes: [kekw] }));
    session.ingest(chatEvent(makeUser(502, "c"), "the the the loadout"));

    const trending = engine.trending();
    expect(trending.words[0]?.word).toBe("loadout");
    expect(trending.words[0]?.count).toBe(3);
    expect(trending.words.some((entry) => entry.word === "the")).toBe(false);
    expect(trending.emotes[0]?.name).toBe("KEKW");
    expect(trending.emotes[0]?.count).toBe(2);
  });
});

describe("chatters", () => {
  it("flags first-timers, mods, and recent followers", () => {
    const { session, engine } = rig();
    session.ingest(chatEvent(makeUser(600, "brand_new"), "first time here"));
    const mod = makeUser(601, "mod_andy", [{ text: "Moderator", type: "moderator" }]);
    session.ingest(chatEvent(mod, "keep it clean"));
    session.ingest(followEvent(makeUser(602, "fresh_follow")));

    const chatters = engine.chatters();
    expect(chatters.first_timers).toContain("brand_new");
    expect(chatters.mods_active).toContain("mod_andy");
    expect(chatters.recent_followers).toContain("fresh_follow");
  });

  it("does not flag long-seen chatters as first-timers", () => {
    const { session, engine } = rig();
    session.ingest(chatEvent(makeUser(603, "old_timer"), "been here a while", { msAgo: 30 * 60_000 }));
    session.ingest(chatEvent(makeUser(603, "old_timer"), "still here"));

    expect(engine.chatters().first_timers).not.toContain("old_timer");
  });
});

describe("stream context", () => {
  it("returns the mock stream's identity and an uptime past the persona offset", () => {
    const { engine } = rig();
    const context = engine.context();
    expect(context.streamer).toBe(STREAMER.username);
    expect(context.title.length).toBeGreaterThan(0);
    expect(context.uptime_minutes).toBeGreaterThanOrEqual(84);
    expect(context.viewer_count).toBeGreaterThan(0);
  });
});
