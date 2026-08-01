/**
 * Composition root for the Sidekick backend: wires every consumer onto the
 * chat-engine seam once per process and hands routes a single entry point.
 * The insight engine subscribes with full backfill; the DB sink is a
 * fire-and-forget subscriber. Nothing else should hold wiring knowledge.
 */

import { getChatEngine } from "@/lib/chat-engine";
import type { ChatEngine } from "@/lib/chat-engine";

import { persistEvent } from "./db-sink";
import { getInsights } from "./insights";
import type { InsightEngine } from "./insights";

export interface SidekickRuntime {
  engine: ChatEngine;
  insights: InsightEngine;
}

type EngineWithWiring = ChatEngine & { __sidekickWired?: boolean };

export function getSidekickRuntime(): SidekickRuntime {
  const engine = getChatEngine();
  const insights = getInsights(engine);

  const holder = engine as EngineWithWiring;
  if (!holder.__sidekickWired) {
    holder.__sidekickWired = true;
    engine.subscribe((stamped) => persistEvent(engine, stamped));
  }

  return { engine, insights };
}
