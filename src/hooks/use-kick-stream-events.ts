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

    const source = new EventSource(url.toString());

    source.onopen = () => {
      setConnectionState("live");
      setError(null);
    };

    source.onerror = (event) => {
      setError(event);
      setConnectionState(
        source.readyState === EventSource.CLOSED ? "closed" : "reconnecting",
      );
    };

    source.onmessage = (message) => {
      const incoming = JSON.parse(message.data) as StampedEvent;
      onEventRef.current?.(incoming);
      setEvents((current) => {
        if (current.some((event) => event.seq === incoming.seq)) return current;
        return [...current, incoming].slice(-maxEvents);
      });
      setConnectionState("live");
    };

    return () => source.close();
  }, [enabled, endpoint, fromSeq, maxEvents]);

  return {
    events,
    latestEvent: events.at(-1),
    connectionState: enabled ? connectionState : "closed",
    error,
    clear,
  };
}
