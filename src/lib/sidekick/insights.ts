/**
 * Insight engine: subscribes to the chat engine's event stream and maintains
 * rolling chat intelligence — trending words/emotes, question clusters, vibe,
 * chatter identity — plus the answered-question store that closes the
 * streamer/viewer feedback loop.
 */

import type { ChatMessageEvent } from "@/lib/kick/events";
import type { ChatEngine, StampedEvent } from "@/lib/chat-engine";

import { EMOTES, QUESTION_TOPICS, SIDEKICK_BOT, STREAM_INFO, STREAMER } from "@/lib/chat-engine/cast";

// ---------------------------------------------------------------------------
// Public result shapes (the contract consumed by widget + voice tools)
// ---------------------------------------------------------------------------

export type Vibe = "hype" | "chill" | "tilted" | "dead";

export interface VibeResult {
  vibe: Vibe;
  messages_per_minute: number;
  baseline_per_minute: number;
  emote_ratio: number;
  description: string;
}

export interface QuestionCluster {
  id: string;
  representative: string;
  count: number;
  askers: string[];
  first_asked_at: string;
  last_asked_at: string;
  answered: boolean;
  answer: string | null;
  digested: boolean;
}

export interface TrendingResult {
  words: { word: string; count: number; delta_pct: number | null }[];
  emotes: { name: string; emote_id: string; count: number }[];
}

export interface ChattersResult {
  active_last_10m: number;
  first_timers: string[];
  mods_active: string[];
  subs_active: string[];
  recent_followers: string[];
  notable: string[];
}

export interface StreamContext {
  streamer: string;
  title: string;
  category: string;
  uptime_minutes: number;
  viewer_count: number;
  streamer_primer: string;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface TrackedMessage {
  at: number;
  senderId: number;
  senderName: string;
  content: string;
  words: string[];
  emoteIds: string[];
  isQuestion: boolean;
}

const WINDOW_MS = 15 * 60_000;
const DIGEST_THRESHOLD = 3;

const STOPWORDS = new Set(
  "the a an is are was were be been do does did to of in on at for with and or but if so it its it's this that these those you your ur u he she they we i me my his her him them what when who how why where can could would should will just not no yes lol lmao bro dude guys chat im i'm dont don't whats what's yo pls plz".split(
    " ",
  ),
);

const NEGATIVE_WORDS = new Set(["l", "lag", "mid", "terrible", "trash", "boring", "rigged"]);

const EMOTE_NAMES = new Map<string, string>(
  Object.values(EMOTES).map((emote) => [emote.emote_id, emote.name]),
);

const QUESTION_START =
  /^(what|whats|when|who|how|why|where|can|could|do|does|is|are|any|got|u |you )/i;

function tokenize(content: string): string[] {
  return content
    .replace(/\[emote:\d+:\w+\]/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9' ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function questionTokens(content: string): Set<string> {
  return new Set(tokenize(content).filter((word) => !STOPWORDS.has(word)));
}

/** Prefix-aware token match so "sens" ~ "sensitivity", "sub" ~ "subscription". */
function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  return a.startsWith(b) || b.startsWith(a);
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const wordA of a) {
    for (const wordB of b) {
      if (tokensMatch(wordA, wordB)) {
        shared += 1;
        break;
      }
    }
  }
  return shared / Math.min(a.size, b.size);
}

interface InternalCluster extends QuestionCluster {
  tokens: Set<string>;
  askerIds: Set<number>;
}

export class InsightEngine {
  /** Bot-posting channel — the digest crosses the same seam as real chat. */
  private readonly postBot: (content: string) => void;

  constructor(postBot: (content: string) => void) {
    this.postBot = postBot;
  }

  private readonly messages: TrackedMessage[] = [];
  private readonly clusters = new Map<string, InternalCluster>();
  private readonly firstSeen = new Map<number, number>();
  private readonly senderMeta = new Map<
    number,
    { name: string; isMod: boolean; isSub: boolean; messageCount: number }
  >();
  private readonly followers: { name: string; at: number }[] = [];
  private readonly notable: { text: string; at: number }[] = [];
  private readonly startedAt = Date.now();

