/**
 * Live-connect flow: resolve a pasted channel slug to a broadcaster and swap
 * this app's webhook subscriptions onto it. App access tokens may subscribe
 * to ANY channel by user id (docs-confirmed) — no broadcaster authorization
 * or user login is involved. Pure logic over the kick module with `fetch`
 * injected, so tests run through stubFetch without network.
 */

import { createKickClient } from "@/lib/kick/client";
import { KICK_EVENT_TYPES } from "@/lib/kick/events";
import type { FetchLike } from "@/lib/kick/http";
import { createOAuthClient } from "@/lib/kick/oauth";
import type { KickEventSubscriptionResult } from "@/lib/kick/types";

export interface KickConnectDeps {
  clientId: string;
  clientSecret: string;
  fetch?: FetchLike;
}

export interface ConnectedChannelInfo {
  slug: string;
  stream_title: string;
  category: string;
  is_live: boolean;
  viewer_count: number;
  started_at: string | null;
}

export type ConnectKickChannelResult =
  | {
      ok: true;
      broadcaster_user_id: number;
      channel: ConnectedChannelInfo;
      subscriptions: KickEventSubscriptionResult[];
    }
  | { ok: false; status: number; error: string };

// Same slug rules as parseKickStreamLink in use-connected-kick-stream.ts —
// the route revalidates server-side rather than trusting the client.
const SLUG_PATTERN = /^[a-z0-9_-]{2,40}$/i;

export function isValidKickSlug(slug: unknown): slug is string {
  return typeof slug === "string" && SLUG_PATTERN.test(slug);
}

function buildClients(deps: KickConnectDeps) {
  const oauth = createOAuthClient({
    clientId: deps.clientId,
    clientSecret: deps.clientSecret,
    ...(deps.fetch ? { fetch: deps.fetch } : {}),
  });
  return {
    async kickClient() {
      const token = await oauth.clientCredentials();
      return createKickClient({
        token: token.access_token,
        ...(deps.fetch ? { fetch: deps.fetch } : {}),
      });
    },
  };
}

/** Deletes every event subscription owned by this app. Returns the count. */
async function deleteAllSubscriptions(
  client: ReturnType<typeof createKickClient>,
): Promise<number> {
  const existing = await client.events.subscriptions.list();
  if (existing.length > 0) {
    await client.events.subscriptions.delete(existing.map((sub) => sub.id));
  }
  return existing.length;
}

export async function connectKickChannel(
  slug: string,
  deps: KickConnectDeps,
): Promise<ConnectKickChannelResult> {
  if (!isValidKickSlug(slug)) {
    return { ok: false, status: 400, error: "Invalid Kick channel slug" };
  }

  const client = await buildClients(deps).kickClient();

  const channels = await client.channels.list({ slug: [slug] });
  const channel = channels?.[0];
  if (!channel) {
    return {
      ok: false,
      status: 404,
      error: `No Kick channel found for "${slug}" — check the URL`,
    };
  }

  // Replace-don't-accumulate: this app tracks exactly one channel at a time.
  await deleteAllSubscriptions(client);

  const subscriptions = await client.events.subscriptions.create({
    broadcaster_user_id: channel.broadcaster_user_id,
    events: KICK_EVENT_TYPES.map((name) => ({ name, version: 1 })),
  });

  return {
    ok: true,
    broadcaster_user_id: channel.broadcaster_user_id,
    channel: {
      slug: channel.slug,
      stream_title: channel.stream_title,
      category: channel.category?.name ?? "",
      is_live: channel.stream?.is_live ?? false,
      viewer_count: channel.stream?.viewer_count ?? 0,
      started_at: channel.stream?.is_live ? channel.stream.start_time : null,
    },
    subscriptions,
  };
}

export async function disconnectKickChannel(
  deps: KickConnectDeps,
): Promise<{ deleted: number }> {
  const client = await buildClients(deps).kickClient();
  const deleted = await deleteAllSubscriptions(client);
  return { deleted };
}
