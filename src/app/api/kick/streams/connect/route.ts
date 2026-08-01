import { NextResponse } from "next/server";

import { createKickClient } from "@/lib/kick/client";
import { KICK_EVENT_TYPES } from "@/lib/kick/events";
import { KickApiError } from "@/lib/kick/http";
import { createOAuthClient } from "@/lib/kick/oauth";

export const dynamic = "force-dynamic";

interface ConnectKickStreamBody {
  slug?: unknown;
}

const SLUG_PATTERN = /^[a-z0-9_-]{2,40}$/i;

function normalizeSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^@/, "");
  return SLUG_PATTERN.test(trimmed) ? trimmed : null;
}

async function createAppKickClient() {
  const clientId = process.env.KICK_CLIENT_ID;
  const clientSecret = process.env.KICK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("KICK_CLIENT_ID and KICK_CLIENT_SECRET are required");
  }

  const token = await createOAuthClient({ clientId, clientSecret }).clientCredentials();
  return createKickClient({ token: token.access_token });
}

export async function POST(request: Request) {
  let body: ConnectKickStreamBody;
  try {
    body = (await request.json()) as ConnectKickStreamBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const requestedSlug = normalizeSlug(body.slug);
  if (!requestedSlug) {
    return NextResponse.json({ error: "slug must be a KICK channel slug" }, { status: 400 });
  }

  try {
    const client = await createAppKickClient();
    const [channel] = await client.channels.list({ slug: [requestedSlug] });
    if (!channel) {
      return NextResponse.json({ error: `KICK channel @${requestedSlug} not found` }, { status: 404 });
    }

    const broadcasterUserId = channel.broadcaster_user_id;
    const stream = channel.stream;
    const existing = await client.events.subscriptions.list({
      broadcaster_user_id: broadcasterUserId,
    });
    const existingKeys = new Set(
      existing.map((subscription) => `${subscription.event}:${subscription.version}`),
    );
    const missingEvents = KICK_EVENT_TYPES
      .map((name) => ({ name, version: 1 }))
      .filter((event) => !existingKeys.has(`${event.name}:${event.version}`));

    const created = missingEvents.length
      ? await client.events.subscriptions.create({
          broadcaster_user_id: broadcasterUserId,
          events: missingEvents,
        })
      : [];

    return NextResponse.json({
      stream: {
        slug: channel.slug,
        url: `https://kick.com/${channel.slug}`,
        broadcaster_user_id: broadcasterUserId,
        title: channel.stream_title,
        is_live: stream?.is_live ?? false,
        viewer_count: stream?.viewer_count ?? 0,
      },
      subscriptions: {
        existing: existing.length,
        requested: missingEvents.length,
        created: created.filter((result) => !result.error).length,
        failed: created.filter((result) => result.error),
      },
    });
  } catch (error) {
    if (error instanceof KickApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "failed to connect KICK stream";
    const status = message.includes("KICK_CLIENT") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
