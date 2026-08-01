"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { StampedEvent } from "@/lib/chat-engine/types";

export type KickStreamConnectionState = "connecting" | "live" | "reconnecting" | "closed";

interface UseKickStreamEventsOptions {
  endpoint?: string;
  enabled?: boolean;
  fromSeq?: number;
  maxEvents?: number;
  onEvent?: (event: StampedEvent) => void;
}

export function useKickStreamEvents({
  endpoint = "/api/stream",
  enabled = true,
  fromSeq,
  maxEvents = 160,
  onEvent,
}: UseKickStreamEventsOptions = {}) {
  const [events, setEvents] = useState<StampedEvent[]>([]);
  const [connectionState, setConnectionState] = useState<KickStreamConnectionState>(
    enabled ? "connecting" : "closed",
  );
  const [error, setError] = useState<Event | null>(null);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const clear = useCallback(() => setEvents([]), []);

  useEffect(() => {
    if (!enabled) return;

    const url = new URL(endpoint, window.location.origin);
    if (fromSeq !== undefined) url.searchParams.set("fromSeq", String(fromSeq));

    console.info("[kick-stream-events] opening SSE", { url: url.toString() });
    const source = new EventSource(url.toString());

    source.onopen = () => {
      console.info("[kick-stream-events] SSE open", {
        endpoint,
        readyState: source.readyState,
      });
      setConnectionState("live");
      setError(null);
    };

    source.onerror = (event) => {
      const nextState = source.readyState === EventSource.CLOSED ? "closed" : "reconnecting";
      console.error("[kick-stream-events] SSE error", {
        endpoint,
        readyState: source.readyState,
        nextState,
        event,
      });
      setError(event);
      setConnectionState(nextState);
    };

    source.onmessage = (message) => {
      const incoming = JSON.parse(message.data) as StampedEvent;
      console.info("[kick-stream-events] event received", {
        seq: incoming.seq,
        type: incoming.event.type,
        broadcasterUserId: incoming.event.payload.broadcaster.user_id,
        receivedAt: incoming.received_at,
      });
      onEventRef.current?.(incoming);
      setEvents((current) => {
        if (current.some((event) => event.seq === incoming.seq)) {
          console.info("[kick-stream-events] duplicate skipped", { seq: incoming.seq });
          return current;
        }
        const next = [...current, incoming].slice(-maxEvents);
        console.info("[kick-stream-events] event stored", {
          seq: incoming.seq,
          count: next.length,
          maxEvents,
        });
        return next;
      });
      setConnectionState("live");
    };

    return () => {
      console.info("[kick-stream-events] closing SSE", {
        endpoint,
        readyState: source.readyState,
      });
      source.close();
    };
  }, [enabled, endpoint, fromSeq, maxEvents]);

  return {
    events,
    latestEvent: events.at(-1),
    connectionState: enabled ? connectionState : "closed",
    error,
    clear,
  };
}