  // -- ingest ---------------------------------------------------------------

  handleEvent(stamped: StampedEvent) {
    const { event } = stamped;
    switch (event.type) {
      case "chat.message.sent":
        this.handleChat(event.payload);
        break;
      case "channel.followed":
        this.followers.push({ name: event.payload.follower.username, at: Date.now() });
        break;
      case "channel.subscription.new":
        this.notable.push({
          text: `${event.payload.subscriber.username} just subscribed`,
          at: Date.now(),
        });
        break;
      case "kicks.gifted":
        this.notable.push({
          text: `${event.payload.sender.username} gifted ${event.payload.gift.amount} KICKs ("${event.payload.gift.message}")`,
          at: Date.now(),
        });
        break;
      default:
        break;
    }
  }

  private handleChat(payload: ChatMessageEvent) {
    if (payload.sender.user_id === SIDEKICK_BOT.user_id) return;

    const badges = payload.sender.identity?.badges ?? [];
    const isMod = badges.some((badge) => badge.type === "moderator");
    const isSub = badges.some((badge) => badge.type === "subscriber");

    if (this.handleCommand(payload, isMod)) return;

    // Use the payload timestamp so backdated warmup history lands in the
    // right rolling windows.
    const parsedAt = Date.parse(payload.created_at);
    const now = Number.isNaN(parsedAt) ? Date.now() : parsedAt;
    const words = tokenize(payload.content);
    const isQuestion =
      payload.content.includes("?") || QUESTION_START.test(payload.content.trim());

    if (!this.firstSeen.has(payload.sender.user_id)) {
      this.firstSeen.set(payload.sender.user_id, now);
    }
    const meta = this.senderMeta.get(payload.sender.user_id) ?? {
      name: payload.sender.username,
      isMod,
      isSub,
      messageCount: 0,
    };
    meta.messageCount += 1;
    this.senderMeta.set(payload.sender.user_id, meta);

    this.messages.push({
      at: now,
      senderId: payload.sender.user_id,
      senderName: payload.sender.username,
      content: payload.content,
      words,
      emoteIds: payload.emotes.map((emote) => emote.emote_id),
      isQuestion,
    });
    while (this.messages.length > 0) {
      const oldest = this.messages[0];
      if (!oldest || now - oldest.at <= WINDOW_MS) break;
      this.messages.shift();
    }

    if (isQuestion) this.assignToCluster(payload);
  }

  /** `!answered` from a mod or the streamer resolves the hottest digested cluster. */
  private handleCommand(payload: ChatMessageEvent, isMod: boolean): boolean {
    const text = payload.content.trim().toLowerCase();
    if (!text.startsWith("!answered")) return false;
    const canResolve = isMod || payload.sender.user_id === STREAMER.user_id;
    if (!canResolve) return true;

    const target = [...this.clusters.values()]
      .filter((cluster) => !cluster.answered)
      .sort((a, b) => Number(b.digested) - Number(a.digested) || b.count - a.count)[0];
    if (target) this.markAnswered(target.id);
    return true;
  }

  private assignToCluster(payload: ChatMessageEvent) {
    const tokens = questionTokens(payload.content);
    const now = new Date().toISOString();

    let best: InternalCluster | null = null;
    let bestScore = 0;
    for (const cluster of this.clusters.values()) {
      const score = overlap(tokens, cluster.tokens);
      if (score > bestScore) {
        best = cluster;
        bestScore = score;
      }
    }

    if (best && bestScore >= 0.3) {
      best.count += 1;
      best.askerIds.add(payload.sender.user_id);
      best.askers = [...new Set([...best.askers, payload.sender.username])];
      best.last_asked_at = now;
      for (const word of tokens) best.tokens.add(word);
      this.maybeDigest(best);
      return;
    }

    const cluster: InternalCluster = {
      id: crypto.randomUUID(),
      representative: payload.content,
      count: 1,
      askers: [payload.sender.username],
      first_asked_at: now,
      last_asked_at: now,
      answered: false,
      answer: null,
      digested: false,
      tokens,
      askerIds: new Set([payload.sender.user_id]),
    };
    this.clusters.set(cluster.id, cluster);
  }

