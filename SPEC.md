# Sidekick — AI Middleman for Kick Chat

> **Easygo Mini Hackathon · Challenge 02: Chat Insights & Engagement**
> Submission deadline: **4:00 PM today** — all code pushed + presentation & prototype emailed to events@easygo.io. Anything uncommitted = disqualified. **Commit early, commit often.**

## One-liner

An AI agent that sits between the streamer and their chat: viewers ask it what's happening and get instant catch-up; the streamer asks it what chat is feeling and gets live insight — and every answer one side gives feeds the other.

---

## Why this wins (mapping to the brief)

| Brief requirement | How Sidekick answers it |
|---|---|
| Help streamers understand chat | Chat-native nudges (bot posts clustered questions into chat) + voice agent for vibe/trends on demand |
| Give viewers a way to participate beyond typing | Personal AI copilot widget — ask anything about the stream/chat without shouting into the scroll |
| **Genuine feedback loop** | Viewer questions cluster → Sidekick posts a digest into chat → streamer answers on stream → `!answered` → bot relays the answer to every future asker. Both sides feed each other continuously. |
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

### 2. Chat-native streamer nudges (insights side — deliberately no dashboard)

We keep the streamer side minimal: no separate dashboard. Insight arrives where the streamer already looks — the chat itself.

- **Question digest (hero feature):** when similar questions cluster past a threshold, Sidekick posts into chat as a bot message — *"📢 8 people have asked about your sensitivity in the last 5 min"*. (Mirrors the real `POST /public/v1/chat` bot capability.)
- **Close the loop with a command:** streamer answers on stream, then streamer/mod types `!answered` (or replies to the digest). From then on the viewer bot relays the answer to anyone who asks again.
- Everything else insight-wise (vibe, trends, who's showing up) lives in the **voice agent** — on demand, zero screen real estate.

### 3. Wildcard — Voice Agent for the streamer

The streamer's only dedicated interface — mid-game, hands on keyboard, nothing to read. From their phone:

- Tap to talk on a phone browser page; conversation runs over WebRTC via **ElevenLabs Agents**.
- Ask: *"What's chat been saying the last 10 minutes?"* / *"What's the vibe?"* / *"Any questions I should answer?"* / *"Who's new today?"*
- Agent answers out loud with real, expressive turn-taking voice — powered by the same insight engine as the viewer bot.

Same brain, second interface. Pitch line: *"Viewers get a widget; the streamer gets a voice. Nobody gets a dashboard."*

**ElevenLabs architecture:**

1. Create an agent in the [ElevenLabs dashboard](https://elevenlabs.io/app/agents) ("Sidekick"). System prompt: *"You are Sidekick, a live co-pilot for a Kick streamer. Answer questions about their chat using your tools. Be brief and punchy — the streamer is mid-game."* Enable Expressive Mode.
2. `/voice` page wraps the app in `ConversationProvider` from **`@elevenlabs/react`** with the `agentId`; `startSession()` on tap — the SDK handles mic, STT, turn-taking, and TTS audio out. No speech code on our side.
3. Connect it to our data with **client tools** (defined in the agent config, implemented as functions on the `/voice` page): `get_chat_vibe`, `get_recent_questions`, `get_trending`, `get_new_chatters`, `get_stream_context`. Each handler just `fetch`es our Next.js insight API and returns JSON; the agent turns it into speech.
4. Public agent + `agentId` is enough for the demo (no signed-URL server auth needed). Client tools mean **no public webhook/tunnel required** — the phone page calls our API directly.

**Fallback if ElevenLabs is down/quota'd on demo day:** keep the browser `SpeechRecognition` + `speechSynthesis` path behind a flag.

**♻️ Overlap with the main solution — read this if you're building the copilot/insight engine:**

- **The insight API is the shared contract.** The voice agent's client tools (`get_chat_vibe`, `get_recent_questions`, `get_trending`, `get_new_chatters`, `get_stream_context`, `get_answered_questions`) are the *same* functions the viewer copilot needs. Build them once as Next.js API routes on top of the insight engine; both interfaces consume them. Agree on names/shapes early — changing a tool name later means touching the ElevenLabs agent config too.
- **The viewer widget's tool-call display should show these exact tool names.** Then the "mocked" tool calls in the UI are the real contract the voice agent uses — one story across both demos, and judges see the same architecture twice.
- **The answered-questions store is shared state.** `!answered` (main solution) must be readable by the voice agent ("any questions I should answer?" → skips answered ones).
- **Optional cheap win:** ElevenLabs TTS can also voice the viewer copilot's catch-up TLDR ("🔊 listen instead") — same API key, ~10 lines.

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
│ Viewer       │ │ Bot digest   │ │ Voice Agent   │
│ Copilot      │ │ posts into   │ │ (phone PTT +  │
│ widget       │ │ chat +       │ │  TTS reply)   │
│              │ │ !answered    │ │               │
└──────────────┘ └──────────────┘ └───────────────┘
```

**Stack:** Next.js (App Router) + TypeScript + Tailwind (+ shadcn/ui). Insight engine in API routes / server code; event stream to clients via SSE or simple polling. Voice via **ElevenLabs Agents** (`@elevenlabs/react`, client tools calling our insight API); browser Web Speech API as fallback.

**LLM responses:** two options, decide early —
1. **Scripted responses** keyed to demo timeline (deterministic, zero risk, fine per brief since mocking is allowed) — recommended baseline.
2. Real LLM call (if an API key is handy) with the mock chat as context — nice-to-have upgrade, keep behind a flag.

**Mock data fidelity rule:** every mocked message/event must match the real Kick payload shapes (sender identity with badges, emotes with positions, `replies_to`, timestamps — see `chat.message.sent` in the [Kick event docs](https://docs.kick.com/events/event-types)). Judges from Kick will notice.

---

## Demo script (~2 min)

1. **Cold open — the problem (15s):** mocked Kick stream page, chat scrolling fast. "You just joined. What's going on? Who is this? Chat's spamming an emote you don't get."
2. **Viewer copilot (30s):** click the widget → "what's going on?" → tool calls stream in → TLDR appears. Then "who's the streamer?" → primer. Then trigger "new viewer joins" → auto-greet.
3. **Streamer nudge (30s):** hit "question flood" — 8 viewers ask about sensitivity in different words → Sidekick posts into chat: *"📢 8 people have asked about your sensitivity."* Streamer "answers on stream", mod types `!answered`.
4. **The loop (20s):** a new viewer asks the same question → bot: *"he just answered this — 800 DPI."* Point at it: **that's the feedback loop.**
5. **Wildcard — voice (25s):** pull out phone, hold PTT: "what's the vibe in chat?" → agent speaks: *"Chat's hyped — messages up 3x, KEKW trending, two questions worth answering."*

---

## Build plan & task split

> Adjust owners as needed. Integration checkpoint at **2:00 PM**, feature freeze **3:15 PM**, final push **3:45 PM** (buffer before the 4:00 cutoff).

| # | Task | Est | Owner |
|---|---|---|---|
| 1 | Scaffold Next.js app, layout: stream page (video placeholder + chat column), routes for `/` (viewer) and `/voice` (phone) | 45m | |
| 2 | Mock chat engine: scripted timeline of Kick-shaped events, demo control panel (intensity, hype spike, question flood, new-viewer join) | 60m | |
| 3 | Insight engine: word/emote frequency buckets, question detection + clustering, vibe classifier, chatter tracking, answered-question store | 75m | |
| 4 | Viewer copilot widget: chat UI, tool-call rendering, scripted/LLM responses, auto-greet | 75m | |
| 5 | Bot digest posts into chat + `!answered` command handling | 30m | |
| 6 | Voice agent: configure ElevenLabs agent (prompt + client tools), `/voice` page with `@elevenlabs/react`, tool handlers → insight API | 60m | |
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
