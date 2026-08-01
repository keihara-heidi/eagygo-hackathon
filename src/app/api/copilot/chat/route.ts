import { createAgentUIStreamResponse } from "ai";
import { NextResponse } from "next/server";

import { getSidekickAgent } from "@/lib/sidekick/agent";

export const dynamic = "force-dynamic";

/**
 * Streaming LLM Sidekick. Accepts UI messages, runs the tool-loop agent over
 * the insight engine, and streams UIMessage chunks (SSE). Responds 503 when no
 * LLM provider is configured — the client then falls back to the scripted
 * brain at /api/copilot/ask.
 */
export async function POST(request: Request) {
  const agent = getSidekickAgent();
  if (!agent) {
    return NextResponse.json({ error: "llm_not_configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { messages?: unknown } | null;
  if (!Array.isArray(body?.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages_required" }, { status: 400 });
  }

  return createAgentUIStreamResponse({
    agent,
    uiMessages: body.messages,
  });
}
