"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Check,
  Gift,
  MessageSquare,
  Radio,
  Send,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Wrench,
  Zap,
} from "lucide-react";

import { KickStreamConnector } from "@/components/kick-stream-connector";
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
import { Input } from "@/components/ui/input";
import { useConnectedKickStream } from "@/hooks/use-connected-kick-stream";
import { useKickStreamEvents } from "@/hooks/use-kick-stream-events";
import { useSidekickAgentChat } from "@/hooks/use-sidekick-agent-chat";
import { apiClient } from "@/lib/api-client";
import type { StampedEvent } from "@/lib/chat-engine/types";
import type {
  ChattersResult,
  QuestionCluster,
  StreamContext,
  TrendingResult,
  Vibe,
  VibeResult,
} from "@/lib/sidekick/insights";

type QuestionsResponse = { questions: QuestionCluster[] };

type ChatLine = {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  tone: "message" | "system" | "sidekick";
  color?: string;
};

const INSIGHT_REFETCH_MS = 2_000;

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

function displayVibe(vibe?: Vibe) {
  const labels: Record<Vibe, string> = {
    hype: "Hype spike",
    chill: "Chill",
    tilted: "Tilted",
    dead: "Quiet",
  };
  return vibe ? labels[vibe] : "Loading";
}

function formatDelta(delta: number | null) {
  if (delta === null) return "new";
  return `${delta > 0 ? "+" : ""}${delta}%`;
}

function toChatLine(wrapped: StampedEvent): ChatLine {
  const { event } = wrapped;
  const id = String(wrapped.seq);

  switch (event.type) {
    case "chat.message.sent":
      return {
        id,
        author: event.payload.sender.username,
        content: stripKickMarkup(event.payload.content),
        timestamp: event.payload.created_at,
        tone: event.payload.sender.username === "Sidekick" ? "sidekick" : "message",
        color: event.payload.sender.identity?.username_color,
      };
    case "channel.followed":
      return {
        id,
        author: "Follow",
        content: `${event.payload.follower.username} joined the stream`,
        timestamp: wrapped.received_at,
        tone: "system",
      };
    case "channel.subscription.new":
    case "channel.subscription.renewal":
      return {
        id,
        author: "Sub",
        content: `${event.payload.subscriber.username} · ${event.payload.duration} month${event.payload.duration === 1 ? "" : "s"}`,
        timestamp: event.payload.created_at,
        tone: "system",
      };
    case "channel.subscription.gifts":
      return {
        id,
        author: "Gift subs",
        content: `${event.payload.gifter.username} gifted ${event.payload.giftees.length} subs`,
        timestamp: event.payload.created_at,
        tone: "system",
      };
    case "kicks.gifted":
      return {
        id,
        author: "Kicks",
        content: `${event.payload.sender.username} sent ${event.payload.gift.amount}: ${event.payload.gift.message}`,
        timestamp: event.payload.created_at,
        tone: "system",
      };
    case "livestream.status.updated":
      return {
        id,
        author: "Stream",
        content: event.payload.is_live ? "Went live" : "Ended",
        timestamp: event.payload.started_at,
        tone: "system",
      };
    case "livestream.metadata.updated":
      return {
        id,
        author: "Stream",
        content: event.payload.metadata.title,
        timestamp: wrapped.received_at,
        tone: "system",
      };
    case "moderation.banned":
      return {
        id,
        author: "Mod",
        content: `${event.payload.banned_user.username} was banned: ${event.payload.metadata.reason}`,
        timestamp: event.payload.metadata.created_at,
        tone: "system",
      };
    case "channel.reward.redemption.updated":
      return {
        id,
        author: "Reward",
        content: `${event.payload.redeemer.username} redeemed ${event.payload.reward.title}: ${event.payload.user_input}`,
        timestamp: event.payload.redeemed_at,
        tone: "system",
      };
  }
}

async function getInsight<T>(path: string): Promise<T> {
  const response = await apiClient.get<T>(path);
  return response.data;
}

