import { NextResponse } from "next/server";

import { getInsights } from "@/lib/sidekick/insights";
import { buildChatMessage } from "@/lib/sidekick/mock-engine";
import { SIDEKICK_BOT, STREAMER } from "@/lib/sidekick/personas";
import { getSession } from "@/lib/sidekick/session";

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

  const session = getSession();
  const top = getInsights(session)
    .questions()
    .find((cluster) => !cluster.answered);
  if (!top) {
    return NextResponse.json({ ok: true, posted: false, reason: "nothing pending" });
  }

  globalForBriefed.sidekickLastBriefedAt = now;
  session.ingest(
    buildChatMessage(
      SIDEKICK_BOT,
      `🎙 ${STREAMER.username} just asked what chat wants to know — "${top.representative}" (asked ${top.count}×) is up next`,
    ),
  );
  return NextResponse.json({ ok: true, posted: true });
}
