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

Spec of record: `SPEC.md` (Sidekick — AI middleman for Kick chat), including the 2-minute demo script and the task split. Checkpoints: integration 2:00 PM, feature freeze 3:15 PM, final push 3:45 PM.

One seam: the chat event stream (`src/lib/chat-engine/` — `publish(WebhookDelivery)` is the sole ingress; mock scenarios and the `/api/webhook` receiver are both adapters at it). Behind the seam sits the Insight Engine (`src/lib/sidekick/insights.ts`) as the deep module: rolling word/emote frequency buckets, question detection + similarity clustering, vibe classification, chatter identity tracking, answered-question store. Wiring lives in exactly one place — the composition root `src/lib/sidekick/runtime.ts` (`getSidekickRuntime()`): it attaches the Insight Engine as a subscriber (full backfill) and the DB sink as a fire-and-forget subscriber. Routes call the runtime; never wire engines ad hoc. Clients update via SSE (`/api/stream`, seq-stamped with Last-Event-ID resume). Thin surfaces at the edges: viewer chat (`/chat`), streamer read-only dashboard (`/stream-dashboard`, mobile-screen locked), chat-native bot digest + `!answered` command, voice agent (`/voice`). Demo controls: `/api/demo` (start/stop/intensity/trigger — scenarios `question_flood`, `hype_spike`, `new_viewer`).

Surfaces share one contract — the insight API: `get_chat_vibe`, `get_recent_questions`, `get_trending`, `get_new_chatters`, `get_stream_context`, `get_answered_questions`, built once as API routes over the Insight Engine. The copilot's tool-call display uses these exact names; the voice agent calls the same routes. Freeze tool names early — renaming means touching the ElevenLabs agent config too. Voice runs on ElevenLabs Agents (`@elevenlabs/react` client tools over WebRTC), with browser Web Speech API behind a flag as fallback. The answered-questions store is shared state: `!answered` must be visible to the voice agent.

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
- Stream visual is mocked (canned frame in the video placeholder) — no live thumbnail polling or `player.kick.com` embed; the brief allows mocks and no insight tool consumes visuals. (KICK webhooks carry no imagery; REST exposes only `thumbnail` if this is ever revisited.)
- Live webhook receiver is `/api/webhook`: verifies the RSA-SHA256 signature over `{message-id}.{timestamp}.{raw-body}` (key + helper in `src/lib/kick/webhook-signature.ts`), dedupes on `Kick-Event-Message-Id`, then `publish`es into the chat engine. Subscriptions bootstrap via `bun run scripts/kick-webhooks.ts create --broadcaster <user_id>` (app token via `clientCredentials()`); set `CHAT_ENGINE_DEMO=off` so mock chat doesn't interleave with live events

## Working agreements

- Keep explanations brief: pitch, pros/cons, "pick this if…"
- Direction is chosen (Sidekick) — `SPEC.md` is the spec of record; no separate PRD planned
- Demo path is sacred: when time runs low, cut features, never the demo script
- Domain resources: `RESOURCES.md`; teaching material: `lessons/`, `reference/`
