"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import {
  askCopilot,
  streamCopilotChat,
  type CopilotChatPayloadMessage,
  type CopilotToolCall,
} from "@/lib/viewer-chat-api";

export interface SidekickAgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: CopilotToolCall[];
}

/**
 * Sidekick agent chat. Streams from the LLM route (/copilot/chat) and falls
 * back to the scripted brain (/copilot/ask) when the LLM is unconfigured or
 * fails — same message shape either way, so surfaces don't care which brain
 * answered.
 */
export function useSidekickAgentChat() {
  const [messages, setMessages] = useState<SidekickAgentMessage[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isError, setIsError] = useState(false);
  // Sends are serialized (busyRef), so the ref is the source of truth and
  // lets async stream callbacks read fresh history without stale closures.
  const messagesRef = useRef<SidekickAgentMessage[]>([]);
  const busyRef = useRef(false);

  const upsert = useCallback((message: SidekickAgentMessage) => {
    const current = messagesRef.current;
    const index = current.findIndex((entry) => entry.id === message.id);
    const next =
      index === -1
        ? [...current, message]
        : current.map((entry, i) => (i === index ? message : entry));
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const sendMessage = useCallback(
    (question: string) => {
      const trimmed = question.trim();
      if (trimmed.length === 0 || busyRef.current) return;
      busyRef.current = true;
      setIsError(false);
      setIsPending(true);

      console.info("[sidekick-agent] request started", { question: trimmed });
      upsert({ id: crypto.randomUUID(), role: "user", content: trimmed });
      const assistantId = crypto.randomUUID();
      const history: CopilotChatPayloadMessage[] = messagesRef.current.map((message) => ({
        id: message.id,
        role: message.role,
        text: message.content,
      }));

      void (async () => {
        try {
          try {
            const final = await streamCopilotChat(history, (snapshot) => {
              setIsPending(false);
              setIsStreaming(true);
              upsert({
                id: assistantId,
                role: "assistant",
                content: snapshot.content,
                toolCalls: snapshot.toolCalls,
              });
            });
            console.info("[sidekick-agent] llm response finished", {
              question: trimmed,
              toolCalls: final.toolCalls.map((toolCall) => toolCall.tool),
              answerLength: final.content.length,
            });
          } catch (streamError) {
            // LLM off or died mid-answer — the scripted brain keeps the demo alive.
            console.info("[sidekick-agent] falling back to scripted brain", {
              question: trimmed,
              reason: streamError instanceof Error ? streamError.message : String(streamError),
            });
            const scripted = await askCopilot(trimmed);
            console.info("[sidekick-agent] scripted response received", {
              question: trimmed,
              intent: scripted.intent,
              toolCalls: scripted.tool_calls.map((toolCall) => toolCall.tool),
            });
            upsert({
              id: assistantId,
              role: "assistant",
              content: scripted.answer,
              toolCalls: scripted.tool_calls,
            });
          }
        } catch (error) {
          console.error("[sidekick-agent] request failed", {
            question: trimmed,
            message: error instanceof Error ? error.message : String(error),
          });
          setIsError(true);
        } finally {
          busyRef.current = false;
          setIsPending(false);
          setIsStreaming(false);
        }
      })();
    },
    [upsert],
  );

  const reset = useCallback(() => {
    console.info("[sidekick-agent] messages reset", { count: messagesRef.current.length });
    messagesRef.current = [];
    setMessages([]);
    setIsError(false);
  }, []);

  return useMemo(
    () => ({
      messages,
      sendMessage,
      isPending,
      isStreaming,
      isError,
      reset,
    }),
    [messages, sendMessage, isPending, isStreaming, isError, reset],
  );
}
