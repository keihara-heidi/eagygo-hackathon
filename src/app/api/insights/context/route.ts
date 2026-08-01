import { NextResponse } from "next/server";

import { getSidekickRuntime } from "@/lib/sidekick/runtime";
import { getStreamContext } from "@/lib/sidekick/stream-context";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getStreamContext(getSidekickRuntime().insights));
}
