"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Gift,
  LogOut,
  MessageSquare,
  Radio,
  Sparkles,
  UserPlus,
  Wrench,
  Zap,
} from "lucide-react";

import { ChatComposer } from "@/components/chat-composer";
import { KickStreamConnector } from "@/components/kick-stream-connector";
import { Button } from "@/components/ui/button";
import {
  Message,
  MessageContent,
  MessageGroup,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import {
  useKickStreamEvents,
  type KickStreamConnectionState,
} from "@/hooks/use-kick-stream-events";
import { useConnectedKickStream } from "@/hooks/use-connected-kick-stream";
import { useSidekickAgentChat } from "@/hooks/use-sidekick-agent-chat";
import type { StampedEvent } from "@/lib/chat-engine/types";
import { streamContextQueryOptions } from "@/lib/viewer-chat-api";

interface ViewerChatProps {
  username: string;
}

type KickActivityKind =
  | "chat"
  | "question"
  | "follow"
  | "sub"
  | "gift"
  | "sidekick"
  | "system";

interface KickActivity {
  id: string;
  kind: KickActivityKind;
  label: string;
  title: string;
  detail: string;
}

function stripKickMarkup(content: string) {
  return content.replace(/\[emote:[^:\]]+:([^\]]+)\]/g, ":$1:").trim();
}

function isQuestion(content: string) {
  return /\?|^(what|whats|when|where|why|how|who|can|do|does|did|is|are|will|should)\b/i.test(
    content.trim(),
  );
}

function toKickActivity(wrapped: StampedEvent): KickActivity {
  const id = String(wrapped.seq);
  const { event } = wrapped;

  switch (event.type) {
    case "chat.message.sent": {
      const content = stripKickMarkup(event.payload.content);
      const fromSidekick = event.payload.sender.username === "Sidekick";
      return {
        id,
        kind: fromSidekick ? "sidekick" : isQuestion(content) ? "question" : "chat",
        label: fromSidekick ? "Sidekick" : isQuestion(content) ? "Question" : "Chat",
        title: `@${event.payload.sender.username}`,
        detail: content,
      };
    }
    case "channel.followed":
      return {
        id,
        kind: "follow",
        label: "Follow",
        title: `@${event.payload.follower.username}`,
        detail: "joined the stream",
      };
    case "channel.subscription.new":
    case "channel.subscription.renewal":
      return {
        id,
        kind: "sub",
        label: "Sub",
        title: `@${event.payload.subscriber.username}`,
        detail: `${event.payload.duration} month${event.payload.duration === 1 ? "" : "s"}`,
      };
    case "channel.subscription.gifts":
      return {
        id,
        kind: "gift",
        label: "Gift subs",
        title: `@${event.payload.gifter.username}`,
        detail: `${event.payload.giftees.length} gifted subs`,
      };
    case "kicks.gifted":
      return {
        id,
        kind: "gift",
        label: "Kicks",
        title: `@${event.payload.sender.username}`,
        detail: `${event.payload.gift.amount} kicks · ${event.payload.gift.message}`,
      };
    case "livestream.status.updated":
      return {
        id,
        kind: "system",
        label: "Stream",
        title: event.payload.is_live ? "Went live" : "Ended",
        detail: "KICK status update",
      };
    case "livestream.metadata.updated":
      return {
        id,
        kind: "system",
        label: "Stream",
        title: "Title updated",
        detail: event.payload.metadata.title,
      };
    case "moderation.banned":
      return {
        id,
        kind: "system",
        label: "Moderation",
        title: `@${event.payload.banned_user.username}`,
        detail: event.payload.metadata.reason,
      };
    case "channel.reward.redemption.updated":
      return {
        id,
        kind: "gift",
        label: "Reward",
        title: `@${event.payload.redeemer.username}`,
        detail: `${event.payload.reward.title}: ${event.payload.user_input}`,
      };
  }
}

function KickActivityIcon({ kind }: { kind: KickActivityKind }) {
  const className = "size-3.5";
  switch (kind) {
    case "question":
      return <Sparkles className={className} />;
    case "follow":
      return <UserPlus className={className} />;
    case "sub":
      return <Zap className={className} />;
    case "gift":
      return <Gift className={className} />;
    case "sidekick":
      return <Sparkles className={className} />;
    case "system":
      return <Radio className={className} />;
    case "chat":
      return <MessageSquare className={className} />;
  }
}

