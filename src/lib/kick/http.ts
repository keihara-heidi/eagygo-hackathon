/**
 * Shared HTTP plumbing for the KICK modules: the injected-fetch seam, the
 * error type, and response parsing. Kept apart from client.ts so oauth.ts
 * doesn't depend on the API client surface.
 */

/** Minimal structural subset of fetch — the real `fetch` is assignable to it. */
export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export class KickApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "KickApiError";
  }
}

export const defaultFetch: FetchLike = (input, init) => fetch(input, init);

/**
 * Parses a JSON response, throwing KickApiError on non-2xx statuses and on
 * non-JSON bodies. KICK's API envelope carries `message`; the OAuth server
 * uses `error` — both are honoured.
 */
export async function parseResponse<T>(res: {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}): Promise<T> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new KickApiError(
      res.status,
      `KICK request failed with status ${res.status} and a non-JSON response`,
    );
  }
  if (!res.ok) {
    const errBody = body as { message?: string; error?: string };
    throw new KickApiError(
      res.status,
      errBody.message ?? errBody.error ?? `KICK request failed with status ${res.status}`,
    );
  }
  return body as T;
}
