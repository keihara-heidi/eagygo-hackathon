"use client";

import { useEffect, useRef, useState } from "react";

import type { SidekickEvent } from "@/lib/sidekick/types";

const MAX_EVENTS = 250;

export function useStreamEvents() {
  const [events, setEvents] = useState<SidekickEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const source = new EventSource("/api/stream/events");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (message) => {
      const parsed = JSON.parse(message.data) as SidekickEvent;
      if (seen.current.has(parsed.id)) return;
      seen.current.add(parsed.id);
      setEvents((current) => {
        const next = [...current, parsed];
        return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
      });
    };
    return () => source.close();
  }, []);

  return { events, connected };
}
