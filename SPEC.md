# Sidekick — AI Middleman for Kick Chat

> **Easygo Mini Hackathon · Challenge 02: Chat Insights & Engagement**
> Submission deadline: **4:00 PM today** — all code pushed + presentation & prototype emailed to events@easygo.io. Anything uncommitted = disqualified. **Commit early, commit often.**

## One-liner

An AI agent that sits between the streamer and their chat: viewers ask it what's happening and get instant catch-up; the streamer asks it what chat is feeling and gets live insight — and every answer one side gives feeds the other.

---

## Why this wins (mapping to the brief)

| Brief requirement | How Sidekick answers it |
|---|---|
| Help streamers understand chat | Live insight panel: clustered questions, trending words/emotes per interval, vibe, who's showing up |
| Give viewers a way to participate beyond typing | Personal AI copilot widget — ask anything about the stream/chat without shouting into the scroll |
| **Genuine feedback loop** | Viewer questions cluster → streamer sees & answers on stream → marks "answered" → bot relays the answer to every future asker. Both sides feed each other continuously. |
| Explainable in <2 min | "New viewer joins mid-stream, asks 'what's going on?', gets a TLDR. Streamer asks 'what's chat saying?', gets an answer. That's it." |
| Mock data reflecting real Kick data | All mock events use the exact `chat.message.sent` / webhook payload shapes from the Kick Public API docs |

---

## The three pieces

### 1. Viewer Copilot (engagement side)

A chatbot widget in the bottom-right corner of a mocked Kick stream page (standard third-party-widget placement).

**Core interactions:**
- **"What's going on?"** — TLDR of the stream so far / last N minutes: what the streamer is doing, key moments, what chat is hyped about. Triggered manually, or **auto-greets** when a viewer joins ("Welcome! Quick catch-up: …").
- **"Who is this streamer?"** — first-time-viewer primer: who they are, what they stream, channel lore/running jokes.
- **"Why is chat spamming X?"** — explains the current moment/emote/inside joke.
- **Answered-question recall** — if the streamer already covered it, the bot says so: *"He answered this 3 min ago — 800 DPI, 0.8 sens."*

**Tool-call transparency (the technical flex):**
Every bot response renders its (mocked) tool calls inline before the answer, agent-UI style:

```
⚙ get_recent_chat(window="10m") → 412 messages
⚙ get_stream_context() → title, category, uptime
⚙ get_answered_questions() → 3 matches
→ "Here's what you missed: …"
```

Mocked but shaped like real calls against Kick API endpoints (`GET /livestreams`, `GET /channels`, chat history). Makes the agent feel engineered, not a GPT wrapper.

### 2. Streamer Insight Panel (insights side)

A dashboard view the streamer keeps on a second monitor.

- **Question radar (hero feature):** similar questions from chat get clustered and counted — *"❓ asked 8× in last 5 min: 'what's your sensitivity?'"*. Sorted by frequency × recency. One-click **"Answered ✓"** button → feeds the viewer bot (closes the loop).
- **Trending now:** most-occurring words & emotes per rolling interval (e.g. 60s / 5min buckets), with deltas ("'clip it' ↑ 340%").
- **Vibe strip:** coarse mood of chat over time (hype / chill / tilted / dead) derived from message velocity + emote mix.
- **Who's showing up:** first-time chatters vs regulars vs subs/mods in current window; notable arrivals ("a 12-month sub just chatted for the first time today").

### 3. Wildcard — Voice Agent for the streamer

Streamer is mid-game, can't read a dashboard. From their phone:

- Push-to-talk button (phone browser page, Web Speech API).
- Ask: *"What's chat been saying the last 10 minutes?"* / *"What's the vibe?"* / *"Any questions I should answer?"*
- Agent speaks the answer back through the speaker (TTS), powered by the same insight engine as the dashboard.

Same brain, third interface. Pitch line: *"The dashboard is for their monitor; the voice agent is for when they can't look at it."*

---

## Architecture

```
┌────────────────────────────────────────────────────┐
│  Mock Chat Engine                                  │
│  Replays scripted Kick-shaped chat.message.sent    │
│  events + follows/subs/kicks events on a timeline. │
│  Demo controls: intensity slider, "hype spike",    │
│  "question flood", "new viewer joins" buttons.     │
└──────────────┬─────────────────────────────────────┘
               │ normalized event stream
┌──────────────▼─────────────────────────────────────┐
│  Insight Engine (server)                           │
│  - rolling word/emote frequency buckets            │
│  - question detection + similarity clustering      │
│  - vibe classification                             │
│  - chatter identity tracking (new/regular/sub/mod) │
│  - answered-questions store                        │
└───────┬──────────────┬──────────────┬──────────────┘
        │              │              │
┌───────▼──────┐ ┌─────▼────────┐ ┌───▼───────────┐
│ Viewer       │ │ Streamer     │ │ Voice Agent   │
│ Copilot      │ │ Insight      │ │ (phone PTT +  │
│ widget       │ │ Panel        │ │  TTS reply)   │
└──────────────┘ └──────────────┘ └───────────────┘
```

