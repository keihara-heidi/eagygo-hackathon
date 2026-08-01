"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { LogOut, MessageSquare, Wrench } from "lucide-react";

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
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  useKickStreamEvents,
  type KickStreamConnectionState,
} from "@/hooks/use-kick-stream-events";
import { useConnectedKickStream } from "@/hooks/use-connected-kick-stream";
import { useSidekickAgentChat } from "@/hooks/use-sidekick-agent-chat";
import type { StampedEvent } from "@/lib/chat-engine/types";
import { streamContextQueryOptions } from "@/lib/viewer-chat-api";

interface ViewerChatProps {
  username?: string;
}


function renderKickContent(content: string) {
  return content.split(/(\[emote:\d+:[^\]]+\])/g).map((part, index) => {
    const match = /^\[emote:(\d+):([^\]]+)\]$/.exec(part);
    if (!match) return <span key={index}>{part}</span>;

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={index}
        alt={match[2]}
        className="mx-0.5 inline-block h-7 max-w-20 object-contain align-middle"
        src={`https://files.kick.com/emotes/${match[1]}/fullsize`}
      />
    );
  });
}

function KickChatLine({ wrapped }: { wrapped: StampedEvent }) {
  if (wrapped.event.type !== "chat.message.sent") return null;

  const { sender, content } = wrapped.event.payload;
  const badges = sender.identity?.badges ?? [];

  return (
    <p className="text-sm leading-6 text-neutral-100">
      <span className="mr-1 inline-flex items-center gap-1 align-middle">
        {badges.slice(0, 2).map((badge, index) => (
          <span
            key={`${badge.type}-${index}`}
            className="inline-flex min-w-5 items-center justify-center rounded bg-neutral-200 px-1 text-[10px] font-black leading-5 text-neutral-950"
            title={badge.text}
          >
            {badge.count ?? badge.text.slice(0, 2)}
          </span>
        ))}
        {sender.is_verified ? (
          <span
            aria-label="Verified"
            className="inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground"
          >
            ✓
          </span>
        ) : null}
      </span>
      <span
        className="font-bold"
        style={{ color: sender.identity?.username_color ?? "#d1d5db" }}
      >
        {sender.username}
      </span>
      <span className="text-neutral-300">: </span>
      {renderKickContent(content)}
    </p>
  );
}

function LiveKickChat({
  events,
  streamer,
  connectionState,
}: {
  events: StampedEvent[];
  streamer: string;
  connectionState: KickStreamConnectionState;
}) {
  const chatEvents = events.filter(({ event }) => event.type === "chat.message.sent").slice(-80);
  const live = connectionState === "live";

  return (
    <section
      aria-label={`Live KICK chat for ${streamer}`}
      className="flex size-full min-h-0 flex-col bg-[#0b0b0b] text-white"
    >
      <header className="flex h-12 shrink-0 items-center border-b border-neutral-800 px-4">
        <h1 className="text-sm font-semibold">Live chat</h1>
        <span className="ml-auto flex items-center gap-2 text-xs text-neutral-400">
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${live ? "animate-pulse bg-primary" : "bg-neutral-600"}`}
          />
          {live ? "Live" : connectionState}
        </span>
      </header>

      <div className="min-h-0 flex-1">
        <MessageScrollerProvider>
          <MessageScroller>
            <MessageScrollerViewport>
              <MessageScrollerContent
                aria-live="polite"
                className="justify-end gap-2 px-4 py-3"
              >
                {chatEvents.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
                    Waiting for live chat…
                  </div>
                ) : (
                  chatEvents.map((wrapped, index) => (
                    <MessageScrollerItem
                      key={wrapped.seq}
                      scrollAnchor={index === chatEvents.length - 1}
                    >
                      <KickChatLine wrapped={wrapped} />
                    </MessageScrollerItem>
                  ))
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
          </MessageScroller>
        </MessageScrollerProvider>
      </div>

    </section>
  );
}


export function ViewerChat({ username }: ViewerChatProps) {
  const viewerName = username ?? "viewer";
  const streamContext = useQuery(streamContextQueryOptions);
  const { stream: connectedStream } = useConnectedKickStream();
  const broadcasterUserId = connectedStream?.broadcasterUserId;
  const streamEndpoint = useMemo(
    () =>
      broadcasterUserId === undefined
        ? "/api/stream"
        : `/api/stream?broadcasterUserId=${broadcasterUserId}`,
    [broadcasterUserId],
  );
  const { messages, sendMessage, isPending, isStreaming, isError } = useSidekickAgentChat();
  const { events: kickEvents, connectionState } = useKickStreamEvents({
    endpoint: streamEndpoint,
    maxEvents: 80,
  });

  const streamer = connectedStream?.slug ?? streamContext.data?.streamer;
  const hasMessages = messages.length > 0;
  const visibleKickEvents = useMemo(
    () =>
      broadcasterUserId === undefined
        ? kickEvents
        : kickEvents.filter(
            ({ event }) => event.payload.broadcaster.user_id === broadcasterUserId,
          ),
    [broadcasterUserId, kickEvents],
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
            <span className="max-w-28 truncate text-xs font-medium text-foreground/80">
              @{viewerName}
            </span>
            {username ? (
              <form action="/api/auth/logout" method="post">
                <Button aria-label="Log out" size="icon-sm" type="submit" variant="ghost">
                  <LogOut className="size-4" />
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </header>

      <section className="shrink-0 border-b bg-background px-4 py-2 sm:px-6">
        <div className="mx-auto w-full max-w-6xl">
          <KickStreamConnector />
        </div>
      </section>


      <ResizablePanelGroup
        className="min-h-0 flex-1"
        id="chat-agent-split"
        orientation="vertical"
      >
        <ResizablePanel
          className="h-full min-h-0"
          defaultSize="50%"
          id="live-chat-panel"
          minSize="20%"
        >
          <LiveKickChat
            connectionState={connectionState}
            events={visibleKickEvents}
            streamer={streamer ?? "hanvee"}
          />
        </ResizablePanel>
        <ResizableHandle
          className="cursor-row-resize bg-primary/40 transition-colors hover:bg-primary/70 aria-[orientation=horizontal]:h-1"
          id="chat-agent-divider"
          withHandle
        />
        <ResizablePanel
          className="h-full min-h-0"
          defaultSize="50%"
          id="sidekick-panel"
          minSize="20%"
        >
          <section className="flex size-full min-h-0 flex-col overflow-hidden">

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
                              {message.role === "assistant" ? "Sidekick" : `You · @${viewerName}`}
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
          </section>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
