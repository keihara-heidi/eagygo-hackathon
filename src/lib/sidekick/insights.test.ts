import { describe, expect, it } from "vitest";

import { createChatEngine } from "@/lib/chat-engine";
import { QUESTION_TOPICS, SIDEKICK_BOT, STREAMER, type QuestionTopic } from "@/lib/chat-engine/cast";
import type { ChatMessageEvent, WebhookDelivery } from "@/lib/kick/events";
import type { KickBadge, KickEmote, KickUser } from "@/lib/kick/types";

import { getInsights } from "./insights";

// Fixtures follow the docs-faithful payload shapes from
// https://docs.kick.com/events/event-types (chat.message.sent), matching the
// style of src/lib/kick/events.test.ts. Tests drive time via the payload's
// created_at offset from real now — the same field warmup history uses.

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

function chatDelivery(
  sender: KickUser,
  content: string,
  options: { msAgo?: number; emotes?: KickEmote[]; broadcaster?: KickUser } = {},
): WebhookDelivery {
  const body: ChatMessageEvent = {
    message_id: crypto.randomUUID(),
    broadcaster: options.broadcaster ?? STREAMER,
    sender,
    content,
    emotes: options.emotes ?? [],
    created_at: new Date(Date.now() - (options.msAgo ?? 0)).toISOString(),
  };
  return { eventType: "chat.message.sent", eventVersion: 1, body };
}

function followDelivery(follower: KickUser): WebhookDelivery {
  return {
    eventType: "channel.followed",
    eventVersion: 1,
    body: { broadcaster: STREAMER, follower },
  };
}

/** A fresh chat engine + insight engine pair, wired the way the runtime wires prod. */
function rig() {
  const engine = createChatEngine();
  const insights = getInsights(engine);
  return { engine, insights };
}

function topic(id: string): QuestionTopic {
  const found = QUESTION_TOPICS.find((entry) => entry.id === id);
  if (!found) throw new Error(`cast question topic "${id}" missing`);
  return found;
}
const SENS_TOPIC = topic("sens");
const LOADOUT_TOPIC = topic("loadout");

describe("question clustering", () => {
  it("clusters differently-worded phrasings of the same question", () => {
    const { engine, insights } = rig();
    const phrasings = SENS_TOPIC.phrasings;
    phrasings.forEach((phrasing, index) => {
      engine.publish(chatDelivery(makeUser(100 + index, `asker_${index}`), phrasing));
    });

    // Statement-form phrasings ("yo orbit what sens…", "sens/dpi pls") are
    // not detected as questions today — the assertion pins clustering of the
    // detected ones, not the detector's recall.
    const clusters = insights.questions();
    const sensClusters = clusters.filter((cluster) =>
      SENS_TOPIC.phrasings.includes(cluster.representative),
    );
    expect(sensClusters).toHaveLength(1);
    expect(sensClusters[0]?.count).toBeGreaterThanOrEqual(6);
    expect(sensClusters[0]?.askers.length).toBe(sensClusters[0]?.count);
  });

  it("keeps unrelated topics in separate clusters", () => {
    const { engine, insights } = rig();
    // Phrasings chosen to share tokens within a topic ("sens", "loadout") —
    // clustering keys on token overlap, so cross-topic pairs must not share any.
    const loadoutA = LOADOUT_TOPIC.phrasings.find((p) => p === "what loadout is this") ?? "";
    const loadoutB = LOADOUT_TOPIC.phrasings.find((p) => p === "loadout code?") ?? "";
    engine.publish(chatDelivery(makeUser(100, "a"), SENS_TOPIC.phrasings[0] ?? ""));
    engine.publish(chatDelivery(makeUser(101, "b"), SENS_TOPIC.phrasings[1] ?? ""));
    engine.publish(chatDelivery(makeUser(102, "c"), loadoutA));
    engine.publish(chatDelivery(makeUser(103, "d"), loadoutB));

    expect(insights.questions()).toHaveLength(2);
  });

  it("does not treat all-caps hype shouts with '?' as questions", () => {
    const { engine, insights } = rig();
    engine.publish(chatDelivery(makeUser(100, "hype_beast"), "1v4?!?!"));
    engine.publish(chatDelivery(makeUser(101, "hype_beast_2"), "NO WAY?!"));

    expect(insights.questions()).toHaveLength(0);
  });
});