function LiveKickActivityBar({
  activities,
  connectionState,
  eventCount,
}: {
  activities: KickActivity[];
  connectionState: KickStreamConnectionState;
  eventCount: number;
}) {
  const live = connectionState === "live";

  return (
    <section className="shrink-0 border-b bg-card">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-stretch overflow-hidden">
        <div className="flex min-w-36 items-center gap-2 border-r px-4 sm:min-w-44 sm:px-6">
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${live ? "animate-pulse bg-primary" : "bg-muted-foreground"}`}
          />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">Live context</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {live ? `${eventCount} events` : connectionState}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 divide-x divide-border overflow-x-auto">
          {activities.length === 0 ? (
            <p className="flex min-w-64 items-center px-4 text-xs text-muted-foreground">
              Waiting for chat, follows, subs, and Kicks…
            </p>
          ) : (
            activities.map((activity) => (
              <article key={activity.id} className="min-w-56 px-4 py-2.5">
                <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <span className="text-primary">
                    <KickActivityIcon kind={activity.kind} />
                  </span>
                  {activity.label}
                </div>
                <p className="truncate text-xs font-semibold">{activity.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">{activity.detail}</p>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export function ViewerChat({ username }: ViewerChatProps) {
  const streamContext = useQuery(streamContextQueryOptions);
  const { stream: connectedStream } = useConnectedKickStream();
  const { messages, sendMessage, isPending, isStreaming, isError } = useSidekickAgentChat();
  const { events: kickEvents, connectionState } = useKickStreamEvents({ maxEvents: 80 });

  const streamer = connectedStream?.slug ?? streamContext.data?.streamer;
  const hasMessages = messages.length > 0;
  const kickActivities = useMemo(
    () => kickEvents.slice(-4).reverse().map(toKickActivity),
    [kickEvents],
  );

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link aria-label="Sidekick home" className="flex items-center" href="/">
            <span className="font-brand text-2xl leading-none text-primary">KICK</span>
            <span aria-hidden="true" className="mx-3 h-5 w-px bg-border" />
            <span className="text-sm font-semibold">Sidekick</span>
          </Link>
          <span className="hidden text-xs text-muted-foreground sm:inline">Viewer copilot</span>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${streamer ? "bg-primary" : "bg-muted-foreground"}`}
              />
              {streamer ? `Watching @${streamer}` : "KICK chat context"}
            </div>
            <span className="max-w-28 truncate text-xs font-medium text-foreground/80">
              @{username}
            </span>
            <form action="/api/auth/logout" method="post">
              <Button aria-label="Log out" size="icon-sm" type="submit" variant="ghost">
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <section className="shrink-0 border-b bg-background px-4 py-2 sm:px-6">
        <div className="mx-auto w-full max-w-6xl">
          <KickStreamConnector />
        </div>
      </section>

      <LiveKickActivityBar
        activities={kickActivities}
        connectionState={connectionState}
        eventCount={kickEvents.length}
      />

      <main className="min-h-0 flex-1" aria-label="Sidekick conversation">
        <MessageScrollerProvider>
          <MessageScroller>
            <MessageScrollerViewport>
              <MessageScrollerContent
                aria-live="polite"
                className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-6"
              >
                {!hasMessages && !isPending ? (
                  <div className="flex flex-1 items-center justify-center py-8">
                    <section className="w-full max-w-xl overflow-hidden rounded-lg border bg-card">
                      <header className="flex h-11 items-center gap-2 border-b px-4">
                        <MessageSquare className="size-4 text-primary" />
                        <p className="text-sm font-semibold">Sidekick chat</p>
                        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
                          Live context
                        </span>
                      </header>
                      <div className="p-5 sm:p-6">
                        <h1 className="text-2xl font-semibold tracking-tight">
                          Ask about this stream
                        </h1>
                        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                          Catch up, decode chat, or ask what happened using recent KICK activity.
                        </p>
                        <div className="mt-6 space-y-3 border-t pt-4 text-xs text-muted-foreground">
                          <p className="flex gap-2">
                            <span aria-hidden="true" className="mt-1 size-1.5 shrink-0 bg-primary" />
                            Live chat, follows, subscriptions, and stream details update the context.
                          </p>
                          <p className="flex gap-2">
                            <span aria-hidden="true" className="mt-1 size-1.5 shrink-0 bg-primary" />
                            Every answer shows the exact insight tools it used.
                          </p>
                        </div>
                      </div>
                    </section>
                  </div>
                ) : (
                  <MessageGroup className="gap-3">
                    {messages.map((message, index) => (
                      <MessageScrollerItem
                        key={message.id}
                        scrollAnchor={index === messages.length - 1 && !isPending}
                      >
                        <Message>
                          <MessageContent
                            className={`rounded-md border bg-card px-4 py-3 ${
                              message.role === "assistant"
                                ? "border-primary/30"
                                : "border-border"
                            }`}
                          >
                            <p
                              className={`text-xs font-semibold ${
                                message.role === "assistant" ? "text-primary" : "text-chart-3"
                              }`}
                            >
                              {message.role === "assistant" ? "Sidekick" : `You · @${username}`}
                            </p>
                            {message.role === "assistant" && message.toolCalls?.length ? (
                              <div className="space-y-1 border-l-2 border-primary bg-background px-3 py-2 font-mono text-[11px] text-muted-foreground">
                                {message.toolCalls.map((toolCall) => (
                                  <div key={`${message.id}-${toolCall.tool}`} className="flex gap-2">
                                    <Wrench className="mt-0.5 size-3 shrink-0 text-primary" />
                                    <span>
                                      {toolCall.tool} → {toolCall.summary}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            <p className="whitespace-pre-wrap text-sm leading-6">
                              {message.content}
                            </p>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    ))}

                    {isPending && (
                      <MessageScrollerItem scrollAnchor>
                        <Message>
                          <MessageContent className="rounded-md border border-primary/30 bg-card px-4 py-3">
                            <p className="text-xs font-semibold text-primary">Sidekick</p>
                            <div
                              aria-label="Sidekick is responding"
                              className="flex items-center gap-1 py-1"
                            >
                              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
                            </div>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    )}
                  </MessageGroup>
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      </main>

      <footer className="shrink-0 border-t bg-card px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto w-full max-w-3xl">
          <ChatComposer disabled={isPending || isStreaming} onSend={sendMessage} />
          {isError ? (
            <p className="mt-2 text-center text-xs text-destructive" role="alert">
              Couldn&apos;t get a response. Try again.
            </p>
          ) : (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Enter to send · Shift + Enter for new line
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
