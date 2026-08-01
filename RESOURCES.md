# KICK Hackathon Resources

## Knowledge

- [Challenge brief (local)](./chat-insights-engagement-brief.md)
  The scored contract: requirements, deliverables, judging weights, deadline. Use for: every prioritisation decision — re-read before cutting scope.
- [KICK Webhook Payloads — docs.kick.com/events/event-types](https://docs.kick.com/events/event-types)
  Primary source. Full JSON shapes for all ten events, including `chat.message.sent` with parsed emotes, sender badges, and `replies_to`. Use for: designing mock data and knowing exactly which signals exist.
- [KICK Chat API — docs.kick.com/apis/chat](https://docs.kick.com/apis/chat)
  `POST /public/v1/chat` (bot/user messages, 500 chars, `reply_to_message_id` threading) and `DELETE /public/v1/chat/{message_id}`. Use for: the "chat talks back" write surface.
- [KICK Events Introduction — docs.kick.com/events/introduction](https://docs.kick.com/events/introduction)
  Webhook setup, app access tokens, public-key verification. Use for: post-hackathon, if the prototype goes live; today it justifies the mock-event seam.
- [KICK Channel Rewards API — docs.kick.com/apis/channel-rewards](https://docs.kick.com/apis/channel-rewards)
  CRUD for channel-point rewards (`channel:rewards:write`); redemptions fire `channel.reward.redemption.updated` with free-text `user_input`. Use for: engagement mechanics and the "Chat Shapes the Stream" option.
- [KICK Scopes — docs.kick.com/getting-started/scopes](https://docs.kick.com/getting-started/scopes)
  What an app is allowed to do (`chat:write`, `events:subscribe`, `channel:write`, …). Use for: keeping the prototype's claims plausible.
- [KickEngineering/KickDevDocs — github.com](https://github.com/KickEngineering/KickDevDocs)
  The docs source repo with a dated changelog of API additions. Use for: verifying a field actually exists before demoing it.

## Wisdom (Communities)

- Hackathon judges and organisers (submission: events@easygo.io)
  The ultimate feedback loop today — the presentation is the interface to them. Use for: calibrating what "obvious in two minutes" means.
- [KickDevDocs GitHub issues](https://github.com/KickEngineering/KickDevDocs/issues)
  Where KICK API correctness questions get answered by the engineers who wrote the API. Use for: payload ambiguities.

## Gaps

- No verified official KICK developer community (Discord/forum) found yet — search before relying on one.
- The docs say nothing about sentiment analysis; any sentiment signal is our own heuristic over `content`. Mock accordingly.