async function triggerDemo(scenario: "hype_spike" | "question_flood" | "new_viewer") {
  await fetch("/api/demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "trigger", scenario }),
  });
}

export default function StreamDashboardPage() {
  const queryClient = useQueryClient();
  const { stream: connectedStream } = useConnectedKickStream();
  const { events, connectionState } = useKickStreamEvents({ maxEvents: 160 });
  const {
    messages: agentMessages,
    sendMessage: askAgent,
    isPending: agentPending,
    isError: agentError,
  } = useSidekickAgentChat();
  const [agentQuestion, setAgentQuestion] = useState("");

  const vibeQuery = useQuery({
    queryKey: ["insights", "vibe"],
    queryFn: () => getInsight<VibeResult>("/insights/vibe"),
    refetchInterval: INSIGHT_REFETCH_MS,
  });
  const questionsQuery = useQuery({
    queryKey: ["insights", "questions"],
    queryFn: () => getInsight<QuestionsResponse>("/insights/questions"),
    refetchInterval: INSIGHT_REFETCH_MS,
  });
  const trendingQuery = useQuery({
    queryKey: ["insights", "trending"],
    queryFn: () => getInsight<TrendingResult>("/insights/trending"),
    refetchInterval: INSIGHT_REFETCH_MS,
  });
  const chattersQuery = useQuery({
    queryKey: ["insights", "chatters"],
    queryFn: () => getInsight<ChattersResult>("/insights/chatters"),
    refetchInterval: INSIGHT_REFETCH_MS,
  });
  const contextQuery = useQuery({
    queryKey: ["insights", "context"],
    queryFn: () => getInsight<StreamContext>("/insights/context"),
    refetchInterval: 10_000,
  });

  const answerMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/insights/questions/${encodeURIComponent(id)}/answered`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["insights", "questions"] });
    },
  });

  const questions = questionsQuery.data?.questions ?? [];
  const openQuestions = questions.filter((question) => !question.answered);
  const answeredQuestions = questions.filter((question) => question.answered);
  const topQuestion = openQuestions[0];
  const vibe = vibeQuery.data;
  const trending = trendingQuery.data;
  const chatters = chattersQuery.data;
  const streamContext = contextQuery.data;
  const streamer = connectedStream?.slug ?? streamContext?.streamer ?? "streamer";

  const chatLines = useMemo(
    () =>
      events
        .map(toChatLine)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .slice(-80),
    [events],
  );
  const lastAgentAnswer = [...agentMessages]
    .reverse()
    .find((message) => message.role === "assistant");

  function submitAgentQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = agentQuestion.trim();
    if (!question || agentPending) return;
    askAgent(question);
    setAgentQuestion("");
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <div className="flex items-center">
            <span className="font-brand text-2xl leading-none text-primary">KICK</span>
            <span aria-hidden="true" className="mx-3 h-5 w-px bg-border" />
            <span className="text-sm font-semibold">Sidekick</span>
          </div>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Streamer view
          </span>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden max-w-40 truncate text-xs text-muted-foreground md:inline">
              @{streamer}
            </span>
            <Badge variant={connectionState === "live" ? "default" : "outline"}>
              <Radio className="size-3" />
              {connectionState}
            </Badge>
          </div>
        </div>
      </header>

      <section className="shrink-0 border-b bg-background px-4 py-2 sm:px-6">
        <div className="mx-auto w-full max-w-6xl">
          <KickStreamConnector />
        </div>
      </section>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
          <section className="min-w-0 space-y-4">
            <Card className="border-primary/30 bg-card">
              <CardHeader className="border-b">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    Stream insights
                  </CardTitle>
                  <CardDescription>
                    {streamContext
                      ? `${streamContext.title} · ${streamContext.viewer_count.toLocaleString()} viewers · ${streamContext.uptime_minutes}m live`
                      : "Reading live chat context…"}
                  </CardDescription>
                </div>
                <CardAction className="hidden items-center gap-1 sm:flex">
                  <Button size="xs" variant="outline" onClick={() => void triggerDemo("new_viewer")}>
                    New viewer
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => void triggerDemo("question_flood")}>
                    Questions
                  </Button>
                  <Button size="xs" onClick={() => void triggerDemo("hype_spike")}>
                    Hype
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
                <div className="min-w-0 rounded-lg border bg-background p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    Priority signal
                  </p>
                  {topQuestion ? (
                    <div className="mt-3 space-y-3">
                      <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                          {topQuestion.count}x repeated question
                        </h1>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          “{stripKickMarkup(topQuestion.representative)}”
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {topQuestion.askers.slice(0, 4).map((asker) => (
                          <Badge key={asker} variant="outline">
                            @{asker}
                          </Badge>
                        ))}
                      </div>
                      <Button
                        disabled={answerMutation.isPending}
                        onClick={() => answerMutation.mutate(topQuestion.id)}
                        size="sm"
                      >
                        <Check className="size-3.5" />
                        Mark answered
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <h1 className="text-2xl font-semibold tracking-tight">
                        {displayVibe(vibe?.vibe)}
                      </h1>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {vibe?.description ?? "Waiting for enough chat activity to classify the stream."}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                  <InsightMetric
                    label="Chat speed"
                    value={`${vibe?.messages_per_minute ?? 0}/min`}
                    detail={`baseline ${vibe?.baseline_per_minute ?? 0}/min`}
                  />
                  <InsightMetric
                    label="Emote ratio"
                    value={`${Math.round((vibe?.emote_ratio ?? 0) * 100)}%`}
                    detail="last minute"
                  />
                </div>
              </CardContent>
            </Card>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InsightMetric
                icon={<Zap className="size-4" />}
                label="Vibe"
                value={displayVibe(vibe?.vibe)}
                detail="engine classifier"
              />
              <InsightMetric
                icon={<MessageSquare className="size-4" />}
                label="Open questions"
                value={String(openQuestions.length)}
                detail={`${answeredQuestions.length} answered`}
              />
              <InsightMetric
                icon={<Users className="size-4" />}
                label="Active chatters"
                value={String(chatters?.active_last_10m ?? 0)}
                detail="last 10 min"
              />
              <InsightMetric
                icon={<UserPlus className="size-4" />}
                label="New follows"
                value={`+${chatters?.recent_followers.length ?? 0}`}
                detail="welcome on lull"
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <Card size="sm" className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Question clusters</CardTitle>
                  <CardDescription>Repeated asks from the engine.</CardDescription>
                </CardHeader>
                <CardContent>
                  {questions.length ? (
                    <ol className="space-y-2">
                      {questions.slice(0, 4).map((question) => (
                        <li key={question.id} className="rounded-lg border bg-background p-3">
                          <div className="flex items-center gap-2">
                            <Badge variant={question.answered ? "secondary" : "default"}>
                              {question.count}x
                            </Badge>
                            {question.digested ? <Badge variant="outline">digested</Badge> : null}
                            {question.answered ? <Badge variant="outline">answered</Badge> : null}
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm font-medium">
                            {stripKickMarkup(question.representative)}
                          </p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <EmptyState text="No repeated questions yet." />
                  )}
                </CardContent>
              </Card>

              <Card size="sm" className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="size-4 text-primary" />
                    Trending
                  </CardTitle>
                  <CardDescription>Words and emotes moving now.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {(trending?.words.length ? trending.words : []).slice(0, 8).map((word) => (
                      <Badge key={word.word} variant="outline">
                        {word.word} · {word.count} · {formatDelta(word.delta_pct)}
                      </Badge>
                    ))}
                    {!trending?.words.length ? <EmptyState text="No word trend yet." /> : null}
                  </div>
                  {trending?.emotes.length ? (
                    <div className="border-t pt-3">
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">Emotes</p>
                      <div className="flex flex-wrap gap-2">
                        {trending.emotes.map((emote) => (
                          <Badge key={emote.emote_id} variant="secondary">
                            {emote.name} × {emote.count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card size="sm" className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Community</CardTitle>
                  <CardDescription>People worth noticing.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <InsightList
                    icon={<UserPlus className="size-3.5" />}
                    label="First timers"
                    values={chatters?.first_timers ?? []}
                    empty="No new chatters yet."
                  />
                  <InsightList
                    icon={<Gift className="size-3.5" />}
                    label="Notable"
                    values={chatters?.notable ?? []}
                    empty="No subs or gifts in the last 10 min."
                    prefixAt={false}
                  />
                </CardContent>
              </Card>
            </section>
          </section>

          <aside className="min-h-0 space-y-4">
            <Card size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="size-4 text-primary" />
                  Ask Sidekick
                </CardTitle>
                <CardDescription>Same tool-backed agent as viewer chat.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="min-h-24 rounded-lg border bg-background p-3">
                  {lastAgentAnswer ? (
                    <div className="space-y-2">
                      {lastAgentAnswer.toolCalls?.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {lastAgentAnswer.toolCalls.slice(0, 3).map((toolCall) => (
                            <Badge key={`${lastAgentAnswer.id}-${toolCall.tool}`} variant="outline">
                              <Wrench className="size-3" />
                              {toolCall.tool}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                      <p className="line-clamp-4 text-sm leading-6">{lastAgentAnswer.content}</p>
                    </div>
                  ) : (
                    <p className="text-sm leading-6 text-muted-foreground">
                      Try “what should I answer?” or “what is chat reacting to?”
                    </p>
                  )}
                </div>
                <form className="flex gap-2" onSubmit={submitAgentQuestion}>
                  <Input
                    aria-label="Ask Sidekick"
                    className="h-9 bg-background"
                    disabled={agentPending}
                    onChange={(event) => setAgentQuestion(event.target.value)}
                    placeholder="Ask about vibe, questions, trends…"
                    value={agentQuestion}
                  />
                  <Button
                    aria-label="Ask Sidekick"
                    className="size-9 shrink-0"
                    disabled={agentPending || !agentQuestion.trim()}
                    size="icon"
                    type="submit"
                  >
                    <Send className="size-4" />
                  </Button>
                </form>
                {agentError ? (
                  <p className="text-xs text-destructive" role="alert">
                    Sidekick missed that — try again.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card size="sm" className="min-h-[24rem]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-primary" />
                  Live chat
                </CardTitle>
                <CardDescription>{events.length} recent KICK events</CardDescription>
              </CardHeader>
              <CardContent className="min-h-0">
                <div className="max-h-[32rem] overflow-y-auto rounded-lg border bg-background p-2" aria-live="polite">
                  {chatLines.length === 0 ? (
                    <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                      <Users className="size-8" />
                      <p>Waiting for chat events…</p>
                    </div>
                  ) : (
                    <ol className="space-y-1.5">
                      {chatLines.slice(-24).map((line) => (
                        <li key={line.id} className="rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
                          <div className="mb-0.5 flex items-center gap-2">
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {formatTime(line.timestamp)}
                            </span>
                            <span
                              className={line.tone === "sidekick" ? "font-semibold text-primary" : "font-semibold"}
                              style={line.color ? { color: line.color } : undefined}
                            >
                              {line.author}
                            </span>
                          </div>
                          <p className={line.tone === "system" ? "text-muted-foreground" : "text-foreground"}>
                            {line.content}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}

function InsightMetric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {icon ? <span className="text-primary">{icon}</span> : null}
        {label}
      </div>
      <div className="mt-2 truncate text-2xl font-semibold text-primary">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function InsightList({
  label,
  values,
  empty,
  icon,
  prefixAt = true,
}: {
  label: string;
  values: string[];
  empty: string;
  icon: ReactNode;
  prefixAt?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </p>
      {values.length ? (
        <div className="flex flex-wrap gap-2">
          {values.slice(0, 5).map((value) => (
            <Badge key={value} variant="outline">
              {prefixAt && !value.startsWith("@") ? `@${value}` : value}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}
