"use client";

import { useEffect, useRef } from "react";
import { Eye, Radio } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { STREAM_INFO, STREAMER } from "@/lib/sidekick/personas";

import { ChatColumn } from "./chat-column";
import { CopilotWidget, type CopilotWidgetHandle } from "./copilot-widget";
import { DemoPanel } from "./demo-panel";
import { useStreamEvents } from "./use-stream-events";

/** Demo-spawned newcomers get ids in this range (see mock-engine). */
const NEWCOMER_ID_FLOOR = 3_000_000;

export function StreamExperience() {
  const { events, connected } = useStreamEvents();
  const copilotRef = useRef<CopilotWidgetHandle | null>(null);
  const greeted = useRef(new Set<string>());

  // Auto-greet: when the demo spawns a new viewer, Sidekick welcomes them.
  useEffect(() => {
    const latest = events[events.length - 1];
    if (!latest || latest.event.type !== "channel.followed") return;
    const follower = latest.event.payload.follower;
    if (follower.user_id < NEWCOMER_ID_FLOOR) return;
    if (greeted.current.has(follower.username)) return;
    greeted.current.add(follower.username);
    copilotRef.current?.autoGreet(follower.username);
  }, [events]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-3 border-b px-4 py-2">
        <span className="text-lg font-black tracking-tight text-primary">KICK</span>
        <span className="text-xs text-muted-foreground">/ {STREAMER.channel_slug}</span>
        <span
          className={`ml-auto size-2 rounded-full ${connected ? "bg-primary" : "bg-destructive"}`}
          title={connected ? "Live feed connected" : "Reconnecting…"}
        />
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_340px]">
        <div className="flex min-h-0 flex-col">
          <div className="relative flex-1 bg-[radial-gradient(circle_at_30%_20%,rgba(83,252,24,0.08),transparent_50%),linear-gradient(160deg,#0a0d0a_0%,#101510_55%,#0a0d0a_100%)]">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <span className="text-5xl font-black uppercase tracking-tight text-foreground/20">
                {STREAMER.username}
              </span>
              <span className="text-sm text-muted-foreground/60">
                [ mock gameplay feed — {STREAM_INFO.category.name} ]
              </span>
            </div>
            <div className="absolute left-4 top-4 flex items-center gap-2">
              <Badge className="gap-1 bg-destructive text-white">
                <Radio className="size-3" /> LIVE
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Eye className="size-3" /> {STREAM_INFO.viewer_count.toLocaleString()}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={STREAMER.profile_picture}
              alt={STREAMER.username}
              className="size-10 rounded-full border-2 border-primary"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{STREAM_INFO.title}</p>
              <p className="text-xs text-muted-foreground">
                {STREAMER.username} · {STREAM_INFO.category.name}
              </p>
            </div>
          </div>
        </div>

        <ChatColumn events={events} />
      </div>

      <CopilotWidget
        registerHandle={(handle) => {
          copilotRef.current = handle;
        }}
      />
      <DemoPanel />
    </div>
  );
}
