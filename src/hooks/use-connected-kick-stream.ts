"use client";

import { useCallback, useEffect, useState } from "react";
import { isAxiosError } from "axios";

import { apiClient } from "@/lib/api-client";

const STORAGE_KEY = "sidekick.connectedKickStream";
const CHANGE_EVENT = "sidekick.connectedKickStream.change";

export interface ConnectedKickStream {
  input: string;
  slug: string;
  url: string;
  connectedAt: string;
  /** Resolved by /api/kick/connect when live webhooks are wired. */
  broadcasterUserId?: number;
  subscriptionIds?: string[];
  title?: string;
  categoryName?: string;
  isLive?: boolean;
  viewerCount?: number;
  startedAt?: string;
}

export type ConnectKickStreamResult =
  | { ok: true; stream: ConnectedKickStream }
  | { ok: false; error: string };

function readStoredStream(): ConnectedKickStream | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConnectedKickStream>;
    return typeof parsed.slug === "string" && typeof parsed.url === "string"
      ? {
          input: typeof parsed.input === "string" ? parsed.input : parsed.url,
          slug: parsed.slug,
          url: parsed.url,
          connectedAt:
            typeof parsed.connectedAt === "string"
              ? parsed.connectedAt
              : new Date().toISOString(),
          ...(typeof parsed.broadcasterUserId === "number"
            ? { broadcasterUserId: parsed.broadcasterUserId }
            : {}),
          ...(Array.isArray(parsed.subscriptionIds)
            ? { subscriptionIds: parsed.subscriptionIds }
            : {}),
          ...(typeof parsed.title === "string" ? { title: parsed.title } : {}),
          ...(typeof parsed.categoryName === "string" ? { categoryName: parsed.categoryName } : {}),
          ...(typeof parsed.isLive === "boolean" ? { isLive: parsed.isLive } : {}),
          ...(typeof parsed.viewerCount === "number" ? { viewerCount: parsed.viewerCount } : {}),
          ...(typeof parsed.startedAt === "string" ? { startedAt: parsed.startedAt } : {}),
        }
      : null;
  } catch {
    return null;
  }
}

function notifyStreamChanged() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function parseKickStreamLink(input: string): ConnectedKickStream | null {
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
      connectedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

interface ConnectRouteResponse {
  broadcaster_user_id: number;
  channel: {
    slug: string;
    stream_title: string;
    category: string;
    is_live: boolean;
    viewer_count: number;
    started_at: string | null;
  };
  subscriptions: Array<{
    name?: string;
    version?: number;
    subscription_id?: string;
    error?: string;
  }>;
  existing_subscriptions: Array<{
    id: string;
    event: string;
    version: number;
    broadcaster_user_id: number;
    method: string;
  }>;
  deleted_subscription_count: number;
}

export function useConnectedKickStream() {
  const [stream, setStream] = useState<ConnectedKickStream | null>(() => readStoredStream());

  useEffect(() => {
    const sync = () => setStream(readStoredStream());
    window.addEventListener("storage", sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  const connect = useCallback(async (input: string): Promise<ConnectKickStreamResult> => {
    const parsed = parseKickStreamLink(input);
    if (!parsed) return { ok: false, error: "Paste a Kick channel URL like https://kick.com/orbitfps" };

    let connected: ConnectedKickStream;
    try {
      const { data } = await apiClient.post<ConnectRouteResponse>("/kick/connect", {
        slug: parsed.slug,
      });
      console.info("[kick-connect-ui] subscription payload", {
        broadcasterUserId: data.broadcaster_user_id,
        existingSubscriptions: data.existing_subscriptions,
        deletedSubscriptionCount: data.deleted_subscription_count,
        createdSubscriptions: data.subscriptions,
      });
      connected = {
        ...parsed,
        slug: data.channel.slug,
        url: `https://kick.com/${data.channel.slug}`,
        broadcasterUserId: data.broadcaster_user_id,
        subscriptionIds: data.subscriptions
          .map((sub) => sub.subscription_id)
          .filter((id): id is string => typeof id === "string"),
        title: data.channel.stream_title,
        categoryName: data.channel.category,
        isLive: data.channel.is_live,
        viewerCount: data.channel.viewer_count,
        ...(data.channel.started_at ? { startedAt: data.channel.started_at } : {}),
      };
    } catch (error) {
      const message =
        isAxiosError<{ error?: string }>(error) && error.response?.data?.error
          ? error.response.data.error
          : "Could not connect to KICK — try again";
      return { ok: false, error: message };
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(connected));
    setStream(connected);
    notifyStreamChanged();
    return { ok: true, stream: connected };
  }, []);

  const disconnect = useCallback(() => {
    // Fire-and-forget: local state clears even if the KICK API call fails.
    apiClient.delete("/kick/connect").catch(() => {});
    window.localStorage.removeItem(STORAGE_KEY);
    setStream(null);
    notifyStreamChanged();
  }, []);

  return { stream, connect, disconnect };
}
