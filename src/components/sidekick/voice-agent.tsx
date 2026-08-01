"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ConversationProvider,
  useConversationControls,
  useConversationStatus,
  useConversationMode,
} from "@elevenlabs/react";
import { Bot, Eye, Flame, MessageCircleQuestion, Mic, Radio, UserPlus, Wrench, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { STREAM_INFO, STREAMER } from "@/lib/sidekick/personas";
import { cn } from "@/lib/utils";

import { useVoiceChatFeed, VoiceChatColumn } from "./voice-chat-column";

const AGENT_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

interface TranscriptLine {
  id: string;
  role: "user" | "ai";
  text: string;
}

function Waveform({ active }: { active: boolean }) {
  return (
    <span className="flex h-4 items-center gap-[3px]">
      {[0, 1, 2, 3, 4].map((bar) => (
        <span
          key={bar}
          className={cn(
            "w-[3px] rounded-full bg-primary transition-all",
            active ? "sidekick-wave-bar h-4" : "h-1 opacity-40",
          )}
          style={{ animationDelay: `${bar * 0.12}s` }}
        />
      ))}
    </span>
  );
}

/**
 * Wispr Flow-style indicator: a compact floating pill above the stream that
 * expands while the voice session is live — waveform, state, transcript, and
 * the latest tool call.
 */
function WhisprPill({
  transcript,
  lastTool,
  onToolActivity,
}: {
  transcript: TranscriptLine[];
  lastTool: string | null;
  onToolActivity: (text: string) => void;
}) {
  const { startSession, endSession } = useConversationControls();
  const { status } = useConversationStatus();
  const { isSpeaking } = useConversationMode();
  const [haptic, setHaptic] = useState(false);

  const connected = status === "connected";
  const lastUser = [...transcript].reverse().find((line) => line.role === "user");
  const lastAi = [...transcript].reverse().find((line) => line.role === "ai");

  const toggle = useCallback(async () => {
    setHaptic(true);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(30);
    }
    setTimeout(() => setHaptic(false), 320);

    if (connected) {
      await endSession();
      return;
    }
    if (!AGENT_ID) {
      onToolActivity("NEXT_PUBLIC_ELEVENLABS_AGENT_ID is not set");
      return;
    }
    await startSession({ agentId: AGENT_ID });
  }, [connected, endSession, startSession, onToolActivity]);

  // Keyboard trigger: press V to toggle the voice session (game-safe key).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "v" || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      void toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center">
      <div
        className={cn(
          "pointer-events-auto overflow-hidden rounded-[26px] border bg-black/85 shadow-2xl shadow-black/60 backdrop-blur transition-all duration-300",
          connected ? "w-[440px] border-primary/40 px-4 py-3" : "w-auto border-border px-2 py-1.5",
          haptic && "sidekick-haptic",
        )}
      >
        {!connected ? (
          <button
            type="button"
            onClick={() => void toggle()}
            className="flex items-center gap-2 px-2 py-0.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-primary/15">
              <Mic className="size-3.5 text-primary" />
            </span>
            Ask Sidekick
            <kbd className="rounded border px-1 text-[9px] text-muted-foreground">V</kbd>
          </button>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                <Bot className="size-3.5" /> Sidekick
              </span>
              <Waveform active />
              <span
                className={cn(
                  "text-[9px] font-semibold uppercase tracking-wider",
                  isSpeaking ? "text-primary" : "text-neutral-400",
                )}
              >
                {isSpeaking ? "speaking" : "listening"}
              </span>
              {lastTool && (
                <span className="ml-auto flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] text-primary">
                  <Wrench className="size-2.5" /> {lastTool}
                </span>
              )}
              <button
                type="button"
                onClick={() => void toggle()}
                className={cn("shrink-0 text-muted-foreground hover:text-foreground", !lastTool && "ml-auto")}
              >
                <X className="size-3.5" />
              </button>
            </div>
            {lastUser && (
              <p className="truncate text-[11px] text-neutral-400">
                <span className="text-neutral-500">You: </span>
                {lastUser.text}
              </p>
            )}
            {lastAi && (
              <p className="line-clamp-2 text-[11px] font-medium text-white">
                <span className="text-primary">Sidekick: </span>
                {lastAi.text}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Mocked gameplay visual so the voice demo reads as a real stream. */
function GameplayVisual() {
  return (
    <div className="relative flex-1 overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgba(83,252,24,0.08),transparent_50%),linear-gradient(160deg,#0a0d0a_0%,#101510_55%,#0a0d0a_100%)]">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <span className="text-6xl font-black uppercase tracking-tight text-foreground/15">
          {STREAMER.username}
        </span>
        <span className="text-sm text-muted-foreground/50">
          [ mock gameplay feed — {STREAM_INFO.category.name} ]
        </span>
      </div>
      {/* faux in-game HUD to sell the frame */}
      <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1 rounded bg-black/40 px-3 py-1 font-mono text-[10px] text-neutral-400">
        N ─── 042 ─── NE
      </div>
      <div className="absolute bottom-4 left-4 flex items-center gap-2 font-mono text-[11px]">
        <span className="rounded bg-black/50 px-2 py-1 text-primary">HP 100</span>
        <span className="rounded bg-black/50 px-2 py-1 text-sky-300">AP 50</span>
        <span className="rounded bg-black/50 px-2 py-1 text-neutral-300">HRM-9 · 30/120</span>
      </div>
      <div className="absolute right-4 top-3 rounded bg-black/40 px-2 py-1 font-mono text-[10px] text-neutral-400">
        RANKED · TOP 500 GRIND
      </div>
    </div>
  );
}

function DemoTriggers() {
  const trigger = (payload: Record<string, unknown>) =>
    void apiClient.post("/demo/trigger", payload);
  return (
    <div className="ml-auto flex items-center gap-1">
      <button
        type="button"
        title="Hype spike"
        onClick={() => trigger({ action: "hype" })}
        className="rounded p-1 text-muted-foreground/50 hover:text-orange-400"
      >
        <Flame className="size-3.5" />
      </button>
      <button
        type="button"
        title="Question flood"
        onClick={() => trigger({ action: "question_flood", topic: "loadout" })}
        className="rounded p-1 text-muted-foreground/50 hover:text-sky-400"
      >
        <MessageCircleQuestion className="size-3.5" />
      </button>
      <button
        type="button"
        title="New viewer"
        onClick={() => trigger({ action: "new_viewer" })}
        className="rounded p-1 text-muted-foreground/50 hover:text-primary"
      >
        <UserPlus className="size-3.5" />
      </button>
    </div>
  );
}

export function VoiceAgent() {
  const events = useVoiceChatFeed();
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [lastTool, setLastTool] = useState<string | null>(null);

  const pushTool = useCallback((text: string) => setLastTool(text), []);

  const clientTools = useMemo(() => {
    const tool = (name: string, path: string, onCall?: () => void) => async () => {
      onCall?.();
      setLastTool(name);
      const { data } = await apiClient.get<unknown>(path);
      return JSON.stringify(data);
    };
    return {
      get_chat_vibe: tool("get_chat_vibe", "/insights/vibe"),
      get_recent_questions: tool("get_recent_questions", "/insights/questions", () => {
        // Surface the "streamer consulted chat" moment to viewers (debounced server-side).
        void apiClient.post("/voice/briefed");
      }),
      get_trending: tool("get_trending", "/insights/trending"),
      get_new_chatters: tool("get_new_chatters", "/insights/chatters"),
      get_stream_context: tool("get_stream_context", "/insights/context"),
    };
  }, []);

  return (
    <ConversationProvider
      clientTools={clientTools}
      onMessage={({ message, source }) => {
        setTranscript((current) => [
          ...current.slice(-20),
          { id: crypto.randomUUID(), role: source === "ai" ? "ai" : "user", text: message },
        ]);
      }}
    >
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <header className="flex items-center gap-3 border-b px-4 py-2">
          <span className="text-lg font-black tracking-tight text-primary">KICK</span>
          <span className="text-xs text-muted-foreground">/ {STREAMER.channel_slug}</span>
          <DemoTriggers />
        </header>

        <div className="relative grid min-h-0 flex-1 grid-cols-[1fr_340px]">
          <div className="relative flex min-h-0 flex-col">
            <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
              <Badge className="gap-1 bg-destructive text-white">
                <Radio className="size-3" /> LIVE
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Eye className="size-3" /> {STREAM_INFO.viewer_count.toLocaleString()}
              </Badge>
            </div>

            <GameplayVisual />

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

            <WhisprPill transcript={transcript} lastTool={lastTool} onToolActivity={pushTool} />
          </div>

          <VoiceChatColumn events={events} />
        </div>
      </div>
    </ConversationProvider>
  );
}
