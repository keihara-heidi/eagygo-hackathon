import { generateText } from "ai";
import { NextResponse } from "next/server";

import { getSidekickAgent, getSidekickModel } from "@/lib/sidekick/agent";
import { maskSpeech } from "@/lib/sidekick/clean-speech";
import { postVoiceBriefing } from "@/lib/sidekick/voice-briefing";

import { POST as scriptedAsk } from "../../copilot/ask/route";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const REPHRASE_SYSTEM = [
  "You compress a stream copilot's answer for text-to-speech.",
  "Output ONLY the rewritten text: at most two short spoken sentences, under 45 words total.",
  "Keep the most important facts and numbers from the input.",
  "Never add information that is not in the input. Never answer questions yourself.",
  "Never speak as the streamer — you are the copilot reporting about chat.",
  "No quotes, no preamble, no lists, no markdown, no emojis.",
].join(" ");

/** Skip the compression pass when the agent was already brief. */
const REPHRASE_THRESHOLD_CHARS = 180;

/** Strips preambles/quotes the rephrase model occasionally adds anyway. */
function cleanRephrased(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^here'?s[^:\n]*:\s*/i, "");
  cleaned = cleaned.replace(/^"([\s\S]*)"$/m, "$1");
  // Hard cap at three sentences as a last resort.
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > 3) cleaned = sentences.slice(0, 3).join(" ");
  return cleaned.trim();
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
 * One brain, two passes: Benjamin's tool-loop LLM agent produces a grounded
 * answer, then a compression pass rewrites it into 1-2 natural spoken
 * sentences for TTS. Falls back to the scripted brain (already concise) when
 * no LLM is configured or anything fails.
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

  const agent = getSidekickAgent();
  let answer: string;
  let source = "scripted";

  if (agent) {
    try {
      const result = await agent.generate({ prompt: question });
      answer = result.text.trim();
      source = "agent";

      const model = getSidekickModel();
      if (model && answer.length > REPHRASE_THRESHOLD_CHARS) {
        const compressed = await generateText({
          model,
          system: REPHRASE_SYSTEM,
          prompt: answer,
          maxOutputTokens: 150,
          temperature: 0.3,
        });
        const cleaned = cleanRephrased(compressed.text);
        if (cleaned) {
          answer = cleaned;
          source = "agent+rephrase";
        }
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
