/**
 * Live-connect flow: resolve a pasted channel slug to a broadcaster and swap
 * this app's webhook subscriptions onto it. App access tokens may subscribe
 * to ANY channel by user id (docs-confirmed) — no broadcaster authorization
 * or user login is involved. Pure logic over the kick module with `fetch`
 * injected, so tests run through stubFetch without network.
 */

import { createKickClient } from "@/lib/kick/client";
import type { KickEventType } from "@/lib/kick/events";
import type { FetchLike } from "@/lib/kick/http";
import { createOAuthClient } from "@/lib/kick/oauth";
import type {
  KickEventSubscription,
  KickEventSubscriptionResult,
} from "@/lib/kick/types";

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
      existing_subscriptions: KickEventSubscription[];
    }
  | {
      ok: false;
      status: number;
      error: string;
      existing_subscriptions?: KickEventSubscription[];
    };

// Same slug rules as parseKickStreamLink in use-connected-kick-stream.ts —
// the route revalidates server-side rather than trusting the client.
const SLUG_PATTERN = /^[a-z0-9_-]{2,40}$/i;
const LIVE_CONNECT_EVENTS: Array<{ name: KickEventType; version: number }> = [
  { name: "chat.message.sent", version: 1 },
];

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

function summarizeSubscriptions(subscriptions: KickEventSubscription[]) {
  return subscriptions.map((subscription) => ({
    id: subscription.id,
    event: subscription.event,
    version: subscription.version,
    broadcasterUserId: subscription.broadcaster_user_id,
    method: subscription.method,
  }));
}

async function listSubscriptions(
  client: ReturnType<typeof createKickClient>,
): Promise<KickEventSubscription[]> {
  const existing = await client.events.subscriptions.list();
  console.info("[kick-connect] existing subscriptions listed", {
    count: existing.length,
    subscriptions: summarizeSubscriptions(existing),
  });
  return existing;
}

/** Deletes every event subscription owned by this app. Returns what existed before deletion. */
async function deleteAllSubscriptions(
  client: ReturnType<typeof createKickClient>,
): Promise<KickEventSubscription[]> {
  const existing = await listSubscriptions(client);
  if (existing.length > 0) {
    await client.events.subscriptions.delete(existing.map((sub) => sub.id));
    console.info("[kick-connect] deleted existing subscriptions", {
      count: existing.length,
      ids: existing.map((subscription) => subscription.id),
    });
  }
  return existing;
}

export async function connectKickChannel(
  slug: string,
  deps: KickConnectDeps,
): Promise<ConnectKickChannelResult> {
  if (!isValidKickSlug(slug)) {
    return { ok: false, status: 400, error: "Invalid Kick channel slug" };
  }

  console.info("[kick-connect] connect requested", { slug });
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

  console.info("[kick-connect] channel resolved", {
    slug: channel.slug,
    broadcasterUserId: channel.broadcaster_user_id,
    isLive: channel.stream?.is_live ?? false,
    viewerCount: channel.stream?.viewer_count ?? 0,
  });

  // Hard lock: the app may have exactly one active webhook subscription.
  // If anything already exists, force an explicit disconnect/cleanup first.
  const existingSubscriptions = await listSubscriptions(client);
  if (existingSubscriptions.length > 0) {
    console.warn("[kick-connect] refusing connect because subscriptions already exist", {
      requestedSlug: slug,
      requestedBroadcasterUserId: channel.broadcaster_user_id,
      existingSubscriptions: summarizeSubscriptions(existingSubscriptions),
    });
    return {
      ok: false,
      status: 409,
      error: "KICK webhook subscription already exists; disconnect or delete it before connecting another stream",
      existing_subscriptions: existingSubscriptions,
    };
  }

  console.info("[kick-connect] creating subscriptions", {
    broadcasterUserId: channel.broadcaster_user_id,
    events: LIVE_CONNECT_EVENTS,
  });
  const subscriptions = await client.events.subscriptions.create({
    broadcaster_user_id: channel.broadcaster_user_id,
    events: LIVE_CONNECT_EVENTS,
  });
  console.info("[kick-connect] create result", {
    broadcasterUserId: channel.broadcaster_user_id,
    subscriptions,
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
    existing_subscriptions: existingSubscriptions,
  };
}

export async function disconnectKickChannel(
  deps: KickConnectDeps,
): Promise<{ deleted: number }> {
  const client = await buildClients(deps).kickClient();
  const deleted = await deleteAllSubscriptions(client);
  return { deleted: deleted.length };
}
