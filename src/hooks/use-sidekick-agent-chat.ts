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
    mutationFn: askCopilot,
    onMutate: (question) => {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "user", content: question },
      ]);
    },
    onSuccess: (response) => {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.answer,
          toolCalls: response.tool_calls,
        },
      ]);
    },
  });

  return useMemo(
    () => ({
      messages,
      sendMessage: ask.mutate,
      isPending: ask.isPending,
      isError: ask.isError,
      reset: () => setMessages([]),
    }),
    [ask.isError, ask.isPending, ask.mutate, messages],
  );
}
