import { NextResponse } from "next/server";

import { getSession } from "@/lib/sidekick/session";
import { DEMO_ACTIONS, type DemoAction } from "@/lib/sidekick/types";

export const dynamic = "force-dynamic";

function parseAction(body: unknown): DemoAction | null {
  if (typeof body !== "object" || body === null) return null;
  const { action, topic, value } = body as Record<string, unknown>;
  if (typeof action !== "string") return null;
  if (!(DEMO_ACTIONS as readonly string[]).includes(action)) return null;

  switch (action) {
    case "intensity":
      return typeof value === "number" ? { action, value } : null;
    case "question_flood":
      return { action, topic: typeof topic === "string" ? topic : undefined };
    case "hype":
    case "new_viewer":
      return { action };
    default:
      return null;
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const action = parseAction(body);
  if (!action) {
    return NextResponse.json(
      { error: `action must be one of: ${DEMO_ACTIONS.join(", ")}` },
      { status: 400 },
    );
  }
  getSession().handleDemoAction(action);
  return NextResponse.json({ ok: true, action });
}
