"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Radio, Sparkles, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TypographyH1,
  TypographyMuted,
  TypographySmall,
} from "@/components/ui/typography";
import { STREAM_INFO } from "@/lib/sidekick/personas";
import type { SidekickEvent } from "@/lib/sidekick/types";

const MESSAGE_WINDOW_MS = 60_000;
const INSIGHT_WINDOW_MS = 5 * 60_000;

const QUESTION_CLUSTERS = [
  {
    id: "sens",
    label: "Sensitivity / DPI",
    keywords: ["sens", "sensitivity", "dpi", "mouse settings"],
    answer: "800 DPI, 0.8 in-game.",
  },
  {
    id: "loadout",
    label: "Current loadout",
    keywords: ["loadout", "class", "smg", "gun", "attachments", "build"],
    answer: "Drop !loadout or pin the HRM-9 build.",
  },
  {
    id: "schedule",
    label: "Stream schedule",
    keywords: ["schedule", "tomorrow", "next stream", "how long", "what time"],
    answer: "Daily Top 500 grind, usually 7pm AEST.",
  },
] as const;

const STOP_WORDS = new Set([
  "this",
  "that",
  "with",
  "what",
  "whats",
  "your",
  "have",
  "just",
  "from",
  "they",
  "stream",
  "chat",
  "the",
  "and",
  "you",
  "for",
  "are",
  "was",
  "how",
  "did",
  "can",
  "its",
  "lol",
]);

type ConnectionState = "connecting" | "live" | "reconnecting";

type ChatLine = {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  tone: "message" | "system" | "streamer" | "sidekick";
  color?: string;
};

type ChatMessageSidekickEvent = SidekickEvent & {
  event: Extract<SidekickEvent["event"], { type: "chat.message.sent" }>;
};

function stripKickMarkup(content: string) {
  return content.replace(/\[emote:[^:\]]+:([^\]]+)\]/g, ":$1:").trim();
}

function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function isChatMessageEvent(event: SidekickEvent): event is ChatMessageSidekickEvent {
  return event.event.type === "chat.message.sent";
}

function isQuestion(content: string) {
  const lower = content.toLowerCase().trim();
  return (
    lower.includes("?") ||
    /^(what|whats|when|where|why|how|who|can|do|does|did|is|are|will|should)\b/.test(
      lower,
    )
  );
}

function questionClusterFor(content: string) {
  const lower = content.toLowerCase();
  return (
    QUESTION_CLUSTERS.find((cluster) =>
      cluster.keywords.some((keyword) => lower.includes(keyword)),
    ) ?? {
      id: "general",
      label: "General questions",
      answer: "Answer the latest repeat question out loud, then mark it answered.",
    }
  );
}

function toChatLine(wrapped: SidekickEvent): ChatLine {
  const { event } = wrapped;

  switch (event.type) {
    case "chat.message.sent":
      return {
        id: wrapped.id,
        author: event.payload.sender.username,
        content: stripKickMarkup(event.payload.content),
        timestamp: event.payload.created_at,
        tone: event.payload.sender.username === "Sidekick" ? "sidekick" : "message",
        color: event.payload.sender.identity?.username_color,
      };
    case "channel.followed":
      return {
        id: wrapped.id,
        author: "Sidekick",
        content: `${event.payload.follower.username} followed the channel. Say hi when there is a lull.`,
        timestamp: wrapped.received_at,
        tone: "system",
      };
    case "channel.subscription.new":
    case "channel.subscription.renewal":
      return {
        id: wrapped.id,
        author: "Sidekick",
        content: `${event.payload.subscriber.username} subscribed for ${event.payload.duration} month${event.payload.duration === 1 ? "" : "s"}.`,
        timestamp: event.payload.created_at,
        tone: "system",
      };
    case "channel.subscription.gifts":
      return {
        id: wrapped.id,
        author: "Sidekick",
        content: `${event.payload.gifter.username} gifted ${event.payload.giftees.length} subs.`,
        timestamp: event.payload.created_at,
        tone: "system",
      };
    case "kicks.gifted":
      return {
        id: wrapped.id,
        author: "Sidekick",
        content: `${event.payload.sender.username} sent ${event.payload.gift.amount} kicks: ${event.payload.gift.message}`,
        timestamp: event.payload.created_at,
        tone: "system",
      };
    case "livestream.status.updated":
      return {
        id: wrapped.id,
        author: "Sidekick",
        content: event.payload.is_live ? "Stream went live." : "Stream ended.",
        timestamp: event.payload.started_at,
        tone: "system",
      };
    case "livestream.metadata.updated":
      return {
        id: wrapped.id,
        author: "Sidekick",
        content: `Stream updated: ${event.payload.metadata.title}`,
        timestamp: wrapped.received_at,
        tone: "system",
      };
    case "moderation.banned":
      return {
        id: wrapped.id,
        author: "Mod action",
        content: `${event.payload.banned_user.username} was banned: ${event.payload.metadata.reason}`,
        timestamp: event.payload.metadata.created_at,
        tone: "system",
      };
    case "channel.reward.redemption.updated":
      return {
        id: wrapped.id,
        author: "Reward",
        content: `${event.payload.redeemer.username} redeemed ${event.payload.reward.title}: ${event.payload.user_input}`,
        timestamp: event.payload.redeemed_at,
        tone: "system",
      };
  }
}

