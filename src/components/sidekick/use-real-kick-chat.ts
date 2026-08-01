"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiClient } from "@/lib/api-client";
import type { KickEmote } from "@/lib/kick/types";

/** Kick's public Pusher application key (well known, used by kick.com itself). */
const PUSHER_URL =
  "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0&flash=false";

const CONNECT_TIMEOUT_MS = 8_000;

export type RealChatStatus = "off" | "connecting" | "live" | "failed";

interface RealKickMessage {
  id: string;
  content: string;
  created_at: string;
  sender: {
    id: number;
    username: string;
    slug: string;
    identity?: { color?: string; badges?: { type: string; text: string; count?: number }[] };
  };
}

/** Pulls Kick's inline emote tokens back out into the documented positions array. */
function extractEmotes(content: string): KickEmote[] {
  const emotes: KickEmote[] = [];
  const pattern = /\[emote:(\d+):\w+\]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const id = match[1];
    if (!id) continue;
    const position = { s: match.index, e: match.index + match[0].length - 1 };
    const existing = emotes.find((entry) => entry.emote_id === id);
    if (existing) existing.positions.push(position);
    else emotes.push({ emote_id: id, positions: [position] });
  }
  return emotes;
}

function mapToWebhookShape(raw: RealKickMessage, channel: string) {
  return {
    message_id: raw.id,
    broadcaster: {
      is_anonymous: false,
      user_id: 1,
      username: channel,
      is_verified: true,
      profile_picture: "",
      channel_slug: channel,
      identity: null,
    },
    sender: {
      is_anonymous: false,
      user_id: raw.sender.id,
      username: raw.sender.username,
      is_verified: false,
      profile_picture: "",
      channel_slug: raw.sender.slug,
      identity: {
        username_color: raw.sender.identity?.color ?? "#999999",
        badges: raw.sender.identity?.badges ?? [],
      },
    },
    content: raw.content,
    emotes: extractEmotes(raw.content),
    created_at: raw.created_at,
  };
}

/**
 * Streams a real Kick channel's chat over Kick's public Pusher websocket and
 * relays every message into our engine (documented webhook shape) so the
 * overlay AND the voice brain run on real data. Falls back to the mock
 * scenario engine on any failure.
 */
export function useRealKickChat() {
  const [status, setStatus] = useState<RealChatStatus>("off");
  const [channel, setChannel] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const intentionalCloseRef = useRef(false);

  const setMockRunning = (running: boolean) =>
    void apiClient.post("/demo", { action: running ? "start" : "stop" }).catch(() => {});

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    socketRef.current?.close();
    socketRef.current = null;
    setStatus("off");
    setChannel(null);
    setMockRunning(true);
  }, []);

  const connect = useCallback((chatroomId: string, channelLabel: string) => {
    intentionalCloseRef.current = false;
    socketRef.current?.close();
    setStatus("connecting");
    setChannel(channelLabel);

    const socket = new WebSocket(PUSHER_URL);
    socketRef.current = socket;

    const failTimer = setTimeout(() => {
      if (socket.readyState !== WebSocket.OPEN) socket.close();
    }, CONNECT_TIMEOUT_MS);

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          event: "pusher:subscribe",
          data: { auth: "", channel: `chatrooms.${chatroomId}.v2` },
        }),
      );
    };

    socket.onmessage = (message) => {
      const frame = JSON.parse(message.data as string) as { event: string; data?: string };
      if (frame.event === "pusher:ping") {
        socket.send(JSON.stringify({ event: "pusher:pong", data: {} }));
        return;
      }
      if (frame.event === "pusher_internal:subscription_succeeded") {
        clearTimeout(failTimer);
        setStatus("live");
        setMockRunning(false);
        return;
      }
      if (frame.event === "App\\Events\\ChatMessageEvent" && frame.data) {
        const raw = JSON.parse(frame.data) as RealKickMessage;
        void apiClient
          .post("/voice/ingest", { payload: mapToWebhookShape(raw, channelLabel) })
          .catch(() => {});
      }
    };

    const fail = () => {
      clearTimeout(failTimer);
      if (intentionalCloseRef.current) return;
      socketRef.current = null;
      setStatus("failed");
      setChannel(null);
      setMockRunning(true);
    };
    socket.onerror = fail;
    socket.onclose = fail;
  }, []);

  useEffect(() => () => socketRef.current?.close(), []);

  return { status, channel, connect, disconnect };
}
