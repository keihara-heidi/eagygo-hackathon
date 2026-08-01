"use client";

import { useMemo } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Check,
  MessageSquare,
  Radio,
  Sparkles,
  Users,
} from "lucide-react";

import { KickChatContent, kickContentToPlainText } from "@/components/kick-chat-content";
import { KickStreamConnector } from "@/components/kick-stream-connector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useConnectedKickStream } from "@/hooks/use-connected-kick-stream";
import { useKickStreamEvents } from "@/hooks/use-kick-stream-events";
import { apiClient } from "@/lib/api-client";
import type { StampedEvent } from "@/lib/chat-engine/types";
import type { KickEmote } from "@/lib/kick/types";
import type { QuestionCluster } from "@/lib/sidekick/insights";

type QuestionsResponse = { questions: QuestionCluster[] };

type KickStreamDetailsResponse = {
  stream: {
    slug: string;
    url: string;
    broadcaster_user_id: number;
    title: string;
    category_name: string;
    is_live: boolean;
    viewer_count: number;
    started_at: string | null;
  };
};

type ChatLine = {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  tone: "message" | "system" | "sidekick";
  color?: string;
  emotes?: KickEmote[];
};

const INSIGHT_REFETCH_MS = 2_000;
const QUESTIONS_QUERY_KEY = ["insights", "questions"] as const;

