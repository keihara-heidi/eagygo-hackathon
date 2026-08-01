"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { askCopilot, type CopilotToolCall } from "@/lib/viewer-chat-api";

export interface SidekickAgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: CopilotToolCall[];
}

export function useSidekickAgentChat() {
  const [messages, setMessages] = useState<SidekickAgentMessage[]>([]);

  const ask = useMutation({
    mutationFn: (question: string) => {
      console.info("[sidekick-agent] request started", { question });
      return askCopilot(question);
    },
    onMutate: (question) => {
      const messageId = crypto.randomUUID();
      console.info("[sidekick-agent] user message queued", { messageId, question });
      setMessages((current) => [
        ...current,
        { id: messageId, role: "user", content: question },
      ]);
    },
    onSuccess: (response, question) => {
      const messageId = crypto.randomUUID();
      console.info("[sidekick-agent] response received", {
        messageId,
        question,
        intent: response.intent,
        toolCalls: response.tool_calls.map((toolCall) => toolCall.tool),
        answerLength: response.answer.length,
      });
      setMessages((current) => [
        ...current,
        {
          id: messageId,
          role: "assistant",
          content: response.answer,
          toolCalls: response.tool_calls,
        },
      ]);
    },
    onError: (error, question) => {
      console.error("[sidekick-agent] request failed", {
        question,
        message: error instanceof Error ? error.message : String(error),
      });
    },
    onSettled: (_response, _error, question) => {
      console.info("[sidekick-agent] request settled", { question });
    },
  });

  return useMemo(
    () => ({
      messages,
      sendMessage: ask.mutate,
      isPending: ask.isPending,
      isError: ask.isError,
      reset: () => {
        console.info("[sidekick-agent] messages reset", { count: messages.length });
        setMessages([]);
      },
    }),
    [ask.isError, ask.isPending, ask.mutate, messages],
  );
}
