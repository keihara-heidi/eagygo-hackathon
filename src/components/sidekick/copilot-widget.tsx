"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, Send, Sparkles, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ToolCall {
  tool: string;
  request: string;
  summary: string;
}

interface CopilotTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  toolCalls?: ToolCall[];
}

const QUICK_PROMPTS = [
  "What's going on?",
  "Who is the streamer?",
  "Why is chat spamming?",
];

function ToolCallTrace({ calls }: { calls: ToolCall[] }) {
  if (calls.length === 0) return null;
  return (
    <div className="mb-1.5 space-y-1 rounded border border-border/60 bg-background/60 p-1.5 font-mono text-[10px] text-muted-foreground">
      {calls.map((call, index) => (
        <div key={index} className="flex items-start gap-1">
          <Wrench className="mt-0.5 size-2.5 shrink-0 text-primary" />
          <span>
            <span className="font-semibold text-foreground">{call.tool}</span>
            <span className="text-muted-foreground/70"> · {call.request}</span>
            <span className="block text-primary/90">→ {call.summary}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export interface CopilotWidgetHandle {
  autoGreet: (username: string) => void;
}

export function CopilotWidget({
  registerHandle,
}: {
  registerHandle?: (handle: CopilotWidgetHandle) => void;
}) {
  const [open, setOpen] = useState(true);
  const [turns, setTurns] = useState<CopilotTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [turns, open]);

  const ask = useCallback(
    async (question: string, options?: { auto?: boolean; viewer?: string }) => {
      if (!options?.auto) {
        setTurns((current) => [
          ...current,
          { id: crypto.randomUUID(), role: "user", text: question },
        ]);
      }
      setBusy(true);
      try {
        const { data } = await apiClient.post<{
          answer: string;
          tool_calls: ToolCall[];
        }>("/copilot/ask", {
          question,
          auto: options?.auto ?? false,
          viewer: options?.viewer,
        });
        setTurns((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: data.answer,
            toolCalls: data.tool_calls,
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    registerHandle?.({
      autoGreet: (username: string) => {
        setOpen(true);
        void ask("", { auto: true, viewer: username });
      },
    });
  }, [registerHandle, ask]);

  const submit = () => {
    const question = draft.trim();
    if (!question || busy) return;
    setDraft("");
    void ask(question);
  };

  return (
    <div className="pointer-events-auto fixed bottom-4 right-4 z-50 w-80">
      {open ? (
        <div className="flex max-h-[70vh] flex-col overflow-hidden rounded-xl border border-primary/30 bg-card shadow-2xl shadow-black/50">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 border-b bg-primary/10 px-3 py-2 text-left"
          >
            <Bot className="size-4 text-primary" />
            <span className="flex-1 text-sm font-bold">Sidekick</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              stream copilot
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>

          <div ref={viewportRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {turns.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Just joined? Ask me what&apos;s going on — I&apos;ve been watching chat the
                whole time.
              </p>
            )}
            {turns.map((turn) => (
              <div
                key={turn.id}
                className={cn(
                  "max-w-[95%] rounded-lg px-2.5 py-1.5 text-xs leading-5",
                  turn.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted",
                )}
              >
                {turn.toolCalls && <ToolCallTrace calls={turn.toolCalls} />}
                {turn.text}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Sparkles className="size-3 animate-pulse text-primary" />
                reading chat…
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1 px-3 pb-1.5">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={busy}
                onClick={() => void ask(prompt)}
                className="rounded-full border border-primary/40 px-2 py-0.5 text-[10px] text-primary hover:bg-primary/10 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 border-t p-2">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit();
              }}
              placeholder="Ask Sidekick anything…"
              className="h-8 text-xs"
            />
            <Button size="icon" className="size-8 shrink-0" onClick={submit} disabled={busy}>
              <Send className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => setOpen(true)}
          className="h-12 gap-2 rounded-full px-4 shadow-2xl shadow-black/50"
        >
          <Bot className="size-5" />
          Sidekick
        </Button>
      )}
    </div>
  );
}
