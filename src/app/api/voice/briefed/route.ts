import { NextResponse } from "next/server";

import { getSidekickRuntime } from "@/lib/sidekick/runtime";
import { VOICE_PRESET } from "@/lib/sidekick/voice-preset";

export const dynamic = "force-dynamic";

const DEBOUNCE_MS = 60_000;

const globalForBriefed = globalThis as typeof globalThis & {
  sidekickLastBriefedAt?: number;
};

/**
 * Called when the streamer's voice agent pulls the question queue. Surfaces a
 * single chat line so viewers see that the streamer just consulted chat —
 * the voice half of the feedback loop, made visible. Debounced, and silent
 * when there is nothing worth announcing.
 */
export async function POST() {
  const now = Date.now();
  const last = globalForBriefed.sidekickLastBriefedAt ?? 0;
  if (now - last < DEBOUNCE_MS) {
    return NextResponse.json({ ok: true, posted: false, reason: "debounced" });
  }

  const { engine, insights } = getSidekickRuntime();
  const top = insights.questions().find((cluster) => !cluster.answered);
  if (!top) {
    return NextResponse.json({ ok: true, posted: false, reason: "nothing pending" });
  }

  globalForBriefed.sidekickLastBriefedAt = now;
  await engine.postBotMessage(
    `🎙 ${VOICE_PRESET.streamer} just asked what chat wants to know — "${top.representative}" (asked ${top.count}×) is up next`,
  );
  return NextResponse.json({ ok: true, posted: true });
}
