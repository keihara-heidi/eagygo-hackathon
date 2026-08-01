"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Sparkles, Wrench } from "lucide-react";

import { ChatComposer } from "@/components/chat-composer";
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
import { useSidekickAgentChat } from "@/hooks/use-sidekick-agent-chat";
import { streamContextQueryOptions } from "@/lib/viewer-chat-api";

interface ViewerChatProps {
  username: string;
}

export function ViewerChat({ username }: ViewerChatProps) {
  const streamContext = useQuery(streamContextQueryOptions);
  const { messages, sendMessage, isPending, isError } = useSidekickAgentChat();

  const streamer = streamContext.data?.streamer;
  const hasMessages = messages.length > 0;

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
                    <div className="mt-6 max-w-md rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-left text-xs text-muted-foreground">
                      <div className="mb-1 flex items-center gap-2 font-semibold uppercase tracking-[0.18em] text-primary">
                        <span className="size-1.5 rounded-full bg-primary" />
                        Agent tool calls
                      </div>
                      <p>Ask a question to see the same tool calls the voice agent uses.</p>
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
