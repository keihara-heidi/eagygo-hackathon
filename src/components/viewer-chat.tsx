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
  MessageAvatar,
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
    <section className="shrink-0 border-b border-border/60 bg-background/75 px-4 py-3 backdrop-blur sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-40 items-center gap-3">
          <span className="grid size-9 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
            <Radio className={live ? "size-4 animate-pulse" : "size-4"} />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
              Live KICK context
            </p>
            <p className="text-xs text-muted-foreground">
              {live ? `${eventCount} events loaded` : connectionState}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 lg:pb-0">
          {activities.length === 0 ? (
            <div className="min-w-64 rounded-2xl border border-dashed bg-card/60 px-3 py-2 text-xs text-muted-foreground">
              Waiting for live chat, follows, subs, and Kicks…
            </div>
          ) : (
            activities.map((activity) => (
              <article
                key={activity.id}
                className="min-w-64 rounded-2xl border bg-card/85 px-3 py-2 shadow-sm shadow-black/10"
              >
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  <KickActivityIcon kind={activity.kind} />
                  {activity.label}
                </div>
                <p className="truncate text-xs font-semibold text-foreground">
                  {activity.title}
                </p>
                <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {activity.detail}
                </p>
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
  const { messages, sendMessage, isPending, isError } = useSidekickAgentChat();
  const { events: kickEvents, connectionState } = useKickStreamEvents({ maxEvents: 80 });

  const streamer = connectedStream?.slug ?? streamContext.data?.streamer;
  const hasMessages = messages.length > 0;
  const kickActivities = useMemo(
    () => kickEvents.slice(-4).reverse().map(toKickActivity),
    [kickEvents],
  );

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link className="flex items-center gap-2 font-heading text-lg font-bold" href="/">
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            Sidekick
          </Link>
          <span className="hidden text-xs text-muted-foreground sm:inline">Viewer chat</span>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${streamContext.isSuccess ? "bg-primary" : "bg-muted-foreground"}`}
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

      <section className="shrink-0 border-b border-border/60 bg-background/75 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto w-full max-w-5xl">
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
                className="mx-auto w-full max-w-3xl px-4 pb-8 pt-6 sm:px-6 sm:pt-10"
              >
                {!hasMessages && !isPending ? (
                  <div className="flex min-h-[calc(100dvh-15rem)] flex-col items-center justify-center text-center">
                    <span className="mb-5 grid size-12 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                      <Sparkles className="size-6" />
                    </span>
                    <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
                      Ask about this stream
                    </h1>
                    <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
                      Catch up, decode chat, or ask what happened. Sidekick answers from recent
                      KICK chat context.
                    </p>
                    <div className="mt-6 grid max-w-xl gap-3 text-left sm:grid-cols-2">
                      <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
                        <div className="mb-1 flex items-center gap-2 font-semibold uppercase tracking-[0.18em] text-primary">
                          <span className="size-1.5 rounded-full bg-primary" />
                          Agent tool calls
                        </div>
                        <p>Ask a question to see the same tool calls the voice agent uses.</p>
                      </div>
                      <div className="rounded-2xl border bg-card/80 px-4 py-3 text-xs text-muted-foreground">
                        <div className="mb-1 flex items-center gap-2 font-semibold uppercase tracking-[0.18em] text-primary">
                          <Radio className="size-3" />
                          Live Kick feed
                        </div>
                        <p className="line-clamp-2">
                          {kickActivities[0]
                            ? `${kickActivities[0].title}: ${kickActivities[0].detail}`
                            : "Waiting for chat activity…"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <MessageGroup className="gap-7">
                    {messages.map((message, index) => (
                      <MessageScrollerItem
                        key={message.id}
                        scrollAnchor={index === messages.length - 1 && !isPending}
                      >
                        <Message align={message.role === "user" ? "end" : "start"}>
                          {message.role === "assistant" && (
                            <MessageAvatar className="size-8 self-start bg-primary text-primary-foreground">
                              <Sparkles className="size-4" />
                            </MessageAvatar>
                          )}
                          <MessageContent
                            className={
                              message.role === "user"
                                ? "max-w-[85%] rounded-3xl bg-muted px-4 py-3 sm:max-w-[75%]"
                                : "max-w-[calc(100%-2.5rem)] pt-1"
                            }
                          >
                            {message.role === "assistant" && message.toolCalls?.length ? (
                              <div className="mb-3 space-y-1 rounded-2xl border border-primary/20 bg-primary/5 p-3 font-mono text-[11px] text-muted-foreground">
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
                            <p className="whitespace-pre-wrap text-[15px] leading-7">
                              {message.content}
                            </p>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    ))}

                    {isPending && (
                      <MessageScrollerItem scrollAnchor>
                        <Message>
                          <MessageAvatar className="size-8 self-start bg-primary text-primary-foreground">
                            <Sparkles className="size-4" />
                          </MessageAvatar>
                          <MessageContent className="pt-3">
                            <div aria-label="Sidekick is responding" className="flex items-center gap-1">
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

      <footer className="shrink-0 bg-gradient-to-t from-background via-background to-background/0 px-4 pb-4 pt-2 sm:px-6 sm:pb-6">
        <div className="mx-auto w-full max-w-3xl">
          <ChatComposer disabled={isPending} onSend={sendMessage} />
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
