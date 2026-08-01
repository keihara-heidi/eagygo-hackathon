import { NextResponse } from "next/server";

import { getSidekickRuntime } from "@/lib/sidekick/runtime";

export const dynamic = "force-dynamic";

/** The answered-questions store — the `get_answered_questions` tool's route. */
export function GET() {
  const questions = getSidekickRuntime()
    .insights.questions()
    .filter((cluster) => cluster.answered);
  return NextResponse.json({ questions });
}
