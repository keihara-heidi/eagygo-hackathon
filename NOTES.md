# Notes

- User prefers brief explanations: pitch, pros/cons, and "pick this if…" per option.
- Testing decision is locked: test at the event-stream seam only (fixtures copied from KICK docs payloads through the signal/loop logic; surfaces untested beyond smoke).
- Prototype direction is NOT yet chosen — user deferred it to build direction-agnostic infrastructure first.
- Built: `src/kick/` — KICK API wrapper (domain types mirroring docs verbatim, `createKickClient` with injected fetch as its test seam, `parseWebhookEvent` with exhaustive event union). 12 seam tests green, typecheck clean. Not yet committed.
- Architecture sketch agreed in discussion: one seam at the chat event stream (mock adapter now, webhook adapter later); deep Signal Extractor + Loop Engine behind it; thin overlay/dashboard/bot surfaces. Fully client-side for the prototype.
- No issue tracker configured, so the PRD will be written as `PRD.md` in the repo root once the direction is chosen.
- Deadline 4:00 PM today; only committed code counts.
