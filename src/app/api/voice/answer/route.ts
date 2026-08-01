import { NextResponse } from "next/server";

import { getFastSidekickAgent } from "@/lib/sidekick/agent";
import { maskSpeech } from "@/lib/sidekick/clean-speech";
import { postVoiceBriefing } from "@/lib/sidekick/voice-briefing";

import { POST as scriptedAsk } from "../../copilot/ask/route";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Recaps carry more ground to cover, so they get a slightly longer spoken budget. */
const RECAP_PATTERN = /recap|catch me up|catch up|what did i miss|missed/i;

/** Deterministic safety cap; avoids paying for a second LLM rewrite. */
function capSpokenAnswer(text: string, question: string): string {
  const recap = RECAP_PATTERN.test(question);
  const maxSentences = recap ? 3 : 2;
  const maxWords = recap ? 70 : 45;
  const cleaned = text.replace(/\s+/g, " ").trim();
  const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [cleaned];
  const answer = sentences.slice(0, maxSentences).join(" ").trim();
  const words = answer.split(/\s+/);
  if (words.length <= maxWords) return answer;
  return `${words.slice(0, maxWords).join(" ").replace(/[,:;—-]+$/, "")}.`;
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
      answer = capSpokenAnswer(result.text, question);
      source = "agent";
    } catch (error) {
      console.warn("[voice/answer] agent failed, using scripted brain:", error);
      answer = await scriptedAnswer(question);
    }
  } else {
    answer = await scriptedAnswer(question);
  }

  return NextResponse.json({ answer: maskSpeech(answer), source });
}
