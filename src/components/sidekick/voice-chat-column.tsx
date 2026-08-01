"use client";

import { useEffect, useRef } from "react";
import { Gift, Heart, Shield, Star } from "lucide-react";

import { useKickStreamEvents } from "@/hooks/use-kick-stream-events";
import type { StampedEvent } from "@/lib/chat-engine/types";
import { cn } from "@/lib/utils";

const SIDEKICK_USER_ID = 9_999_999;
const MAX_EVENTS = 200;

/** Streams the live chat feed (webhook-shaped events) for the voice demo. */
export function useVoiceChatFeed() {
  return useKickStreamEvents({ maxEvents: MAX_EVENTS }).events;
}

function renderContent(content: string) {
  const parts = content.split(/(\[emote:\d+:\w+\])/g);
  return parts.map((part, index) => {
    const match = /^\[emote:\d+:(\w+)\]$/.exec(part);
    if (!match) return <span key={index}>{part}</span>;
    return (
      <span
        key={index}
        className="mx-0.5 inline-block rounded bg-primary/25 px-1 text-[10px] font-bold text-primary"
      >
        {match[1]}
      </span>
    );
  });
}

function OverlayLine({ event }: { event: StampedEvent }) {
  const { event: kickEvent } = event;

  if (kickEvent.type === "channel.followed") {
    return (
      <div className="flex items-center gap-1 text-[11px] text-white/70">
        <Heart className="size-3 shrink-0 text-rose-400" />
        <span className="font-semibold">{kickEvent.payload.follower.username}</span>
        <span className="text-white/50">followed</span>
      </div>
    );
  }
  if (kickEvent.type === "channel.subscription.new") {
    return (
      <div className="w-fit rounded bg-primary/25 px-1.5 py-0.5 text-[11px] text-white">
        ⭐ <span className="font-semibold">{kickEvent.payload.subscriber.username}</span>{" "}
        subscribed!
      </div>
    );
  }
  if (kickEvent.type === "kicks.gifted") {
    return (
      <div className="w-fit rounded bg-amber-400/25 px-1.5 py-0.5 text-[11px] text-white">
        <Gift className="mr-0.5 inline size-3 text-amber-300" />
        <span className="font-semibold">{kickEvent.payload.sender.username}</span> gifted{" "}
        <span className="font-bold text-amber-300">{kickEvent.payload.gift.amount} KICKs</span>
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
        "w-fit max-w-full rounded px-1.5 py-0.5 text-[11px] leading-4 text-white",
        isBot ? "border border-primary/50 bg-primary/20" : "bg-black/35",
      )}
    >
      {isBot && (
        <span className="mr-1 rounded bg-primary px-1 text-[9px] font-black text-primary-foreground">
          SIDEKICK
        </span>
      )}
      <span className="mr-0.5 inline-flex items-center gap-0.5 align-text-top">
        {badges.some((badge) => badge.type === "moderator") && (
          <Shield className="size-2.5 text-emerald-300" />
        )}
        {badges.some((badge) => badge.type === "subscriber") && (
          <Star className="size-2.5 text-amber-300" />
        )}
      </span>
      <span
        className="font-bold"
        style={{ color: payload.sender.identity?.username_color ?? "#bbb" }}
      >
        {payload.sender.username}
      </span>
      <span className="text-white/60">: </span>
      {renderContent(payload.content)}
    </div>
  );
}

/**
 * Kick-mobile-style chat overlay: translucent lines over the camera feed,
 * pinned to the bottom of the phone, centered, fading out toward the top.
 */
export function VoiceChatOverlay({ events }: { events: StampedEvent[] }) {
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [events]);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-6">
      <div
        ref={viewportRef}
        className="flex max-h-56 w-full max-w-[320px] flex-col items-center gap-1 overflow-y-auto [mask-image:linear-gradient(to_bottom,transparent,black_22%)]"
      >
        {events.slice(-40).map((event) => (
          <OverlayLine key={event.seq} event={event} />
        ))}
      </div>
    </div>
  );
}
