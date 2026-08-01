import type { NextRequest } from "next/server";

import { getChatEngine } from "@/lib/chat-engine";
import type { StampedEvent } from "@/lib/chat-engine";

export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 15_000;

function parseSeq(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * SSE feed of the stamped Kick event stream: backfill (last 50, or from
 * `?fromSeq=`) then live. Every frame carries `id: <seq>`, so EventSource
 * reconnects resume seamlessly via the Last-Event-ID header.
 */
export function GET(request: NextRequest) {
  const engine = getChatEngine();
  const encoder = new TextEncoder();

  const explicitFromSeq = parseSeq(request.nextUrl.searchParams.get("fromSeq"));
  const lastEventId = parseSeq(request.headers.get("last-event-id"));

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: StampedEvent) => {
        controller.enqueue(
          encoder.encode(`id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`),
        );
      };

      const fromSeq =
        explicitFromSeq ??
        (lastEventId !== undefined
          ? lastEventId + 1
          : engine.getRecent()[0]?.seq);

      const unsubscribe = engine.subscribe(send, { fromSeq });
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
