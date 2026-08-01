/**
 * Server-singleton stream session: owns the mock engine, keeps a ring buffer
 * of ingested events, fans out to SSE subscribers, and forwards events to the
 * insight engine and the fire-and-forget DB sink.
 */

import type { KickEvent } from "@/lib/kick/events";

import { persistEvent } from "./db-sink";
import { getInsights } from "./insights";
import { MockEngine } from "./mock-engine";
import type { DemoAction, SidekickEvent } from "./types";

const RING_BUFFER_SIZE = 2_000;
const BACKLOG_SIZE = 50;

type Subscriber = (event: SidekickEvent) => void;
type IngestHook = (event: SidekickEvent, session: StreamSession) => void;

export class StreamSession {
  readonly startedAt = new Date();
  readonly sessionId = crypto.randomUUID();
  private readonly events: SidekickEvent[] = [];
  private readonly subscribers = new Set<Subscriber>();
  private readonly ingestHooks: IngestHook[] = [];
  private readonly engine: MockEngine;

  constructor() {
    this.engine = new MockEngine({ onEvent: (event) => this.ingest(event) });
    this.engine.start();
  }

  /** Registers a processing hook (insight engine, digest logic, ...). */
  addIngestHook(hook: IngestHook) {
    this.ingestHooks.push(hook);
  }

  ingest(event: KickEvent) {
    const wrapped: SidekickEvent = {
      id: crypto.randomUUID(),
      received_at: new Date().toISOString(),
      event,
    };
    this.events.push(wrapped);
    if (this.events.length > RING_BUFFER_SIZE) this.events.shift();
    for (const hook of this.ingestHooks) hook(wrapped, this);
    for (const subscriber of this.subscribers) subscriber(wrapped);
    persistEvent(this, wrapped);
  }

  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  backlog(limit = BACKLOG_SIZE): SidekickEvent[] {
    return this.events.slice(-limit);
  }

  allEvents(): readonly SidekickEvent[] {
    return this.events;
  }

  handleDemoAction(action: DemoAction) {
    switch (action.action) {
      case "hype":
        this.engine.triggerHype();
        break;
      case "question_flood":
        this.engine.triggerQuestionFlood(action.topic);
        break;
      case "new_viewer":
        this.engine.triggerNewViewer();
        break;
      case "intensity":
        this.engine.setIntensity(action.value);
        break;
    }
  }
}

const globalForSession = globalThis as typeof globalThis & {
  sidekickSession?: StreamSession;
};

export function getSession(): StreamSession {
  if (!globalForSession.sidekickSession) {
    const session = new StreamSession();
    globalForSession.sidekickSession = session;
    // Attach the insight engine before any event flows so nothing is missed.
    getInsights(session);
  }
  return globalForSession.sidekickSession;
}