function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function toChatLine(wrapped: StampedEvent): ChatLine {
  const { event } = wrapped;
  const id = String(wrapped.seq);

  switch (event.type) {
    case "chat.message.sent":
      return {
        id,
        author: event.payload.sender.username,
        content: event.payload.content,
        timestamp: event.payload.created_at,
        tone: event.payload.sender.username === "Sidekick" ? "sidekick" : "message",
        color: event.payload.sender.identity?.username_color,
        emotes: event.payload.emotes,
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

function minutesSince(timestamp?: string | null) {
  if (!timestamp) return null;
  const startedAt = Date.parse(timestamp);
  if (Number.isNaN(startedAt)) return null;
  return Math.max(0, Math.floor((Date.now() - startedAt) / 60_000));
}

function mergeQuestionsInMemory(
  current: QuestionCluster[],
  incoming: QuestionCluster[],
) {
  if (incoming.length === 0) return current;

  const cache = new Map(current.map((question) => [question.id, question]));
  const incomingIds = new Set<string>();
  const orderedIncoming: QuestionCluster[] = [];

  for (const question of incoming) {
    if (incomingIds.has(question.id)) continue;
    incomingIds.add(question.id);
    const merged = { ...cache.get(question.id), ...question };
    cache.set(question.id, merged);
    orderedIncoming.push(merged);
  }

  return [
    ...orderedIncoming,
    ...current.filter((question) => !incomingIds.has(question.id)),
  ];
}

export default function StreamDashboardPage() {
  const queryClient = useQueryClient();
  const { stream: connectedStream } = useConnectedKickStream();
  const streamEndpoint = useMemo(() => {
    const broadcasterUserId = connectedStream?.broadcasterUserId;
    return broadcasterUserId
      ? `/api/stream?broadcasterUserId=${broadcasterUserId}`
      : "/api/stream";
  }, [connectedStream?.broadcasterUserId]);
  const { events, connectionState } = useKickStreamEvents({
    endpoint: streamEndpoint,
    maxEvents: 160,
  });
  const connectedSlug = connectedStream?.slug;

  const questionsQuery = useQuery({
    queryKey: QUESTIONS_QUERY_KEY,
    queryFn: async () => {
      const response = await getInsight<QuestionsResponse>("/insights/questions");
      const previous = queryClient.getQueryData<QuestionsResponse>(QUESTIONS_QUERY_KEY);
      return {
        questions: mergeQuestionsInMemory(previous?.questions ?? [], response.questions),
      };
    },
    placeholderData: keepPreviousData,
    refetchInterval: INSIGHT_REFETCH_MS,
    refetchIntervalInBackground: true,
    staleTime: INSIGHT_REFETCH_MS,
  });
  const streamDetailsQuery = useQuery({
    queryKey: ["kick", "stream", connectedSlug],
    enabled: connectedSlug !== undefined,
    queryFn: () => {
      if (!connectedSlug) throw new Error("No connected stream");
      return getInsight<KickStreamDetailsResponse>(
        `/kick/streams/${encodeURIComponent(connectedSlug)}`,
      );
    },
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    staleTime: 15_000,
  });

  const answerMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/insights/questions/${encodeURIComponent(id)}/answered`);
    },
    onSuccess: async (_data, id) => {
      queryClient.setQueryData<QuestionsResponse>(QUESTIONS_QUERY_KEY, (current) => ({
        questions: (current?.questions ?? []).map((question) =>
          question.id === id
            ? { ...question, answered: true, answered_at: new Date().toISOString() }
            : question,
        ),
      }));
      await queryClient.invalidateQueries({ queryKey: QUESTIONS_QUERY_KEY });
    },
  });

  const questions = questionsQuery.data?.questions ?? [];
  const questionsReady = questionsQuery.data !== undefined;
  const streamDetails = streamDetailsQuery.data?.stream;
  const streamer = connectedStream?.slug ?? "streamer";
  const streamTitle = streamDetails?.title ?? connectedStream?.title;
  const viewerCount = streamDetails?.viewer_count ?? connectedStream?.viewerCount;
  const uptimeMinutes = minutesSince(streamDetails?.started_at ?? connectedStream?.startedAt);
  const isLive = streamDetails?.is_live ?? connectedStream?.isLive ?? false;
  const streamSummary = connectedStream
    ? [
        streamTitle ?? `@${streamer}`,
        typeof viewerCount === "number" ? `${viewerCount.toLocaleString()} viewers` : null,
        uptimeMinutes !== null ? `${uptimeMinutes}m live` : isLive ? "live" : "offline",
      ]
        .filter(Boolean)
        .join(" · ")
    : "Connect a KICK stream for live title and viewers.";

  const chatLines = useMemo(
    () =>
      events
        .map(toChatLine)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .slice(-80),
    [events],
  );
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
        <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.75fr)] xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
          <section className="min-w-0 space-y-4">
            <Card className="border-primary/30 bg-card">
              <CardHeader className="border-b">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    Question clusters
                  </CardTitle>
                  <CardDescription className="break-words">{streamSummary}</CardDescription>
                </div>

              </CardHeader>
              <CardContent>
                {questions.length ? (
                  <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {questions.slice(0, 8).map((question) => (
                      <li key={question.id} className="min-w-0 rounded-lg border bg-background p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={question.answered ? "secondary" : "default"}>
                            {question.count}x
                          </Badge>
                          {question.digested ? <Badge variant="outline">digested</Badge> : null}
                          {question.answered ? <Badge variant="outline">answered</Badge> : null}
                        </div>
                        <p className="mt-3 line-clamp-2 break-words text-sm font-medium leading-6">
                          “{kickContentToPlainText(question.representative)}”
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {question.askers.slice(0, 3).map((asker) => (
                            <Badge key={asker} className="max-w-full truncate" variant="outline">
                              @{asker}
                            </Badge>
                          ))}
                        </div>
                        {!question.answered ? (
                          <Button
                            className="mt-3 w-full sm:w-auto lg:w-full xl:w-auto"
                            disabled={answerMutation.isPending}
                            onClick={() => answerMutation.mutate(question.id)}
                            size="sm"
                          >
                            <Check className="size-3.5" />
                            Mark answered
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                    <MessageSquare className="size-8" />
                    <p>{questionsReady ? "No repeated questions yet." : "Loading question clusters…"}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <aside className="min-h-0 space-y-4">
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
                            <KickChatContent
                              content={line.content}
                              emotes={line.emotes}
                              imageClassName="h-6 max-w-16"
                            />
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

