import type { NextRequest } from "next/server";

import { getSession } from "@/lib/sidekick/session";
import type { SidekickEvent } from "@/lib/sidekick/types";

export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 15_000;

/** SSE feed of the live (mock) Kick event stream. */
export function GET(request: NextRequest) {
  const session = getSession();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: SidekickEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      for (const event of session.backlog()) send(event);

      const unsubscribe = session.subscribe(send);
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, HEARTBEAT_MS);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
