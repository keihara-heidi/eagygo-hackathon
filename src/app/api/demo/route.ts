import { NextResponse } from "next/server";

import { getChatEngine } from "@/lib/chat-engine";
import { isDemoScenario, type DemoScenario } from "@/lib/chat-engine";

export const dynamic = "force-dynamic";

type DemoCommand =
  | { action: "start" }
  | { action: "stop" }
  | { action: "intensity"; value: number }
  | { action: "trigger"; scenario: DemoScenario };

function parseCommand(body: unknown): DemoCommand | null {
  if (typeof body !== "object" || body === null) return null;
  const { action, value, scenario } = body as Record<string, unknown>;

  switch (action) {
    case "start":
    case "stop":
      return { action };
    case "intensity":
      return typeof value === "number" ? { action, value } : null;
    case "trigger":
      return typeof scenario === "string" && isDemoScenario(scenario)
        ? { action, scenario }
        : null;
    default:
      return null;
  }
}

/** Demo control panel endpoint: start/stop baseline, intensity, triggers. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const command = parseCommand(body);
  if (!command) {
    return NextResponse.json(
      {
        error:
          "expected { action: start | stop } | { action: intensity, value } " +
          "| { action: trigger, scenario: question_flood | hype_spike | new_viewer }",
      },
      { status: 400 },
    );
  }

  const { demo } = getChatEngine();
  switch (command.action) {
    case "start":
      demo.start();
      break;
    case "stop":
      demo.stop();
      break;
    case "intensity":
      demo.setIntensity(command.value);
      break;
    case "trigger":
      demo.trigger(command.scenario);
      break;
    default: {
      const exhausted: never = command;
      return exhausted;
    }
  }

  return NextResponse.json({ ok: true, state: demo.getState() });
}

export function GET() {
  return NextResponse.json(getChatEngine().demo.getState());
}
