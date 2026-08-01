"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConversationProvider,
  useConversationControls,
  useConversationStatus,
  useConversationMode,
} from "@elevenlabs/react";
import { Bot, Mic, PhoneOff, Wrench } from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const AGENT_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

interface TranscriptLine {
  id: string;
  role: "user" | "ai";
  text: string;
}

interface ToolLine {
  id: string;
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

function DynamicIsland({
  connected,
  isSpeaking,
  transcript,
}: {
  connected: boolean;
  isSpeaking: boolean;
  transcript: TranscriptLine[];
}) {
  const lastUser = [...transcript].reverse().find((line) => line.role === "user");
  const lastAi = [...transcript].reverse().find((line) => line.role === "ai");

  return (
    <div
      className={cn(
        "absolute left-1/2 top-3 z-20 -translate-x-1/2 overflow-hidden rounded-[22px] bg-black shadow-lg transition-all duration-300",
        connected ? "w-[88%] px-4 py-3" : "h-[26px] w-28",
      )}
    >
      {connected && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
              <Bot className="size-3" /> Sidekick
            </span>
            <span className="flex items-center gap-1.5">
              <Waveform active={connected} />
              <span
                className={cn(
                  "text-[9px] font-semibold uppercase tracking-wider",
                  isSpeaking ? "text-primary" : "text-neutral-400",
                )}
              >
                {isSpeaking ? "speaking" : "listening"}
              </span>
            </span>
          </div>
          {lastUser && (
            <p className="truncate text-[11px] text-neutral-300">
              <span className="text-neutral-500">You: </span>
              {lastUser.text}
            </p>
          )}
          {lastAi && (
            <p className="line-clamp-3 text-[11px] font-medium text-white">
              <span className="text-primary">Sidekick: </span>
              {lastAi.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function VoiceAgentInner({
  transcript,
  toolLines,
  onToolActivity,
}: {
  transcript: TranscriptLine[];
  toolLines: ToolLine[];
  onToolActivity: (text: string) => void;
}) {
  const { startSession, endSession } = useConversationControls();
  const { status } = useConversationStatus();
  const { isSpeaking } = useConversationMode();
  const [haptic, setHaptic] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const connected = status === "connected";

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [toolLines, transcript]);

  const pulseHaptic = () => {
    setHaptic(true);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(30);
    }
    setTimeout(() => setHaptic(false), 320);
  };

  const toggle = async () => {
    pulseHaptic();
    if (connected) {
      await endSession();
      return;
    }
    if (!AGENT_ID) {
      onToolActivity("NEXT_PUBLIC_ELEVENLABS_AGENT_ID is not set");
      return;
    }
    await startSession({ agentId: AGENT_ID });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* iPhone frame */}
      <div
        className={cn(
          "relative h-[780px] w-[380px] rounded-[54px] border-[10px] border-neutral-800 bg-neutral-950 shadow-[0_0_80px_rgba(0,0,0,0.8)]",
          haptic && "sidekick-haptic",
        )}
      >
        <DynamicIsland connected={connected} isSpeaking={isSpeaking} transcript={transcript} />

        {/* screen */}
        <div className="flex h-full flex-col overflow-hidden rounded-[44px] bg-[linear-gradient(170deg,#0b0f0b_0%,#101710_60%,#0b0f0b_100%)] pt-24">
          <div className="px-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Streamer copilot
            </p>
            <p className="mt-1 text-lg font-black text-foreground">
              {connected ? "Sidekick is on the line" : "Hold a game, ask your chat"}
            </p>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => void toggle()}
              className={cn(
                "flex size-36 items-center justify-center rounded-full border-4 transition-all",
                connected
                  ? isSpeaking
                    ? "animate-pulse border-primary bg-primary/25 shadow-[0_0_70px_rgba(83,252,24,0.4)]"
                    : "border-primary bg-primary/10 shadow-[0_0_40px_rgba(83,252,24,0.2)]"
                  : "border-neutral-700 bg-neutral-900 hover:border-primary/70",
              )}
            >
              {connected ? (
                <PhoneOff className="size-11 text-destructive" />
              ) : (
                <Mic className="size-11 text-primary" />
              )}
            </button>
          </div>

          <p className="pb-3 text-center text-xs text-muted-foreground">
            {connected
              ? isSpeaking
                ? "Sidekick is speaking…"
                : "Listening — vibe, questions, who's new"
              : "Tap to talk"}
          </p>

          {/* tool activity sheet */}
          <div className="mx-3 mb-4 h-44 rounded-t-2xl border border-b-0 bg-black/50 p-3 backdrop-blur">
            <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Live tool calls
            </p>
            <div ref={logRef} className="h-[132px] space-y-1 overflow-y-auto font-mono text-[10px]">
              {toolLines.length === 0 && (
                <p className="text-muted-foreground">Agent tool activity appears here.</p>
              )}
              {toolLines.map((line) => (
                <div key={line.id} className="flex items-start gap-1.5">
                  <Wrench className="mt-0.5 size-2.5 shrink-0 text-primary" />
                  <span className="text-neutral-300">{line.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VoiceAgent() {
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [toolLines, setToolLines] = useState<ToolLine[]>([]);

  const pushTool = useCallback((text: string) => {
    setToolLines((current) => [
      ...current.slice(-40),
      { id: crypto.randomUUID(), text },
    ]);
  }, []);

  const clientTools = useMemo(() => {
    const tool = (name: string, path: string, onCall?: () => void) => async () => {
      onCall?.();
      const { data } = await apiClient.get<unknown>(path);
      const body = JSON.stringify(data);
      pushTool(`${name} → ${body.length > 110 ? `${body.slice(0, 110)}…` : body}`);
      return body;
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
  }, [pushTool]);

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
      <VoiceAgentInner
        transcript={transcript}
        toolLines={toolLines}
        onToolActivity={pushTool}
      />
    </ConversationProvider>
  );
}