describe("digest + !answered loop", () => {
  function floodSens(engine: ReturnType<typeof createChatEngine>) {
    for (let index = 0; index < 3; index += 1) {
      engine.publish(
        chatDelivery(makeUser(100 + index, `asker_${index}`), SENS_TOPIC.phrasings[index] ?? ""),
      );
    }
  }

  it("posts a chat digest as the Sidekick bot once 3 people ask", async () => {
    const { engine } = rig();
    floodSens(engine);
    // Digest posts through the loopback bot poster — let the echo land.
    await new Promise((resolve) => setImmediate(resolve));

    const botMessages = engine
      .getRecent()
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
    const { engine, insights } = rig();
    floodSens(engine);
    const mod = makeUser(200, "mod_andy", [{ text: "Moderator", type: "moderator" }]);
    engine.publish(chatDelivery(mod, "!answered"));

    const answered = insights.questions().find((entry) => entry.answered);
    expect(answered).toBeDefined();
    expect(answered?.answer).toBe(SENS_TOPIC.answer);

    const recall = insights.findAnswered("yo what dpi do you play on??");
    expect(recall?.id).toBe(answered?.id);
  });

  it("ignores !answered from a regular viewer", () => {
    const { engine, insights } = rig();
    floodSens(engine);
    engine.publish(chatDelivery(makeUser(201, "random_andy"), "!answered"));

    expect(insights.questions().every((entry) => !entry.answered)).toBe(true);
  });

  it("does not let the bot's own digest feed the clusters", () => {
    const { engine, insights } = rig();
    floodSens(engine);

    const all = insights.questions();
    expect(all).toHaveLength(1);
    expect(all[0]?.askers).not.toContain(SIDEKICK_BOT.username);
  });
});

describe("vibe", () => {
  it("reports dead with no traffic", () => {
    const { insights } = rig();
    expect(insights.vibe().vibe).toBe("dead");
  });

  it("flips to hype on a message burst", () => {
    const { engine, insights } = rig();
    for (let index = 0; index < 50; index += 1) {
      engine.publish(chatDelivery(makeUser(300 + index, `viewer_${index}`), "LETS GOOO"));
    }

    const vibe = insights.vibe();
    expect(vibe.vibe).toBe("hype");
    expect(vibe.messages_per_minute).toBe(50);
  });

  it("counts backdated history into the baseline, not the current minute", () => {
    const { engine, insights } = rig();
    for (let index = 0; index < 30; index += 1) {
      engine.publish(
        chatDelivery(makeUser(300 + (index % 5), `viewer_${index % 5}`), "nice play", {
          msAgo: 4 * 60_000,
        }),
      );
    }
    engine.publish(chatDelivery(makeUser(400, "viewer_now"), "hello"));

    const vibe = insights.vibe();
    expect(vibe.messages_per_minute).toBe(1);
    expect(vibe.baseline_per_minute).toBeGreaterThan(1);
  });
});

describe("trending", () => {
  it("counts words minus stopwords, and emotes from the payload", () => {
    const { engine, insights } = rig();
    const kekw: KickEmote = { emote_id: "37226", positions: [{ s: 0, e: 15 }] };
    engine.publish(chatDelivery(makeUser(500, "a"), "loadout check", { emotes: [kekw] }));
    engine.publish(chatDelivery(makeUser(501, "b"), "loadout again", { emotes: [kekw] }));
    engine.publish(chatDelivery(makeUser(502, "c"), "the the the loadout"));

    const trending = insights.trending();
    expect(trending.words[0]?.word).toBe("loadout");
    expect(trending.words[0]?.count).toBe(3);
    expect(trending.words.some((entry) => entry.word === "the")).toBe(false);
    expect(trending.emotes[0]?.name).toBe("KEKW");
    expect(trending.emotes[0]?.count).toBe(2);
  });
});

describe("chatters", () => {
  it("flags first-timers, mods, and recent followers", () => {
    const { engine, insights } = rig();
    engine.publish(chatDelivery(makeUser(600, "brand_new"), "first time here"));
    const mod = makeUser(601, "mod_andy", [{ text: "Moderator", type: "moderator" }]);
    engine.publish(chatDelivery(mod, "keep it clean"));
    engine.publish(followDelivery(makeUser(602, "fresh_follow")));

    const chatters = insights.chatters();
    expect(chatters.first_timers).toContain("brand_new");
    expect(chatters.mods_active).toContain("mod_andy");
    expect(chatters.recent_followers).toContain("fresh_follow");
  });

  it("does not flag long-seen chatters as first-timers", () => {
    const { engine, insights } = rig();
    engine.publish(chatDelivery(makeUser(603, "old_timer"), "been here a while", { msAgo: 30 * 60_000 }));
    engine.publish(chatDelivery(makeUser(603, "old_timer"), "still here"));

    expect(insights.chatters().first_timers).not.toContain("old_timer");
  });
});

