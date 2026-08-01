import { NextResponse } from "next/server";

import { postVoiceBriefing } from "@/lib/sidekick/voice-briefing";

export const dynamic = "force-dynamic";

export async function POST() {
  const result = await postVoiceBriefing();
  return NextResponse.json({ ok: true, ...result });
}
