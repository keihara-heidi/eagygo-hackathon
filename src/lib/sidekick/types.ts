import type { KickEvent } from "@/lib/kick/events";

/** A Kick webhook event as observed by the Sidekick stream session. */
export interface SidekickEvent {
  /** Local delivery id (not part of the Kick payload). */
  id: string;
  /** ISO timestamp when the session ingested the event. */
  received_at: string;
  event: KickEvent;
}

export type DemoAction =
  | { action: "hype" }
  | { action: "question_flood"; topic?: string }
  | { action: "new_viewer" }
  | { action: "intensity"; value: number };

export const DEMO_ACTIONS = [
  "hype",
  "question_flood",
  "new_viewer",
  "intensity",
] as const;