function deriveInsights(events: SidekickEvent[]) {
  const now = Date.now();
  const recent = events.filter(
    (event) => now - new Date(event.received_at).getTime() <= INSIGHT_WINDOW_MS,
  );
  const recentMinute = events.filter(
    (event) => now - new Date(event.received_at).getTime() <= MESSAGE_WINDOW_MS,
  );
  const chatMessages = recent.filter(isChatMessageEvent);
  const chatMessagesPerMinute = recentMinute.filter(isChatMessageEvent).length;
  const uniqueChatters = new Set(
    chatMessages.map((event) => event.event.payload.sender.username),
  );
  const newFollows = recent.filter((event) => event.event.type === "channel.followed").length;
  const questions = chatMessages.filter((event) =>
    isQuestion(stripKickMarkup(event.event.payload.content)),
  );

  const clusterCounts = new Map<
    string,
    { label: string; answer: string; count: number }
  >();
  for (const question of questions) {
    const cluster = questionClusterFor(stripKickMarkup(question.event.payload.content));
    const current = clusterCounts.get(cluster.id) ?? {
      label: cluster.label,
      answer: cluster.answer,
      count: 0,
    };
    clusterCounts.set(cluster.id, { ...current, count: current.count + 1 });
  }

  const topQuestion = [...clusterCounts.values()].sort((a, b) => b.count - a.count)[0];
  const hypeCount = chatMessages.filter((event) => {
    const content = stripKickMarkup(event.event.payload.content).toLowerCase();
    return /\b(w|clip|insane|no way|lets go|hype|kekw|hyperclap)\b/.test(content);
  }).length;

  const terms = new Map<string, number>();
  for (const message of chatMessages) {
    const words = stripKickMarkup(message.event.payload.content)
      .toLowerCase()
      .replace(/[^a-z0-9:_\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
    for (const word of words) terms.set(word, (terms.get(word) ?? 0) + 1);
  }
  const topTerms = [...terms.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([word]) => word.replaceAll(":", ""));

  const vibe =
    hypeCount >= 8 || chatMessagesPerMinute >= 24
      ? "Hype spike"
      : questions.length >= 5
        ? "Question-heavy"
        : chatMessagesPerMinute >= 10
          ? "Active"
          : "Steady";

  return {
    chatMessagesPerMinute,
    uniqueChatters: uniqueChatters.size,
    newFollows,
    questions: questions.length,
    topQuestion,
    topTerms,
    vibe,
  };
}

async function triggerDemo(action: "hype" | "question_flood" | "new_viewer") {
  await fetch("/api/demo/trigger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
}

export default function StreamDashboardPage() {
  const [events, setEvents] = useState<SidekickEvent[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");

  useEffect(() => {
    const source = new EventSource("/api/stream/events");

    source.onopen = () => setConnectionState("live");
    source.onerror = () => setConnectionState("reconnecting");
    source.onmessage = (message) => {
      const incoming = JSON.parse(message.data) as SidekickEvent;
      setEvents((current) => [...current, incoming].slice(-160));
      setConnectionState("live");
    };

    return () => source.close();
  }, []);

  const insights = useMemo(() => deriveInsights(events), [events]);
  const chatLines = useMemo(
    () =>
      events
        .map(toChatLine)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .slice(-80),
    [events],
  );

  return (
    <main className="relative isolate h-dvh max-h-dvh overflow-hidden px-3 py-3">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(83,252,24,0.18),transparent_34%),linear-gradient(135deg,#0b0b0c_0%,#171a1c_48%,#0b0b0c_100%)]"
      />

      <div className="mx-auto flex h-full min-h-0 w-full max-w-[390px] flex-col gap-3">
        <header className="flex shrink-0 flex-wrap items-end justify-between gap-2">
          <div>
            <TypographySmall className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
              Streamer cockpit
            </TypographySmall>
            <TypographyH1 className="text-3xl uppercase">
              Stream dashboard
            </TypographyH1>
          </div>
          <Badge variant={connectionState === "live" ? "default" : "outline"}>
            <Radio className="size-3" />
            {connectionState}
          </Badge>
        </header>

        <Card size="sm" className="shrink-0 border-primary/25 bg-card/90 shadow-2xl shadow-black/30 backdrop-blur-sm">
          <CardHeader className="gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg uppercase">
                <Sparkles className="size-5 text-primary" />
                Stream insights
              </CardTitle>
              <CardDescription className="text-xs">
                {STREAM_INFO.viewer_count.toLocaleString()} viewers · {STREAM_INFO.started_minutes_ago}m live
              </CardDescription>
            </div>
            <CardAction className="col-start-1 row-start-auto flex flex-wrap gap-1.5 justify-self-start">
              <Button size="sm" variant="outline" onClick={() => void triggerDemo("new_viewer")}>New viewer</Button>
              <Button size="sm" variant="outline" onClick={() => void triggerDemo("question_flood")}>Question flood</Button>
              <Button size="sm" onClick={() => void triggerDemo("hype")}>Hype spike</Button>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-3">
            <section className="grid grid-cols-2 gap-3">
              <InsightStat label="Vibe" value={insights.vibe} detail="last 5 min" />
              <InsightStat label="Chat speed" value={`${insights.chatMessagesPerMinute}/min`} detail={`${insights.uniqueChatters} active chatters`} />
              <InsightStat label="Questions" value={String(insights.questions)} detail="needs streamer attention" />
              <InsightStat label="New follows" value={`+${insights.newFollows}`} detail="welcome when safe" />
            </section>

            <section className="rounded-xl border bg-muted/40 p-3">
              <TypographySmall className="mb-2 block uppercase tracking-[0.18em] text-primary">
                Next best action
              </TypographySmall>
              <p className="text-lg font-semibold">
                {insights.topQuestion
                  ? `${insights.topQuestion.count} people are asking about ${insights.topQuestion.label.toLowerCase()}.`
                  : "No repeated question yet — keep playing."}
              </p>
              <TypographyMuted className="mt-2">
                {insights.topQuestion
                  ? `Suggested answer: ${insights.topQuestion.answer}`
                  : "Sidekick will surface the first cluster as soon as chat repeats it."}
              </TypographyMuted>
              <div className="mt-4 flex flex-wrap gap-2">
                {(insights.topTerms.length ? insights.topTerms : ["rotation", "loadout", "clip"]).map((term) => (
                  <Badge key={term} variant="outline">#{term}</Badge>
                ))}
              </div>
            </section>
          </CardContent>
        </Card>

        <Card size="sm" className="min-h-0 flex-1 bg-card/90 shadow-2xl shadow-black/30 backdrop-blur-sm">
          <CardHeader className="shrink-0">
            <CardTitle className="flex items-center gap-2 text-lg uppercase">
              <MessageSquare className="size-5 text-primary" />
              Chat box
            </CardTitle>
            <CardDescription className="text-xs">
              Live KICK chat from the streamer view.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            <div className="h-full overflow-hidden rounded-xl border bg-background/70 p-3" aria-live="polite">
              {chatLines.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                  <Users className="size-8" />
                  <p>Waiting for chat events…</p>
                </div>
              ) : (
                <ol className="space-y-2">
                  {chatLines.slice(-10).map((line) => (
                    <li
                      key={line.id}
                      className="grid grid-cols-[3.75rem_1fr] gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted/40"
                    >
                      <span className="pt-0.5 font-mono text-xs text-muted-foreground">
                        {formatTime(line.timestamp)}
                      </span>
                      <p>
                        <span
                          className={line.tone === "streamer" ? "font-semibold text-primary" : "font-semibold"}
                          style={line.color ? { color: line.color } : undefined}
                        >
                          {line.author}
                        </span>
                        <span className="text-muted-foreground">: </span>
                        <span className={line.tone === "system" ? "text-muted-foreground" : "text-foreground"}>
                          {line.content}
                        </span>
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function InsightStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border bg-background/60 p-3">
      <TypographyMuted className="text-xs font-semibold uppercase tracking-[0.18em]">
        {label}
      </TypographyMuted>
      <div className="mt-2 text-2xl font-bold text-primary">{value}</div>
      <TypographyMuted className="mt-2">{detail}</TypographyMuted>
    </div>
  );
}
