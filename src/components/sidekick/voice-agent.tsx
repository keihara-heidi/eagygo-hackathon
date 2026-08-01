"use client";

import { useMemo, useRef, useState } from "react";
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

interface ActivityLine {
  id: string;
  kind: "tool" | "info";
  text: string;
}

function useActivityLog() {
  const [lines, setLines] = useState<ActivityLine[]>([]);
  const push = (kind: ActivityLine["kind"], text: string) =>
    setLines((current) => [
      ...current.slice(-30),
      { id: crypto.randomUUID(), kind, text },
    ]);
  return { lines, push };
}

function VoiceAgentInner({
  log,
}: {
  log: ReturnType<typeof useActivityLog>;
}) {
  const { startSession, endSession } = useConversationControls();
  const { status } = useConversationStatus();
  const { isSpeaking } = useConversationMode();
  const scrollRef = useRef<HTMLDivElement>(null);

  const connected = status === "connected";

  const start = async () => {
    if (!AGENT_ID) {
      log.push("info", "NEXT_PUBLIC_ELEVENLABS_AGENT_ID is not set");
      return;
    }
    log.push("info", "Connecting to Sidekick…");
    await startSession({ agentId: AGENT_ID });
    log.push("info", "Connected — just talk.");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-6">
      <div className="flex items-center gap-2 text-primary">
        <Bot className="size-6" />
        <span className="text-xl font-black tracking-tight">Sidekick Voice</span>
      </div>

      <button
        type="button"
        onClick={() => void (connected ? endSession() : start())}
        className={cn(
          "flex size-40 items-center justify-center rounded-full border-4 transition-all",
          connected
            ? isSpeaking
              ? "animate-pulse border-primary bg-primary/25 shadow-[0_0_60px_rgba(83,252,24,0.35)]"
              : "border-primary bg-primary/10"
            : "border-border bg-card hover:border-primary/60",
        )}
      >
        {connected ? (
          <PhoneOff className="size-12 text-destructive" />
        ) : (
          <Mic className="size-12 text-primary" />
        )}
      </button>

      <p className="text-sm text-muted-foreground">
        {!connected
          ? "Tap to talk to your chat"
          : isSpeaking
            ? "Sidekick is speaking…"
            : "Listening — ask about vibe, questions, who's new"}
      </p>

      <div
        ref={scrollRef}
        className="h-48 w-full max-w-sm space-y-1 overflow-y-auto rounded-lg border bg-card/60 p-3 font-mono text-[11px]"
      >
        {log.lines.length === 0 && (
          <p className="text-muted-foreground">Tool activity will appear here.</p>
        )}
        {log.lines.map((line) => (
          <div key={line.id} className="flex items-start gap-1.5">
            {line.kind === "tool" ? (
              <Wrench className="mt-0.5 size-3 shrink-0 text-primary" />
            ) : (
              <span className="mt-0.5 size-3 shrink-0 text-center text-muted-foreground">·</span>
            )}
            <span className={line.kind === "tool" ? "text-foreground" : "text-muted-foreground"}>
              {line.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VoiceAgent() {
  const log = useActivityLog();

  const clientTools = useMemo(() => {
    const tool = (name: string, path: string) => async () => {
      const { data } = await apiClient.get<unknown>(path);
      const body = JSON.stringify(data);
      log.push("tool", `${name} → ${body.length > 120 ? `${body.slice(0, 120)}…` : body}`);
      return body;
    };
    return {
      get_chat_vibe: tool("get_chat_vibe", "/insights/vibe"),
      get_recent_questions: tool("get_recent_questions", "/insights/questions"),
      get_trending: tool("get_trending", "/insights/trending"),
      get_new_chatters: tool("get_new_chatters", "/insights/chatters"),
      get_stream_context: tool("get_stream_context", "/insights/context"),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ConversationProvider clientTools={clientTools}>
      <VoiceAgentInner log={log} />
    </ConversationProvider>
  );
}
