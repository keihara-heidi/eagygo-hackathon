import { queryOptions } from "@tanstack/react-query";
import {
  getToolName,
  isToolUIPart,
  parseJsonEventStream,
  readUIMessageStream,
  uiMessageChunkSchema,
  type UIMessage,
  type UIMessageChunk,
} from "ai";

import { apiClient } from "@/lib/api-client";
import type {
  ChattersResult,
  QuestionCluster,
  StreamContext,
  TrendingResult,
  VibeResult,
} from "@/lib/sidekick/insights";

export interface CopilotToolCall {
  tool: string;
  request: string;
  summary: string;
}

export interface CopilotAnswer {
  intent: string;
  answer: string;
  tool_calls: CopilotToolCall[];
}

export const streamContextQueryOptions = queryOptions({
  queryKey: ["insights", "context"],
  queryFn: async () => {
    const response = await apiClient.get<StreamContext>("/insights/context");
    return response.data;
  },
});

export async function askCopilot(question: string): Promise<CopilotAnswer> {
  const response = await apiClient.post<CopilotAnswer>("/copilot/ask", { question });
  return response.data;
}

// ---------------------------------------------------------------------------
// Streaming LLM copilot (/api/copilot/chat)
// ---------------------------------------------------------------------------

export interface CopilotChatPayloadMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export interface CopilotStreamSnapshot {
  content: string;
  toolCalls: CopilotToolCall[];
}

/** Display metadata for the tool-call trace; names are the frozen contract. */
const TOOL_REQUESTS: Record<string, string> = {
  get_chat_vibe: "GET /api/insights/vibe",
  get_trending: "GET /api/insights/trending",
  get_recent_questions: "GET /api/insights/questions",
  get_new_chatters: "GET /api/insights/chatters",
  get_stream_context: "GET /api/insights/context",
  get_answered_questions: "GET /api/insights/answered",
  get_recent_chat: "chat-engine · recent messages",
};

function summarizeToolOutput(toolName: string, output: unknown): string {
  switch (toolName) {
    case "get_chat_vibe": {
      const vibe = output as VibeResult;
      return `${vibe.vibe} · ${vibe.messages_per_minute} msg/min`;
    }
    case "get_trending": {
      const trending = output as TrendingResult;
      const top = trending.words[0];
      return top ? `top word ${top.word}` : "quiet";
    }
    case "get_recent_questions": {
      const { questions } = output as { questions: QuestionCluster[] };
      const pending = questions.filter((cluster) => !cluster.answered);
      const top = pending[0];
      return top ? `${pending.length} pending · top asked ${top.count}x` : "queue empty";
    }
    case "get_new_chatters": {
      const chatters = output as ChattersResult;
      return `${chatters.active_last_10m} active · ${chatters.first_timers.length} first-timers`;
    }
    case "get_stream_context": {
      const context = output as StreamContext;
      return `${context.category} · ${context.viewer_count.toLocaleString()} viewers`;
    }
    case "get_answered_questions": {
      const result = output as { match?: QuestionCluster | null; answered?: QuestionCluster[] };
      if (result.answered) return `${result.answered.length} answered`;
      return result.match ? `matched "${result.match.representative}"` : "no match on record";
    }
    case "get_recent_chat": {
      const { messages } = output as { messages: unknown[] };
      return `${messages.length} messages`;
    }
    default:
      return "done";
  }
}

function toSnapshot(message: UIMessage): CopilotStreamSnapshot {
  let content = "";
  const toolCalls: CopilotToolCall[] = [];
  for (const part of message.parts) {
    if (part.type === "text") {
      content += part.text;
    } else if (isToolUIPart(part)) {
      const toolName = getToolName(part);
      toolCalls.push({
        tool: toolName,
        request: TOOL_REQUESTS[toolName] ?? toolName,
        summary:
          part.state === "output-available"
            ? summarizeToolOutput(toolName, part.output)
            : "running…",
      });
    }
  }
  return { content, toolCalls };
}

function toChunkStream(body: ReadableStream<Uint8Array>): ReadableStream<UIMessageChunk> {
  return parseJsonEventStream({ stream: body, schema: uiMessageChunkSchema }).pipeThrough(
    new TransformStream({
      transform(result, controller) {
        if (!result.success) throw result.error;
        controller.enqueue(result.value);
      },
    }),
  );
}

/**
 * Streams an answer from the LLM Sidekick, invoking `onSnapshot` with the
 * accumulated message on every chunk. Throws when the LLM route is
 * unavailable (503 = not configured) or the stream errors — callers fall
 * back to the scripted brain.
 */
export async function streamCopilotChat(
  history: CopilotChatPayloadMessage[],
  onSnapshot: (snapshot: CopilotStreamSnapshot) => void,
): Promise<CopilotStreamSnapshot> {
  const response = await fetch("/api/copilot/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: history.map((message) => ({
        id: message.id,
        role: message.role,
        parts: [{ type: "text", text: message.text }],
      })),
    }),
  });
  if (!response.ok || !response.body) {
    throw new Error(`copilot stream unavailable (${response.status})`);
  }

  let last: CopilotStreamSnapshot = { content: "", toolCalls: [] };
  for await (const message of readUIMessageStream({
    stream: toChunkStream(response.body),
    terminateOnError: true,
  })) {
    last = toSnapshot(message);
    onSnapshot(last);
  }
  if (last.content.trim().length === 0) {
    throw new Error("copilot stream produced no answer");
  }
  return last;
}
