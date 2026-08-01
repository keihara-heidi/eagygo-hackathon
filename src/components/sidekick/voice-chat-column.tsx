"use client";

import { useEffect, useRef, useState } from "react";
import { Gift, Heart, Shield, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { SidekickEvent } from "@/lib/sidekick/types";
import { cn } from "@/lib/utils";

const SIDEKICK_USER_ID = 9_999_999;
const MAX_EVENTS = 200;

/** Streams the live chat feed (webhook-shaped events) for the voice demo. */
export function useVoiceChatFeed() {
  const [events, setEvents] = useState<SidekickEvent[]>([]);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const source = new EventSource("/api/stream/events");
    source.onmessage = (message) => {
      const parsed = JSON.parse(message.data) as SidekickEvent;
      if (seen.current.has(parsed.id)) return;
      seen.current.add(parsed.id);
      setEvents((current) => {
        const next = [...current, parsed];
        return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
      });
    };
    return () => source.close();
  }, []);

  return events;
}

function renderContent(content: string) {
  const parts = content.split(/(\[emote:\d+:\w+\])/g);
  return parts.map((part, index) => {
    const match = /^\[emote:\d+:(\w+)\]$/.exec(part);
    if (!match) return <span key={index}>{part}</span>;
    return (
      <span
        key={index}
        className="mx-0.5 inline-block rounded bg-primary/15 px-1 text-[11px] font-bold text-primary"
      >
        {match[1]}
      </span>
    );
  });
}

function Line({ event }: { event: SidekickEvent }) {
  const { event: kickEvent } = event;

  if (kickEvent.type === "channel.followed") {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 text-xs text-muted-foreground">
        <Heart className="size-3 text-rose-400" />
        <span className="font-semibold">{kickEvent.payload.follower.username}</span>
        followed the channel
      </div>
    );
  }
  if (kickEvent.type === "channel.subscription.new") {
    return (
      <div className="mx-2 rounded border-l-2 border-primary bg-primary/10 px-2 py-1 text-xs">
        <span className="font-semibold">{kickEvent.payload.subscriber.username}</span> just
        subscribed!
      </div>
    );
  }
  if (kickEvent.type === "kicks.gifted") {
    return (
      <div className="mx-2 rounded border-l-2 border-amber-400 bg-amber-400/10 px-2 py-1 text-xs">
        <span className="font-semibold">{kickEvent.payload.sender.username}</span> gifted{" "}
        <span className="font-bold text-amber-400">{kickEvent.payload.gift.amount} KICKs</span>
      </div>
    );
  }
  if (kickEvent.type !== "chat.message.sent") return null;

  const payload = kickEvent.payload;
  const isBot = payload.sender.user_id === SIDEKICK_USER_ID;
  const badges = payload.sender.identity?.badges ?? [];

  return (
    <div
      className={cn(
        "px-3 py-0.5 text-[13px] leading-5",
        isBot && "mx-2 my-1 rounded border border-primary/40 bg-primary/10 py-1.5",
      )}
    >
      {isBot && (
        <Badge className="mb-0.5 mr-1 h-4 bg-primary px-1 text-[10px] text-primary-foreground">
          SIDEKICK
        </Badge>
      )}
      <span className="inline-flex items-center gap-0.5 align-text-top">
        {badges.some((badge) => badge.type === "moderator") && (
          <Shield className="size-3 text-emerald-400" />
        )}
        {badges.some((badge) => badge.type === "subscriber") && (
          <Star className="size-3 text-amber-400" />
        )}
        {badges.some((badge) => badge.type === "sub_gifter") && (
          <Gift className="size-3 text-fuchsia-400" />
        )}
      </span>{" "}
      <span
        className="font-semibold"
        style={{ color: payload.sender.identity?.username_color ?? "#999" }}
      >
        {payload.sender.username}
      </span>
      <span className="text-muted-foreground">: </span>
      <span className={cn(isBot && "font-medium text-foreground")}>
        {renderContent(payload.content)}
      </span>
    </div>
  );
}

export function VoiceChatColumn({ events }: { events: SidekickEvent[] }) {
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [events]);

  return (
    <div className="flex h-full min-h-0 flex-col border-l bg-card/60">
      <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Chat
      </div>
      <div ref={viewportRef} className="min-h-0 flex-1 overflow-y-auto py-2">
        {events.map((event) => (
          <Line key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
