/**
 * The LLM Sidekick brain: a tool-loop agent whose only source of truth is the
 * insight engine + chat engine (via the composition root). Tool names are the
 * frozen insight-API contract, so the copilot UI's tool-call display and the
 * ElevenLabs agent config stay valid.
 *
 * Provider is resolved from env: `SIDEKICK_LLM` (anthropic | fireworks | off)
 * wins; otherwise whichever of ANTHROPIC_API_KEY / FIREWORKS_API_KEY is set.
 * When unresolved this module returns null and callers fall back to the
 * scripted brain (`/api/copilot/ask`) — the demo path never depends on an
 * external API.
 */

import { ToolLoopAgent, isStepCount, tool, type InferAgentUIMessage, type LanguageModel } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { fireworks } from "@ai-sdk/fireworks";
import { z } from "zod";

import { getSidekickRuntime } from "@/lib/sidekick/runtime";

const DEFAULT_MODELS = {
  anthropic: "claude-haiku-4-5",
  fireworks: "accounts/fireworks/models/kimi-k2p6",
} as const;

function resolveModel(): LanguageModel | null {
  const forced = process.env.SIDEKICK_LLM;
  if (forced === "off") return null;

  const override = process.env.SIDEKICK_LLM_MODEL;
  const provider =
    forced === "anthropic" || forced === "fireworks"
      ? forced
      : process.env.ANTHROPIC_API_KEY
        ? "anthropic"
        : process.env.FIREWORKS_API_KEY
          ? "fireworks"
          : null;

  switch (provider) {
    case "anthropic":
      return anthropic(override ?? DEFAULT_MODELS.anthropic);
    case "fireworks":
      return fireworks(override ?? DEFAULT_MODELS.fireworks);
    case null:
      return null;
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unknown provider: ${String(exhaustive)}`);
    }
  }
}

const INSTRUCTIONS = `You are Sidekick, the AI copilot embedded in a KICK live stream. You watch chat so viewers don't have to scroll and so the streamer doesn't lose questions.

Ground every answer in tool data — never invent stream facts. You only see chat events, never the video. Call several tools when the question is broad ("what did I miss?" → context, vibe, trending, chatters). When someone asks something the streamer may have covered, check get_answered_questions first, then get_recent_questions to see if it's already being tracked; if it is, say it's flagged.

Style: plain text only, no markdown. 1-3 short sentences with chat-native energy — punchy, warm, a little playful, never cringe. Use @names when calling out chatters. Numbers beat adjectives ("34 msg/min" over "very active").

Recaps: when asked to recap or catch up ("what did I miss?", "recap the stream", "catch me up", "recap the last N minutes"), always call get_stream_context + get_transcript + get_recent_questions. Answer in up to 4 short sentences: the scene (title, uptime), the top topics or moments from the transcript with @names, then how many questions are waiting for the streamer (or that the queue is clear).`;

const sidekickTools = {
  get_chat_vibe: tool({
    description:
      "Current chat mood: hype/chill/tilted/dead, messages per minute vs baseline, emote ratio.",
    inputSchema: z.object({}),
    execute: async () => getSidekickRuntime().insights.vibe(),
  }),
  get_trending: tool({
    description: "Words and emotes spiking in chat over the last 90 seconds.",
    inputSchema: z.object({}),
    execute: async () => getSidekickRuntime().insights.trending(),
  }),
  get_recent_questions: tool({
    description:
      "Clustered questions viewers are asking, with ask counts and answered status.",
    inputSchema: z.object({}),
    execute: async () => ({ questions: getSidekickRuntime().insights.questions() }),
  }),
  get_new_chatters: tool({
    description:
      "Who's active in the last 10 minutes: first-timers, mods, subs, recent followers, notable moments.",
    inputSchema: z.object({}),
    execute: async () => getSidekickRuntime().insights.chatters(),
  }),
  get_stream_context: tool({
    description:
      "Stream metadata: streamer, title, category, uptime, viewer count, and a primer on who the streamer is.",
    inputSchema: z.object({}),
    execute: async () => getSidekickRuntime().insights.context(),
  }),
  get_answered_questions: tool({
    description:
      "Questions the streamer already answered. Pass the viewer's question to find a matching answer, or omit it to list everything answered.",
    inputSchema: z.object({
      question: z
        .string()
        .optional()
        .describe("The viewer's question, to match against answered clusters"),
    }),
    execute: async ({ question }) => {
      const insights = getSidekickRuntime().insights;
      if (question) return { match: insights.findAnswered(question) };
      return { answered: insights.questions().filter((cluster) => cluster.answered) };
    },
  }),
  get_recent_chat: tool({
    description:
      "Raw recent chat messages (newest last), for quoting or questions about what specific chatters said.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(60).optional().describe("How many messages, default 30"),
    }),
    execute: async ({ limit }) => {
      const messages = getSidekickRuntime()
        .engine.getRecent(0)
        .flatMap((stamped) =>
          stamped.event.type === "chat.message.sent"
            ? [
                {
                  username: stamped.event.payload.sender.username,
                  content: stamped.event.payload.content,
                  at: stamped.event.payload.created_at,
                },
              ]
            : [],
        );
      return { messages: messages.slice(-(limit ?? 30)) };
    },
  }),
  get_transcript: tool({
    description:
      "Full transcript of the stream's chat so far (newest last), optionally scoped to the last N minutes. Use for recaps and catch-ups; prefer get_recent_chat for quick quotes.",
    inputSchema: z.object({
      minutes: z
        .number()
        .int()
        .min(1)
        .max(120)
        .optional()
        .describe("Only messages from the last N minutes; omit for the whole session"),
      limit: z.number().int().min(1).max(200).optional().describe("Max messages, default 80"),
    }),
    execute: async ({ minutes, limit }) => {
      const cutoff = minutes === undefined ? null : Date.now() - minutes * 60_000;
      const messages = getSidekickRuntime()
        .engine.getRecent(0)
        .flatMap((stamped) =>
          stamped.event.type === "chat.message.sent"
            ? [
                {
                  username: stamped.event.payload.sender.username,
                  content: stamped.event.payload.content,
                  at: stamped.event.payload.created_at,
                },
              ]
            : [],
        )
        .filter((message) => cutoff === null || Date.parse(message.at) >= cutoff);
      return {
        total_available: messages.length,
        messages: messages.slice(-(limit ?? 80)),
      };
    },
  }),
};

function buildAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: INSTRUCTIONS,
    tools: sidekickTools,
    stopWhen: isStepCount(6),
  });
}

export type SidekickAgent = ReturnType<typeof buildAgent>;
export type SidekickUIMessage = InferAgentUIMessage<SidekickAgent>;

let cachedAgent: SidekickAgent | null | undefined;

/** The LLM agent, or null when no provider is configured (scripted fallback). */
export function getSidekickAgent(): SidekickAgent | null {
  if (cachedAgent === undefined) {
    const model = resolveModel();
    cachedAgent = model ? buildAgent(model) : null;
  }
  return cachedAgent;
}

/** The raw model (same provider resolution), for auxiliary single-shot calls
 * like the voice pipeline's speech-compression pass. */
export function getSidekickModel(): LanguageModel | null {
  return resolveModel();
}
