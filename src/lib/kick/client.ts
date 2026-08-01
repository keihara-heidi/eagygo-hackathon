/**
 * KickClient — a thin, complete wrapper over the KICK Public API surface that
 * the hackathon options need. Auth is supplied as a token (OAuth lives at
 * id.kick.com — see oauth.ts). `fetch` and `baseUrl` are injected, which is
 * the module's test seam: tests assert request shapes and envelope handling
 * without any network.
 */

import type { KickEventType } from "./events";
import { defaultFetch, parseResponse } from "./http";
import type { FetchLike } from "./http";
import type {
  KickChannel,
  KickChannelReward,
  KickChatMessageResponse,
  KickEventSubscription,
  KickEventSubscriptionResult,
  KickFailedRedemption,
  KickGetUser,
  KickKicksLeaderboard,
  KickLivestream,
  KickLivestreamStats,
  KickRedemptionStatus,
  KickRedemptionsByReward,
  PatchChannelRewardsBody,
  PatchChannelsParams,
  PostChannelRewardsBody,
  PostChatParams,
} from "./types";

const DEFAULT_BASE_URL = "https://api.kick.com";

export interface KickClientOptions {
  token: string;
  fetch?: FetchLike;
  baseUrl?: string;
}

export interface KickPaginated<T> {
  data: T;
  /** Cursor for the next page, or null when there is none. */
  nextCursor: string | null;
}

type QueryValue = string | number | Array<string | number> | undefined;

interface Envelope {
  data?: unknown;
  message?: string;
}

interface PaginatedEnvelope extends Envelope {
  pagination?: { next_cursor?: string };
}

export function createKickClient(options: KickClientOptions) {
  const { token, fetch: fetchImpl = defaultFetch, baseUrl = DEFAULT_BASE_URL } = options;

  function buildUrl(path: string, query?: Record<string, QueryValue>): string {
    const url = new URL(path, baseUrl);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  function send(
    method: string,
    path: string,
    opts: { query?: Record<string, QueryValue>; body?: unknown } = {},
  ) {
    return fetchImpl(buildUrl(path, opts.query), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  }

  async function req<T>(
    method: string,
    path: string,
    opts?: { query?: Record<string, QueryValue>; body?: unknown },
  ): Promise<T> {
    const res = await send(method, path, opts);
    if (res.status === 204) return undefined as T;
    const envelope = await parseResponse<Envelope>(res);
    return envelope.data as T;
  }

  async function reqPaginated<T>(
    path: string,
    query?: Record<string, QueryValue>,
  ): Promise<KickPaginated<T>> {
    const envelope = await parseResponse<PaginatedEnvelope>(await send("GET", path, { query }));
    return {
      data: envelope.data as T,
      nextCursor: envelope.pagination?.next_cursor ?? null,
    };
  }

  return {
    chat: {
      send: (params: PostChatParams): Promise<KickChatMessageResponse> =>
        req("POST", "/public/v1/chat", { body: params }),
      delete: (messageId: string): Promise<void> =>
        req("DELETE", `/public/v1/chat/${encodeURIComponent(messageId)}`),
    },

    channels: {
      list: (filter?: { broadcaster_user_id?: number[]; slug?: string[] }): Promise<KickChannel[]> =>
        req("GET", "/public/v1/channels", {
          query: { broadcaster_user_id: filter?.broadcaster_user_id, slug: filter?.slug },
        }),
      update: (params: PatchChannelsParams): Promise<void> =>
        req("PATCH", "/public/v1/channels", { body: params }),
    },

    rewards: {
      list: (): Promise<KickChannelReward[]> => req("GET", "/public/v1/channels/rewards"),
      create: (params: PostChannelRewardsBody): Promise<KickChannelReward> =>
        req("POST", "/public/v1/channels/rewards", { body: params }),
      update: (id: string, params: PatchChannelRewardsBody): Promise<KickChannelReward> =>
        req("PATCH", `/public/v1/channels/rewards/${encodeURIComponent(id)}`, { body: params }),
      delete: (id: string): Promise<void> =>
        req("DELETE", `/public/v1/channels/rewards/${encodeURIComponent(id)}`),
      redemptions: (filter?: {
        reward_id?: string;
        status?: KickRedemptionStatus;
        id?: string[];
        cursor?: string;
      }): Promise<KickPaginated<KickRedemptionsByReward[]>> =>
        reqPaginated("/public/v1/channels/rewards/redemptions", {
          reward_id: filter?.reward_id,
          status: filter?.status,
          id: filter?.id,
          cursor: filter?.cursor,
        }),
      acceptRedemptions: (ids: string[]): Promise<KickFailedRedemption[]> =>
        req("POST", "/public/v1/channels/rewards/redemptions/accept", { body: { ids } }),
      rejectRedemptions: (ids: string[]): Promise<KickFailedRedemption[]> =>
        req("POST", "/public/v1/channels/rewards/redemptions/reject", { body: { ids } }),
    },

    events: {
      subscriptions: {
        list: (filter?: { broadcaster_user_id?: number }): Promise<KickEventSubscription[]> =>
          req("GET", "/public/v1/events/subscriptions", {
            query: { broadcaster_user_id: filter?.broadcaster_user_id },
          }),
        create: (params: {
          events: Array<{ name: KickEventType; version: number }>;
          broadcaster_user_id?: number;
        }): Promise<KickEventSubscriptionResult[]> =>
          req("POST", "/public/v1/events/subscriptions", {
            body: { events: params.events, method: "webhook", broadcaster_user_id: params.broadcaster_user_id },
          }),
        delete: (ids: string[]): Promise<void> =>
          req("DELETE", "/public/v1/events/subscriptions", { query: { id: ids } }),
      },
    },

    livestreams: {
      list: (filter?: {
        category_id?: number[];
        language_code?: string[];
        limit?: number;
        cursor?: string;
      }): Promise<KickPaginated<KickLivestream[]>> =>
        reqPaginated("/public/v2/livestreams", {
          category_id: filter?.category_id,
          language_code: filter?.language_code,
          limit: filter?.limit,
          cursor: filter?.cursor,
        }),
      forUsers: (userIds: number[]): Promise<KickLivestream[]> =>
        req("GET", "/public/v1/users/livestreams", { query: { user_id: userIds } }),
      stats: (): Promise<KickLivestreamStats> => req("GET", "/public/v1/livestreams/stats"),
    },

    users: {
      list: (ids?: number[]): Promise<KickGetUser[]> =>
        req("GET", "/public/v1/users", { query: { id: ids } }),
    },

    kicks: {
      leaderboard: (top?: number): Promise<KickKicksLeaderboard> =>
        req("GET", "/public/v1/kicks/leaderboard", { query: { top } }),
    },

    publicKey: async (): Promise<string> => {
      const data = await req<{ public_key: string }>("GET", "/public/v1/public-key");
      return data.public_key;
    },
  };
}

export type KickClient = ReturnType<typeof createKickClient>;
