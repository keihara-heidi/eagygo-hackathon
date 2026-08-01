import { NextResponse } from "next/server";

import { maskSlurs } from "@/lib/sidekick/clean-speech";
import { getSidekickRuntime } from "@/lib/sidekick/runtime";

export const dynamic = "force-dynamic";

/**
 * Ingress for real Kick chat relayed by the browser (Pusher websocket
 * adapter on /voice). Payloads are already mapped to the documented
 * chat.message.sent webhook shape, so they flow through the exact same
 * engine seam as mock scenarios and the future signed-webhook receiver.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    payload?: Record<string, unknown>;
  } | null;
  const payload = body?.payload;
  if (!payload || typeof payload !== "object" || typeof payload.content !== "string") {
    return NextResponse.json({ error: "expected { payload: ChatMessageEvent }" }, { status: 400 });
  }

  // Hate speech never enters the engine — masked before ingest so the chat
  // overlay, insights and digests all see the cleaned content.
  payload.content = maskSlurs(payload.content);

  const stamped = getSidekickRuntime().engine.publish({
    eventType: "chat.message.sent",
    eventVersion: 1,
    body: payload,
  });
  return NextResponse.json({ ok: true, seq: stamped.seq });
}
