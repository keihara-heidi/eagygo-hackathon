import { NextResponse } from "next/server";

import { getInsights } from "@/lib/sidekick/insights";
import { getSession } from "@/lib/sidekick/session";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const cluster = getInsights(getSession()).markAnswered(id);
  if (!cluster) {
    return NextResponse.json({ error: "unknown question cluster" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, question: cluster });
}
