import { NextResponse } from "next/server";

import { createKickAppClient } from "@/lib/kick/app-client";
import { KICK_EVENT_TYPES } from "@/lib/kick/events";
import { KickApiError } from "@/lib/kick/http";

export const dynamic = "force-dynamic";

interface ConnectKickStreamBody {
  slug?: unknown;
}

const SLUG_PATTERN = /^[a-z0-9_-]{2,40}$/i;

function log(message: string, details?: Record<string, unknown>) {
  console.info("[kick-connect]", message, details ?? "");
}

function normalizeSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^@/, "");
  return SLUG_PATTERN.test(trimmed) ? trimmed : null;
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
    console.warn("[kick-connect] invalid slug", { slug: body.slug });
    return NextResponse.json({ error: "slug must be a KICK channel slug" }, { status: 400 });
  }

  log("connect requested", { slug: requestedSlug });

  try {
    const client = await createKickAppClient();
    const [channel] = await client.channels.list({ slug: [requestedSlug] });
    if (!channel) {
      console.warn("[kick-connect] channel not found", { slug: requestedSlug });
      return NextResponse.json({ error: `KICK channel @${requestedSlug} not found` }, { status: 404 });
    }

    const broadcasterUserId = channel.broadcaster_user_id;
    const stream = channel.stream;
    log("resolved channel", {
      slug: channel.slug,
      broadcasterUserId,
      isLive: stream?.is_live ?? false,
      viewerCount: stream?.viewer_count ?? 0,
    });

    const existing = await client.events.subscriptions.list({
      broadcaster_user_id: broadcasterUserId,
    });
    const existingKeys = new Set(
      existing.map((subscription) => `${subscription.event}:${subscription.version}`),
    );
    const missingEvents = KICK_EVENT_TYPES
      .map((name) => ({ name, version: 1 }))
      .filter((event) => !existingKeys.has(`${event.name}:${event.version}`));

    log("subscriptions checked", {
      broadcasterUserId,
      existing: existing.length,
      missing: missingEvents.map((event) => event.name),
    });

    const created = missingEvents.length
      ? await client.events.subscriptions.create({
          broadcaster_user_id: broadcasterUserId,
          events: missingEvents,
        })
      : [];
    log("subscriptions create result", {
      broadcasterUserId,
      requested: missingEvents.length,
      created: created.filter((result) => !result.error).length,
      failed: created.filter((result) => result.error),
    });

    return NextResponse.json({
      stream: {
        slug: channel.slug,
        url: `https://kick.com/${channel.slug}`,
        broadcaster_user_id: broadcasterUserId,
        title: channel.stream_title,
        category_name: channel.category.name,
        is_live: stream?.is_live ?? false,
        viewer_count: stream?.viewer_count ?? 0,
        started_at: stream?.start_time ?? null,
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
      console.error("[kick-connect] KICK API failed", {
        status: error.status,
        message: error.message,
      });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "failed to connect KICK stream";
    const status = message.includes("KICK_CLIENT") ? 503 : 500;
    console.error("[kick-connect] failed", { status, message });
    return NextResponse.json({ error: message }, { status });
  }
}
