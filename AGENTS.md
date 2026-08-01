<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Eagygo Hackathon — Challenge 2: Chat Insights & Engagement

KICK hackathon project. Brief: `chat-insights-engagement-brief.md`. Submission deadline 4:00 PM — **only committed code counts**.

## Stack & commands

- Next.js 16 App Router (`src/app/`), React 19, TypeScript 5, shadcn/ui + Tailwind v4
- State/data: jotai, @tanstack/react-query; axios for internal `/api` routes (`src/lib/api-client.ts`)
- Package manager: **Bun** (`bun install`, `bun run …`) — the pnpm lockfile was removed; do not use pnpm
- Checks that must stay green: `bun run typecheck`, `bun run test`, `bun run lint`, `bun run build`

## Architecture

One seam: the chat event stream. A mock event-stream adapter now, a KICK webhook-receiver adapter later — same interface. Deep modules behind the seam (signal extraction, loop/game state); thin surfaces at the edges (overlay, dashboard, chat-bot poster). The prototype runs fully client-side.

## The KICK module — `src/lib/kick/`

Wrapper over the KICK Public API. Types mirror https://docs.kick.com verbatim (snake_case, exact nesting) so mock data is automatically faithful to the real payloads — a judging requirement.

- `types.ts` — domain models from the OpenAPI spec
- `events.ts` — webhook payloads + `parseWebhookEvent`; exhaustive union with compile-time completeness enforcement
- `client.ts` — `createKickClient`: chat, channels, rewards, event subscriptions, livestreams, users, kicks leaderboard, public key
- `oauth.ts` — PKCE, authorize URL, and token grants against id.kick.com
- `http.ts` — shared `FetchLike` / `KickApiError` / `parseResponse`; `fetch` is injected everywhere (the test seam)
- `test-fetch.ts` — shared `stubFetch` for tests

## Locked decisions (don't relitigate)

- snake_case fields verbatim from the docs — no camelCase mapping layer
- Casts at the wire boundary; no runtime validation until the live webhook receiver exists
- OAuth: revoke/introspect deliberately omitted
- Testing: event-stream seam only — docs-derived fixtures through pure logic; surfaces untested beyond smoke
- Live OAuth integration test is env-gated: `KICK_CLIENT_ID=… KICK_CLIENT_SECRET=… bun run test`

## Working agreements

- Keep explanations brief: pitch, pros/cons, "pick this if…"
- Prototype direction is not yet chosen; the PRD will land as `PRD.md` in the repo root once it is
- Domain resources: `RESOURCES.md`; teaching material: `lessons/`, `reference/`
