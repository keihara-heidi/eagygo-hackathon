import { NextResponse } from "next/server";

import { getSidekickRuntime } from "@/lib/sidekick/runtime";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const cluster = getSidekickRuntime().insights.markAnswered(id);
  if (!cluster) {
    return NextResponse.json({ error: "unknown question cluster" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, question: cluster });
}