**Stack:** Next.js (App Router) + TypeScript + Tailwind (+ shadcn/ui). Insight engine in API routes / server code; event stream to clients via SSE or simple polling. Voice via browser `SpeechRecognition` + `speechSynthesis` (zero infra).

**LLM responses:** two options, decide early —
1. **Scripted responses** keyed to demo timeline (deterministic, zero risk, fine per brief since mocking is allowed) — recommended baseline.
2. Real LLM call (if an API key is handy) with the mock chat as context — nice-to-have upgrade, keep behind a flag.

**Mock data fidelity rule:** every mocked message/event must match the real Kick payload shapes (sender identity with badges, emotes with positions, `replies_to`, timestamps — see `chat.message.sent` in the [Kick event docs](https://docs.kick.com/events/event-types)). Judges from Kick will notice.

---

## Demo script (~2 min)

1. **Cold open — the problem (15s):** mocked Kick stream page, chat scrolling fast. "You just joined. What's going on? Who is this? Chat's spamming an emote you don't get."
2. **Viewer copilot (30s):** click the widget → "what's going on?" → tool calls stream in → TLDR appears. Then "who's the streamer?" → primer. Then trigger "new viewer joins" → auto-greet.
3. **Streamer panel (30s):** hit "question flood" — 8 viewers ask about sensitivity in different words → question radar clusters it, counter climbs. Streamer "answers on stream", clicks **Answered ✓**.
4. **The loop (20s):** back on viewer side, a new viewer asks the same question → bot: *"he just answered this — 800 DPI."* Point at it: **that's the feedback loop.**
5. **Wildcard — voice (25s):** pull out phone, hold PTT: "what's the vibe in chat?" → agent speaks: *"Chat's hyped — messages up 3x, KEKW trending, two questions worth answering."*

---

## Build plan & task split

> Adjust owners as needed. Integration checkpoint at **2:00 PM**, feature freeze **3:15 PM**, final push **3:45 PM** (buffer before the 4:00 cutoff).

| # | Task | Est | Owner |
|---|---|---|---|
| 1 | Scaffold Next.js app, layout: stream page (video placeholder + chat column), routes for `/` (viewer), `/dashboard` (streamer), `/voice` (phone) | 45m | |
| 2 | Mock chat engine: scripted timeline of Kick-shaped events, demo control panel (intensity, hype spike, question flood, new-viewer join) | 60m | |
| 3 | Insight engine: word/emote frequency buckets, question detection + clustering, vibe classifier, chatter tracking, answered-question store | 75m | |
| 4 | Viewer copilot widget: chat UI, tool-call rendering, scripted/LLM responses, auto-greet | 75m | |
| 5 | Streamer insight panel: question radar + Answered button, trending words/emotes, vibe strip, who's-showing-up | 75m | |
| 6 | Voice agent page: PTT, speech-to-text, route intents to insight engine, TTS response | 45m | |
| 7 | Polish pass: Kick dark theme (green `#53FC18` accent), demo dry-run, fix the demo path only | 45m | |
| 8 | Presentation deck/pages + email submission | 45m | |

**Rules:**
- Push to `main` (or short-lived branches, merged fast) — remember: only committed code can be demoed.
- Demo path is sacred: when time runs low, cut features, never the demo script.
- Don't build settings/auth/persistence — this is a prototype on mock data, the brief explicitly allows it.

---

## Judging criteria cheat-sheet

- **Problem Solving & Product Thinking (25%)** — lead with the mid-stream-join problem and the streamer's unreadable-chat problem; both are universal and unsolved.
- **Creativity & Innovation (25%)** — the middleman framing (one agent, two masters), tool-call transparency, voice interface.
- **Technical Execution (20%)** — real-time pipeline, clustering, visible tool calls, exact Kick payload shapes.
- **Presentation & Demo (10%)** — follow the 2-min script; the loop moment (step 4) is the money shot.
- **UX (10%)** — Kick-native dark theme, widget feels like a real third-party embed.
