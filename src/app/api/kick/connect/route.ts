/**
 * POST /api/kick/connect { slug } — point this app's webhook subscriptions at
 * a real KICK channel (app token; no user login or broadcaster authorization
 * needed). On success the mock demo baseline stops so live chat isn't
 * interleaved with fake chatter. DELETE reverses it: drop all subscriptions
 * and resume the demo baseline.
 */

import { getChatEngine } from "@/lib/chat-engine";
import {
  connectKickChannel,
  disconnectKickChannel,
  isValidKickSlug,
} from "@/lib/sidekick/kick-connect";

function credentials() {
  const clientId = process.env.KICK_CLIENT_ID;
  const clientSecret = process.env.KICK_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function credentialsError() {
  return Response.json(
    { error: "KICK app credentials not configured (KICK_CLIENT_ID / KICK_CLIENT_SECRET)" },
    { status: 503 },
  );
}

export async function POST(request: Request) {
  const deps = credentials();
  if (!deps) return credentialsError();

  let slug: unknown;
  try {
    ({ slug } = (await request.json()) as { slug?: unknown });
  } catch {
    return Response.json({ error: "Expected JSON body { slug }" }, { status: 400 });
  }
  if (!isValidKickSlug(slug)) {
    return Response.json({ error: "Invalid Kick channel slug" }, { status: 400 });
  }

  try {
    const result = await connectKickChannel(slug, deps);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    getChatEngine().demo.stop();
    return Response.json({
      broadcaster_user_id: result.broadcaster_user_id,
      channel: result.channel,
      subscriptions: result.subscriptions,
      existing_subscriptions: result.existing_subscriptions,
      deleted_subscription_count: result.deleted_subscription_count,
    });
  } catch (error) {
    console.error("[kick-connect] connect failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "KICK API request failed" },
      { status: 502 },
    );
  }
}

export async function DELETE() {
  const deps = credentials();
  if (!deps) return credentialsError();

  try {
    const { deleted } = await disconnectKickChannel(deps);
    getChatEngine().demo.start();
    return Response.json({ ok: true, deleted });
  } catch (error) {
    console.error("[kick-connect] disconnect failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "KICK API request failed" },
      { status: 502 },
    );
  }
}
