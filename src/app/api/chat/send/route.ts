import { NextResponse } from "next/server";

import { CAST, STREAMER } from "@/lib/chat-engine/cast";
import { chatMessageDelivery } from "@/lib/chat-engine/deliveries";
import { getSidekickRuntime } from "@/lib/sidekick/runtime";

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
  const mod = CAST.find((member) => member.kind === "mod");
  const viewer = CAST.find((member) => member.kind === "regular");
  const sender =
    as === "streamer" ? STREAMER
    : as === "mod" && mod ? mod.user
    : viewer ? viewer.user
    : STREAMER;

  getSidekickRuntime().engine.publish(
    chatMessageDelivery({ sender, text: content }, new Date()),
  );
  return NextResponse.json({ ok: true, is_sent: true });
}
