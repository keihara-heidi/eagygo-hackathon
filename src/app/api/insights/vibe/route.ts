import { NextResponse } from "next/server";

import { getSidekickRuntime } from "@/lib/sidekick/runtime";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getSidekickRuntime().insights.vibe());
}
