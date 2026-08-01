import { getSidekickRuntime } from "@/lib/sidekick/runtime";
import { VOICE_PRESET } from "@/lib/sidekick/voice-preset";

const DEBOUNCE_MS = 60_000;

const globalForBriefed = globalThis as typeof globalThis & {
  sidekickLastBriefedAt?: number;
};

/**
 * Surfaces a single chat line telling viewers the streamer just consulted
 * chat by voice — the visible half of the voice feedback loop. Debounced,
 * silent when nothing is pending.
 */
export async function postVoiceBriefing(): Promise<{ posted: boolean; reason?: string }> {
  const now = Date.now();
  const last = globalForBriefed.sidekickLastBriefedAt ?? 0;
  if (now - last < DEBOUNCE_MS) return { posted: false, reason: "debounced" };

  const { engine, insights } = getSidekickRuntime();
  const top = insights.questions().find((cluster) => !cluster.answered);
  if (!top) return { posted: false, reason: "nothing pending" };

  globalForBriefed.sidekickLastBriefedAt = now;
  await engine.postBotMessage(
    `🎙 ${VOICE_PRESET.streamer} just asked what chat wants to know — "${top.representative}" (asked ${top.count}×) is up next`,
  );
  return { posted: true };
}
