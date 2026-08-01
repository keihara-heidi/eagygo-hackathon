import { NextResponse } from "next/server";

import { buildChatMessage } from "@/lib/sidekick/mock-engine";
import { PERSONAS, STREAMER } from "@/lib/sidekick/personas";
import { getSession } from "@/lib/sidekick/session";

export const dynamic = "force-dynamic";

/**
 * Injects a chat message into the mock stream, mirroring what
 * POST /public/v1/chat does against the real Kick API. Used by the demo for
 * viewer-typed messages and the mod/streamer `!answered` command.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    content?: unknown;
    as?: unknown;
  } | null;
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content || content.length > 500) {
    return NextResponse.json(
      { error: "content must be a non-empty string of at most 500 chars" },
      { status: 400 },
    );
  }

  const as = typeof body?.as === "string" ? body.as : "viewer";
  const mod = PERSONAS.find((persona) => persona.kind === "mod");
  const viewer = PERSONAS.find((persona) => persona.kind === "regular");
  const sender =
    as === "streamer" ? STREAMER
    : as === "mod" && mod ? mod.user
    : viewer ? viewer.user
    : STREAMER;

  getSession().ingest(buildChatMessage(sender, content));
  return NextResponse.json({ ok: true, is_sent: true });
}
