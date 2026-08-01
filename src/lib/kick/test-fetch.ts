import type { FetchLike } from "./http";

export interface RecordedCall {
  url: string;
  init: { method?: string; headers?: Record<string, string>; body?: string };
}

/** Fetch stub for the client/oauth test seam: records calls, replays canned responses. */
export function stubFetch(
  handler: (call: RecordedCall) => { status: number; body?: unknown },
): { fetchImpl: FetchLike; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetchImpl: FetchLike = async (input, init = {}) => {
    const call: RecordedCall = { url: input, init };
    calls.push(call);
    const { status, body } = handler(call);
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { fetchImpl, calls };
}
