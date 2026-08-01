import { NextResponse } from "next/server";

import { getFastSidekickAgent } from "@/lib/sidekick/agent";
import { maskSpeech } from "@/lib/sidekick/clean-speech";
import { postVoiceBriefing } from "@/lib/sidekick/voice-briefing";

import { POST as scriptedAsk } from "../../copilot/ask/route";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Recaps carry more ground to cover, so they get a slightly longer spoken budget. */
const RECAP_PATTERN = /recap|catch me up|catch up|what did i miss|missed/i;

const PROMPT_LEAK_PATTERN =
  /\b(?:the user (?:wants|asked)|i need to|system prompt|instructions?|under \d+ words|never (?:add|speak)|let me (?:compress|rewrite)|output only)\b/i;
const NUMBERED_LIST_PATTERN = /(?:^|\s)\d+\.\s/;

/**
 * Keeps model reasoning and prompt echoes away from TTS, then trims only at a
 * complete sentence boundary. Returns null rather than speaking unsafe text.
 */
function cleanSpokenAnswer(text: string, question: string): string | null {
  const recap = RECAP_PATTERN.test(question);
  const maxWords = recap ? 90 : 60;
  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const candidate =
    [...paragraphs].reverse().find((part) => !PROMPT_LEAK_PATTERN.test(part)) ?? "";
  const quoteCount = (candidate.match(/"/g) ?? []).length;
  if (
    !candidate ||
    PROMPT_LEAK_PATTERN.test(candidate) ||
    NUMBERED_LIST_PATTERN.test(candidate) ||
    quoteCount % 2 !== 0 ||
    !/[.!?]["']?$/.test(candidate)
  ) {
    return null;
  }

  const words = candidate.split(/\s+/);
  if (words.length <= maxWords) return candidate;

  const window = words.slice(0, maxWords).join(" ");
  const boundary = Math.max(window.lastIndexOf("."), window.lastIndexOf("!"), window.lastIndexOf("?"));
  return boundary >= window.length * 0.45 ? window.slice(0, boundary + 1).trim() : null;
}

async function scriptedAnswer(question: string): Promise<string> {
  const response = await scriptedAsk(
    new Request("http://sidekick.internal/api/copilot/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, audience: "streamer" }),
    }),
  );
  const data = (await response.json()) as { answer?: string };
  return data.answer ?? "I didn't catch that — ask me about chat.";
}

/**
 * Benjamin's tool-loop agent produces a concise, grounded spoken answer in one
 * model pass. Falls back to the scripted brain when no LLM is configured or
 * anything fails.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { question?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ error: "question required" }, { status: 400 });
  }

  // The viewer-visible 🎙 line fires whenever the streamer asks about the
  // question queue, regardless of which brain answers. Debounced internally.
  if (/question|should i answer|want to know|asking|queue/i.test(question)) {
    void postVoiceBriefing().catch(() => {});
  }

  const agent = getFastSidekickAgent();
  let answer: string;
  let source = "scripted";

  if (agent) {
    try {
      const result = await agent.generate({ prompt: question });
      const cleaned = cleanSpokenAnswer(result.text, question);
      if (cleaned) {
        answer = cleaned;
        source = "agent";
      } else {
        console.warn("[voice/answer] blocked malformed or prompt-leaking agent output");
        answer = await scriptedAnswer(question);
      }
    } catch (error) {
      console.warn("[voice/answer] agent failed, using scripted brain:", error);
      answer = await scriptedAnswer(question);
    }
  } else {
    answer = await scriptedAnswer(question);
  }

  return NextResponse.json({ answer: maskSpeech(answer), source });
}
