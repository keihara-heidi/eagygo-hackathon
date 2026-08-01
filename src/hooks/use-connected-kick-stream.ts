"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sidekick.connectedKickStream";
const CHANGE_EVENT = "sidekick.connectedKickStream.change";

export interface ConnectedKickStream {
  input: string;
  slug: string;
  url: string;
  connectedAt: string;
  broadcasterUserId?: number;
  title?: string;
  categoryName?: string;
  isLive?: boolean;
  viewerCount?: number;
  startedAt?: string;
}

interface ConnectKickStreamMetadata {
  broadcasterUserId?: number;
  slug?: string;
  url?: string;
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

  const connect = useCallback(
    (input: string, metadata: ConnectKickStreamMetadata = {}): ConnectKickStreamResult => {
      const parsed = parseKickStreamLink(input);
      if (!parsed) return { ok: false, error: "Paste a Kick channel URL like https://kick.com/orbitfps" };

      const nextStream: ConnectedKickStream = {
        ...parsed,
        ...metadata,
        slug: metadata.slug ?? parsed.slug,
        url: metadata.url ?? parsed.url,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStream));
      setStream(nextStream);
      notifyStreamChanged();
      return { ok: true, stream: nextStream };
    },
    [],
  );

  const disconnect = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setStream(null);
    notifyStreamChanged();
  }, []);

  return { stream, connect, disconnect };
}
