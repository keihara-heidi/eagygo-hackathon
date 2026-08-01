import { NextResponse } from "next/server";

import { createKickAppClient } from "@/lib/kick/app-client";
import { KickApiError } from "@/lib/kick/http";

export const dynamic = "force-dynamic";

const SLUG_PATTERN = /^[a-z0-9_-]{2,40}$/i;

function normalizeSlug(value: string): string | null {
  const trimmed = value.trim().replace(/^@/, "");
  return SLUG_PATTERN.test(trimmed) ? trimmed : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await params;
  const slug = normalizeSlug(rawSlug);
  if (!slug) {
    return NextResponse.json({ error: "slug must be a KICK channel slug" }, { status: 400 });
  }

  try {
    const client = await createKickAppClient();
    const [channel] = await client.channels.list({ slug: [slug] });
    if (!channel) {
      return NextResponse.json({ error: `KICK channel @${slug} not found` }, { status: 404 });
    }

    const stream = channel.stream;
    return NextResponse.json({
      stream: {
        slug: channel.slug,
        url: `https://kick.com/${channel.slug}`,
        broadcaster_user_id: channel.broadcaster_user_id,
        title: channel.stream_title,
        category_name: channel.category.name,
        is_live: stream?.is_live ?? false,
        viewer_count: stream?.viewer_count ?? 0,
        started_at: stream?.start_time ?? null,
      },
    });
  } catch (error) {
    if (error instanceof KickApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "failed to load KICK stream";
    const status = message.includes("KICK_CLIENT") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
