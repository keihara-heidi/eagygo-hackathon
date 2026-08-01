"use client";

import { useCallback, useMemo } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { apiClient } from "@/lib/api-client";

export interface ConnectedKickStream {
  input?: string;
  slug: string;
  url: string;
  connectedAt?: string;
  /** Resolved by /api/kick/connect when live webhooks are wired. */
  broadcasterUserId: number;
  subscriptionIds: string[];
  title?: string;
  categoryName?: string;
  isLive?: boolean;
  viewerCount?: number;
  startedAt?: string;
}

export type ConnectKickStreamResult =
  | { ok: true; stream: ConnectedKickStream }
  | { ok: false; error: string };

interface KickSubscriptionRecord {
  id: string;
  broadcaster_user_id: number;
  created_at?: string;
  event: string;
  method: string;
  updated_at?: string;
  version: number;
}

interface KickChannelInfo {
  slug: string;
  stream_title: string;
  category: string;
  is_live: boolean;
  viewer_count: number;
  started_at: string | null;
}

interface SubscriptionsRouteResponse {
  subscriptions: KickSubscriptionRecord[];
  broadcaster_user_id: number | null;
  channel: KickChannelInfo | null;
  conflict: boolean;
}

interface ConnectRouteResponse {
  broadcaster_user_id: number;
  channel: KickChannelInfo;
  subscriptions: Array<{
    name?: string;
    version?: number;
    subscription_id?: string;
    error?: string;
  }>;
  existing_subscriptions: KickSubscriptionRecord[];
}

const subscriptionsQueryKey = ["kick", "subscriptions"] as const;

export function parseKickStreamLink(input: string): { input: string; slug: string; url: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "kick.com") return null;

    const slug = url.pathname
      .split("/")
      .filter(Boolean)[0]
      ?.replace(/^@/, "");
    if (!slug || !/^[a-z0-9_-]{2,40}$/i.test(slug)) return null;

    return {
      input: trimmed,
      slug,
      url: `https://kick.com/${slug}`,
    };
  } catch {
    return null;
  }
}

function streamFromSubscriptions(data: SubscriptionsRouteResponse | undefined): ConnectedKickStream | null {
  if (!data?.channel || data.broadcaster_user_id === null || data.conflict) return null;
  return {
    slug: data.channel.slug,
    url: `https://kick.com/${data.channel.slug}`,
    broadcasterUserId: data.broadcaster_user_id,
    subscriptionIds: data.subscriptions.map((subscription) => subscription.id),
    connectedAt: data.subscriptions[0]?.created_at,
    title: data.channel.stream_title,
    categoryName: data.channel.category,
    isLive: data.channel.is_live,
    viewerCount: data.channel.viewer_count,
    ...(data.channel.started_at ? { startedAt: data.channel.started_at } : {}),
  };
}

function streamFromConnect(input: string, data: ConnectRouteResponse): ConnectedKickStream {
  return {
    input,
    slug: data.channel.slug,
    url: `https://kick.com/${data.channel.slug}`,
    broadcasterUserId: data.broadcaster_user_id,
    subscriptionIds: data.subscriptions
      .map((subscription) => subscription.subscription_id)
      .filter((id): id is string => typeof id === "string"),
    title: data.channel.stream_title,
    categoryName: data.channel.category,
    isLive: data.channel.is_live,
    viewerCount: data.channel.viewer_count,
    ...(data.channel.started_at ? { startedAt: data.channel.started_at } : {}),
  };
}

export function useConnectedKickStream() {
  const queryClient = useQueryClient();
  const subscriptionsQuery = useQuery({
    queryKey: subscriptionsQueryKey,
    queryFn: async () => {
      const response = await apiClient.get<SubscriptionsRouteResponse>("/kick/subscriptions");
      console.info("[kick-subscriptions-ui] payload", response.data);
      return response.data;
    },
    placeholderData: keepPreviousData,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    staleTime: 10_000,
  });

  const connectMutation = useMutation({
    mutationFn: async (input: string): Promise<ConnectKickStreamResult> => {
      const parsed = parseKickStreamLink(input);
      if (!parsed) {
        return { ok: false, error: "Paste a Kick channel URL like https://kick.com/orbitfps" };
      }

      try {
        const { data } = await apiClient.post<ConnectRouteResponse>("/kick/connect", {
          slug: parsed.slug,
        });
        console.info("[kick-connect-ui] subscription payload", {
          broadcasterUserId: data.broadcaster_user_id,
          existingSubscriptions: data.existing_subscriptions,
          createdSubscriptions: data.subscriptions,
        });
        return { ok: true, stream: streamFromConnect(input, data) };
      } catch (error) {
        if (isAxiosError(error)) {
          console.error("[kick-connect-ui] connect error payload", {
            status: error.response?.status,
            data: error.response?.data,
          });
        }
        const message =
          isAxiosError<{ error?: string }>(error) && error.response?.data?.error
            ? error.response.data.error
            : "Could not connect to KICK — try again";
        return { ok: false, error: message };
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: subscriptionsQueryKey });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete("/kick/connect");
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: subscriptionsQueryKey });
      queryClient.setQueryData<SubscriptionsRouteResponse>(subscriptionsQueryKey, {
        subscriptions: [],
        broadcaster_user_id: null,
        channel: null,
        conflict: false,
      });
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: subscriptionsQueryKey });
    },
  });

  const stream = useMemo(
    () => streamFromSubscriptions(subscriptionsQuery.data),
    [subscriptionsQuery.data],
  );

  const connect = useCallback(
    (input: string) => connectMutation.mutateAsync(input),
    [connectMutation],
  );

  const disconnect = useCallback(() => {
    disconnectMutation.mutate();
  }, [disconnectMutation]);

  return {
    stream,
    connect,
    disconnect,
    isLoading: subscriptionsQuery.isLoading,
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    subscriptions: subscriptionsQuery.data?.subscriptions ?? [],
    subscriptionConflict: subscriptionsQuery.data?.conflict ?? false,
  };
}
