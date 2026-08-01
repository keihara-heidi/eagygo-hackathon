import { NextResponse } from "next/server";

import { getInsights } from "@/lib/sidekick/insights";
import { getSession } from "@/lib/sidekick/session";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getInsights(getSession()).trending());
}