describe("stream context", () => {
  it("returns the mock stream's identity and an uptime past the persona offset", () => {
    const { insights } = rig();
    const context = insights.context();
    expect(context.streamer).toBe(STREAMER.username);
    expect(context.title.length).toBeGreaterThan(0);
    expect(context.uptime_minutes).toBeGreaterThanOrEqual(84);
    expect(context.viewer_count).toBeGreaterThan(0);
  });
});

describe("live channel context", () => {
  it("flips to the observed broadcaster, resets windows on switch, and flips back", () => {
    const { engine, insights } = rig();
    engine.publish(chatDelivery(makeUser(701, "asker_a"), "what's your sens?"));
    engine.publish(chatDelivery(makeUser(702, "asker_b"), "whats ur dpi and sens"));
    expect(insights.context().streamer).toBe(STREAMER.username);
    expect(insights.questions().length).toBeGreaterThan(0);

    const kanel = makeUser(1_849_0228, "kaneljoseph");
    engine.publish(chatDelivery(makeUser(703, "viewer_a"), "LETS GOOO", { broadcaster: kanel }));
    engine.publish(
      chatDelivery(makeUser(704, "viewer_b"), "who is playing right now?", {
        broadcaster: kanel,
      }),
    );

    const liveContext = insights.context();
    expect(liveContext.streamer).toBe("kaneljoseph");
    expect(liveContext.title).toBe("Live on KICK");
    // Mock-era clusters and trends are gone — nothing bleeds across.
    expect(insights.questions()).toHaveLength(0);
    expect(insights.trending().words.map((entry) => entry.word)).not.toContain("sens");

    engine.publish(chatDelivery(makeUser(705, "home_again"), "we back?"));
    expect(insights.context().streamer).toBe(STREAMER.username);
  });

  it("!answered <words> stores the spoken answer as the recall payload", () => {
    const { engine, insights } = rig();
    const kanel = makeUser(1_849_0228, "kaneljoseph");
    engine.publish(
      chatDelivery(makeUser(801, "q1"), "what is the match score?", { broadcaster: kanel }),
    );
    engine.publish(
      chatDelivery(makeUser(802, "q2"), "what is the score right now?", { broadcaster: kanel }),
    );
    engine.publish(
      chatDelivery(makeUser(803, "q3"), "score update please?", { broadcaster: kanel }),
    );

    // The channel owner (sender == broadcaster) resolves with the real answer.
    engine.publish(chatDelivery(kanel, "!answered 6-4, 3-2", { broadcaster: kanel }));

    const answered = insights.questions().find((cluster) => cluster.answered);
    expect(answered?.answer).toBe("6-4, 3-2");
    expect(insights.findAnswered("what is the score?")?.answer).toBe("6-4, 3-2");
  });

  it("live answered recall quotes what chat actually said", () => {
    const { engine, insights } = rig();
    const kanel = makeUser(1_849_0228, "kaneljoseph");
    engine.publish(
      chatDelivery(makeUser(911, "q1"), "what is the score?", { broadcaster: kanel }),
    );
    engine.publish(
      chatDelivery(makeUser(912, "q2"), "what is the match score?", { broadcaster: kanel }),
    );
    engine.publish(
      chatDelivery(makeUser(913, "chatty"), "score is 6-4 right now", { broadcaster: kanel }),
    );
    const mod = makeUser(914, "real_mod_2", [{ text: "Moderator", type: "moderator" }]);
    engine.publish(chatDelivery(mod, "!answered", { broadcaster: kanel }));

    const answered = insights.questions().find((cluster) => cluster.answered);
    expect(answered?.answer).toContain("6-4");
    expect(answered?.answer).toContain("@chatty");
  });

  it("live mode never recalls the cast's fabricated topic answers", () => {
    const { engine, insights } = rig();
    const kanel = makeUser(1_849_0228, "kaneljoseph");
    engine.publish(
      chatDelivery(makeUser(901, "q1"), "what's your sens?", { broadcaster: kanel }),
    );
    engine.publish(
      chatDelivery(makeUser(902, "q2"), "whats ur dpi and sens", { broadcaster: kanel }),
    );
    engine.publish(
      chatDelivery(makeUser(903, "q3"), "sensitivity settings?", { broadcaster: kanel }),
    );
    const mod = makeUser(904, "real_mod", [{ text: "Moderator", type: "moderator" }]);
    engine.publish(chatDelivery(mod, "!answered", { broadcaster: kanel }));

    const answered = insights.questions().find((cluster) => cluster.answered);
    expect(answered?.answer).not.toContain("DPI");
    expect(answered?.answer).toContain("covered this on stream");
  });
});