  /** Posts the chat-native digest when a cluster crosses the threshold. */
  private maybeDigest(cluster: InternalCluster) {
    if (cluster.digested || cluster.answered) return;
    if (cluster.askerIds.size < DIGEST_THRESHOLD) return;
    cluster.digested = true;
    this.postBot(
      `📢 ${cluster.askerIds.size} people have asked: "${cluster.representative}" — reply !answered once covered`,
    );
  }

  markAnswered(clusterId: string): QuestionCluster | null {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) return null;
    cluster.answered = true;
    cluster.answer = this.answerFor(cluster);
    return cluster;
  }

  private answerFor(cluster: InternalCluster): string {
    for (const topic of QUESTION_TOPICS) {
      const topicTokens = questionTokens(topic.phrasings.join(" "));
      if (overlap(cluster.tokens, topicTokens) >= 0.3) return topic.answer;
    }
    return "The streamer covered this on stream a moment ago.";
  }

  /** Finds an answered cluster matching a fresh question (copilot recall). */
  findAnswered(question: string): QuestionCluster | null {
    const tokens = questionTokens(question);
    for (const cluster of this.clusters.values()) {
      if (cluster.answered && overlap(tokens, cluster.tokens) >= 0.3) return cluster;
    }
    return null;
  }

  // -- queries ---------------------------------------------------------------

  vibe(): VibeResult {
    const now = Date.now();
    const lastMinute = this.messages.filter((entry) => now - entry.at <= 60_000);
    const lastFive = this.messages.filter((entry) => now - entry.at <= 300_000);
    const perMinute = lastMinute.length;
    // Normalize the baseline by the actual span of history we hold (warmup
    // history is backdated, so engine age is not a reliable window size).
    const oldest = lastFive[0];
    const spanMinutes = oldest
      ? Math.max(1, Math.min(5, (now - oldest.at) / 60_000))
      : 1;
    const baseline = lastFive.length / spanMinutes;
    const emoteCount = lastMinute.filter((entry) => entry.emoteIds.length > 0).length;
    const emoteRatio = perMinute === 0 ? 0 : emoteCount / perMinute;
    const negatives = lastMinute.filter((entry) =>
      entry.words.some((word) => NEGATIVE_WORDS.has(word)),
    ).length;

    let vibe: Vibe = "chill";
    if (perMinute < 4) vibe = "dead";
    else if (perMinute >= 45 || (baseline > 0 && perMinute >= baseline * 2.2)) vibe = "hype";
    else if (negatives >= 5 && negatives / perMinute > 0.45) vibe = "tilted";

    const descriptions: Record<Vibe, string> = {
      hype: `Chat is popping off — ${perMinute} messages in the last minute, ${Math.round(emoteRatio * 100)}% with emotes.`,
      chill: `Chat is steady — about ${perMinute} messages a minute, relaxed energy.`,
      tilted: `Chat is tilted — lots of negativity in the last minute (${negatives} salty messages).`,
      dead: `Chat is quiet — only ${perMinute} messages in the last minute.`,
    };

    return {
      vibe,
      messages_per_minute: perMinute,
      baseline_per_minute: Math.round(baseline * 10) / 10,
      emote_ratio: Math.round(emoteRatio * 100) / 100,
      description: descriptions[vibe],
    };
  }

  trending(): TrendingResult {
    const now = Date.now();
    const recent = this.messages.filter((entry) => now - entry.at <= 90_000);
    const prior = this.messages.filter(
      (entry) => now - entry.at > 90_000 && now - entry.at <= 390_000,
    );

    const counts = new Map<string, number>();
    for (const message of recent) {
      for (const word of message.words) {
        if (STOPWORDS.has(word) || word.length < 2) continue;
        counts.set(word, (counts.get(word) ?? 0) + 1);
      }
    }
    const priorCounts = new Map<string, number>();
    for (const message of prior) {
      for (const word of message.words) {
        priorCounts.set(word, (priorCounts.get(word) ?? 0) + 1);
      }
    }

    const words = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word, count]) => {
        const before = priorCounts.get(word);
        // Prior window is 5 minutes vs recent 1.5 — normalize to rates.
        const delta =
          before && before > 0
            ? Math.round(((count / 1.5 - before / 5) / (before / 5)) * 100)
            : null;
        return { word, count, delta_pct: delta };
      });

    const emoteCounts = new Map<string, number>();
    for (const message of recent) {
      for (const id of message.emoteIds) {
        emoteCounts.set(id, (emoteCounts.get(id) ?? 0) + 1);
      }
    }
    const emotes = [...emoteCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([emote_id, count]) => ({
        emote_id,
        name: EMOTE_NAMES.get(emote_id) ?? emote_id,
        count,
      }));

    return { words, emotes };
  }

  questions(): QuestionCluster[] {
    return [...this.clusters.values()]
      .filter((cluster) => cluster.count >= 2 || cluster.digested)
      .sort(
        (a, b) =>
          Number(a.answered) - Number(b.answered) ||
          b.count - a.count ||
          b.last_asked_at.localeCompare(a.last_asked_at),
      )
      .map(({ tokens: _tokens, askerIds: _askerIds, ...publicCluster }) => publicCluster);
  }

  chatters(): ChattersResult {
    const now = Date.now();
    const windowStart = now - 10 * 60_000;
    const active = new Map<number, TrackedMessage>();
    for (const message of this.messages) {
      if (message.at >= windowStart) active.set(message.senderId, message);
    }

    const firstTimers: string[] = [];
    const mods: string[] = [];
    const subs: string[] = [];
    for (const senderId of active.keys()) {
      const meta = this.senderMeta.get(senderId);
      if (!meta) continue;
      const seenAt = this.firstSeen.get(senderId) ?? 0;
      if (seenAt >= windowStart && meta.messageCount <= 3) firstTimers.push(meta.name);
      if (meta.isMod) mods.push(meta.name);
      else if (meta.isSub) subs.push(meta.name);
    }

    return {
      active_last_10m: active.size,
      first_timers: firstTimers,
      mods_active: mods,
      subs_active: subs,
      recent_followers: this.followers
        .filter((entry) => now - entry.at <= 10 * 60_000)
        .map((entry) => entry.name),
      notable: this.notable
        .filter((entry) => now - entry.at <= 10 * 60_000)
        .map((entry) => entry.text),
    };
  }

  context(): StreamContext {
    return {
      streamer: STREAMER.username,
      title: STREAM_INFO.title,
      category: STREAM_INFO.category.name,
      uptime_minutes:
        STREAM_INFO.started_minutes_ago +
        Math.floor((Date.now() - this.startedAt) / 60_000),
      viewer_count: STREAM_INFO.viewer_count,
      streamer_primer: `${STREAMER.username} is a competitive ${STREAM_INFO.category.name} streamer grinding to Top 500 ranked — day 3 of the challenge. Known for aggressive movement plays and reading chat between games.`,
    };
  }
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

// The engine is stored on the chat-engine instance (not module state) so
// Next.js dev hot reloads — which re-evaluate this module — keep the same
// engine and its accumulated history.
type EngineWithInsights = ChatEngine & { __insights?: InsightEngine };

export function getInsights(engine: ChatEngine): InsightEngine {
  const holder = engine as EngineWithInsights;
  if (!holder.__insights) {
    const insights = new InsightEngine((content) => {
      void engine.postBotMessage(content).catch((error: unknown) => {
        console.error("[insights] digest post failed:", error);
      });
    });
    holder.__insights = insights;
    // Backfill from seq 1 so anything published before we attached (warmup,
    // dev auto-start) is still processed.
    engine.subscribe((stamped) => insights.handleEvent(stamped), { fromSeq: 1 });
  }
  return holder.__insights;
}
