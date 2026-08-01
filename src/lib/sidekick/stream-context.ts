import { getKickSubscriptionState, type KickConnectDeps } from "@/lib/sidekick/kick-connect";

import type { InsightEngine, StreamContext } from "./insights";

function credentials(): KickConnectDeps | null {
  const clientId = process.env.KICK_CLIENT_ID;
  const clientSecret = process.env.KICK_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function minutesSince(timestamp: string | null): number {
  if (!timestamp) return 0;
  const startedAt = Date.parse(timestamp);
  if (Number.isNaN(startedAt)) return 0;
  return Math.max(0, Math.floor((Date.now() - startedAt) / 60_000));
}

/**
 * Stream context for agents and API clients.
 *
 * The insight engine owns chat-derived context. When a live KICK channel is
 * connected, the KICK subscription endpoint already resolves authoritative
 * stream metadata (title/category/viewers/start time), so merge that into the
 * frozen `get_stream_context` contract instead of making the agent guess from
 * chat events.
 */
export async function getStreamContext(insights: InsightEngine): Promise<StreamContext> {
  const fallback = insights.context();
  const deps = credentials();
  if (!deps) return fallback;

  try {
    const state = await getKickSubscriptionState(deps);
    if (!state.channel || state.conflict) return fallback;

    const uptimeMinutes = minutesSince(state.channel.started_at);
    const title = state.channel.stream_title || fallback.title;
    const category = state.channel.category || fallback.category;

    return {
      streamer: state.channel.slug,
      title,
      category,
      uptime_minutes: uptimeMinutes,
      viewer_count: state.channel.viewer_count,
      streamer_primer: `${state.channel.slug} is the connected KICK channel. Current KICK stream info: "${title}" in ${category}, ${state.channel.viewer_count.toLocaleString()} viewers, ${state.channel.is_live ? `${uptimeMinutes}m live` : "offline"}. Use chat data for what happened on stream; don't invent biography.`,
    };
  } catch (error) {
    console.error("[stream-context] failed to resolve KICK stream metadata", error);
    return fallback;
  }
}
