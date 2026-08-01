# Sidekick — pitch plan (pre-script)

> Team Heidi · Easygo Mini Hackathon · Challenge 02 (Chat Insights & Engagement) + Wild Card
> This is the thinking doc. The word-for-word script comes after we agree on this.

---

## 0. Locked decisions

| # | Decision | Consequence |
|---|---|---|
| 1 | **Name: Sidekick.** Viewer surface = Sidekick. Streamer voice = Sidekick Voice | One name everywhere |
| 2 | **Never say "Twitch."** Kick event, Kick judges | Every stat is Kick's own or platform-neutral (§2) |
| 3 | **Drop "middleman."** No noun at all — lead with what it does (§1) | "Sidekick answers the questions chat never gets to" |
| 4 | **Not a queue, not a dashboard — it's the stream's live FAQ.** What chat's asking, ranked, with the AI-handled ones marked off | Gives the streamer *insight* (what they want to know) and an *ask* (the few rows only you can answer) in one list |
| 5 | **The chat is not mocked.** Live Kick channel, real events, real write-back via the Chat API | This is now the headline technical claim — say it out loud (§1.6) |
| 6 | **Vision / screenshots: cut.** Too expensive today | Mention as a next step only if asked. The "not mocked" claim replaces it as the creativity beat |
| 7 | **Sidekick Voice is a web app** — desktop and phone. Demo on phone; IRL is the sharpest case, not the only one | Say the desktop line once so nobody assumes a native iOS app |
| 8 | **Live LLM in the demo** — real model calls, real tool calls | Mitigations mandatory (§7.0) |
| 9 | Not injected into the Kick page — paste the stream link. Cleared with the event host | Framed as a *consideration*, and it becomes the ask: give us the embed slot |
| 10 | Wild Card folds in as the final beat, not a second presentation | One deck, one 5-minute run |
| 11 | **Voice = STT → the same endpoint the chat panel calls → TTS.** One brain, two channels — not a second agent | Strongest architecture line in the deck. Latency answer: render the text first, let audio catch up |

Given, and not worth stage time: it's embedded rather than an extension; answers are private to the asker unless shared. Both are obvious — don't spend words defending them.

---
## 1. The idea, in one sentence

**Sidekick answers the questions chat never gets to — and shows the streamer the ones it couldn't.**

The longer version, if you need it: viewers ask Sidekick anything about the stream they're watching and get an answer in seconds. Everything it *can't* answer — the things only the streamer knows — surfaces on the streamer's side as a live picture of what chat is actually asking. When the streamer answers out loud, Sidekick hears it and answers everyone who asks from then on.

### Replacing "middleman"

You're right that it's the wrong word — it's transactional, slightly negative (nobody likes a middleman), and it makes Sidekick sound like a toll booth rather than something useful.

| Option | How it reads | Verdict |
|---|---|---|
| **No noun at all** — *"Sidekick answers the questions chat never gets to"* | Leads with the benefit, not the mechanism | **Use this.** Strongest opener; nothing to argue with |
| **"the answer layer for Kick chat"** | Product-y, infrastructural, scales | Good second line if you want a category label |
| **"a chat concierge"** | Warm, viewer-side, implies it knows the place | Nice for the viewer section specifically |
| ~~"middleman"~~ / ~~"broker"~~ / ~~"switchboard"~~ | Mechanical, cold, dated | Drop |

Where you genuinely need to describe the position, use the verb instead of a noun: *"Sidekick sits between the streamer and their chat."* Same idea, none of the baggage.

### Pitch line for the three surfaces

> *"Viewers get an answer. The streamer gets to see what everyone's asking. Nobody gets a dashboard."*

---

## 1.5 The three surfaces

### Viewer — Sidekick alongside the stream

Kick on the left, chat scrolling as normal. Sidekick on the right: *"Ask about this stream."* You're logged in with your Kick account, so Sidekick can read the chat and — when you want — post as you.

The frame that does the persuading: **real Kick chat racing up the middle of the screen, and a calm, correct answer arriving on the right.** Noise and signal in one shot, no explanation needed. Every demo beat should keep both halves visible.

### Streamer — "What chat's asking"

**Not a queue, and definitely not a dashboard. It's your stream's FAQ, live.**

A ranked list of what people are actually asking right now, each row showing how many asked and whether Sidekick could handle it:

```
  ┌──────────────────────────────────────────────────────┐
  │  WHAT CHAT'S ASKING                    last 10 min   │
  ├──────────────────────────────────────────────────────┤
  │  23×  who's the guy in the black shirt?              │
  │       ✓ Sidekick answered                            │
  ├──────────────────────────────────────────────────────┤
  │  11×  when's your next fight?                        │
  │       ● only you can answer this            2m ago   │
  ├──────────────────────────────────────────────────────┤
  │   8×  what happened with the sparring thing?         │
  │       ● only you can answer this            5m ago   │
  ├──────────────────────────────────────────────────────┤
  │   6×  what gym is this?                              │
  │       ✓ Sidekick answered                            │
  └──────────────────────────────────────────────────────┘
```

Two things are happening in one list, and it's worth naming both on stage:

1. **The insight** — the streamer finds out what their audience actually wants to know, including the questions they never had to answer. That's information they have never had before, and it's genuinely the "chat insights" half of the brief.
2. **The ask** — the handful of rows marked *only you can answer this* are the entire demand on their attention. Four rows instead of four thousand messages.

**The line:** *"This isn't a dashboard and it isn't a to-do list. It's the FAQ of your stream, live — and Sidekick already answered most of it."*

### Sidekick Voice — the Wild Card

**It's a web app. It works on desktop and on phone.** We demo the phone because that's where the story is sharpest, but say the desktop line out loud — it costs two seconds and it stops a judge assuming we built an iOS app we'd never ship in a day.

Reference aesthetic: **Willow Voice.** Minimal, dark, floating. Live waveform, the streamer's words appearing as they speak, then the answer.

Phone in portrait, stream playing behind. Trigger — action button, shortcut, whatever. *The mechanism doesn't matter; the fact that it's a deliberate trigger does.* Nothing is worse on an IRL stream than an AI talking over you. Pull, not push.

The answer is **spoken and rendered**: spoken because their eyes are on the road, rendered because sometimes there's a red light — and because it makes the beat legible on a projector.

**Why IRL is the sharpest case, not the only case:** IRL is where the streamer physically cannot look at chat — walking, driving, hands full. But the same trigger works at a desk mid-game, and it's the same web app either way.

**It is not a second AI.** The voice lane is speech-to-text in front of the *same endpoint the viewer's chat panel calls*, and text-to-speech behind it. Same brain, same insight engine, same answers — the only thing that changes is the channel it arrives on. Worth saying out loud in the tech beat; see §6.

---

## 1.6 What's actually real (and the one thing that isn't)

**This is now our strongest technical claim, and it should be said out loud early: we are not mocking the chat.**

Every other team will demo against fixtures. We point Sidekick at a live Kick channel, and the chat you see it reasoning over is chat that is happening in the room, right now.

**Real, working:**

- **Reads live Kick chat** — real events off the Kick API, real messages, real users, real emotes and badges.
- **Writes back to Kick chat** — via the Chat API, posting as the logged-in user. That's the two-way half of the brief, on a real endpoint, not a mock.
- **Time-windowed context with compaction** — the agent works over a rolling window (last 5 / 10 minutes) rather than the whole session, so it stays fast and stays cheap. Worth one sentence in the tech beat; it's the difference between a toy and something that could run on a 4.6M-viewer stream.
- **Stream context** — what the streamer is doing and saying right now, so answers are about *this moment*, not just the last N messages.

**Cut, deliberately:**

- **Vision / screenshots.** *"What car is that?"* was a great beat and it's too expensive today. Gone. Note it as a next step, not as a gap — and don't mention it unprompted.

**The consideration — one short section, delivered as confidence, not apology:**

> *"Sidekick isn't injected into the Kick page itself — you paste the stream link and it connects. Ideally this lives natively in the chat column, and that's a Kick-side integration, not a hard problem. Everything behind it — reading chat, writing to chat, the context window — is the real API today."*

That framing turns the one limitation into the ask: *give us the embed slot and this is shipped.* We cleared the approach with the event host.

---
## 2. The problem — and the numbers behind it

Three problems, one root cause: **chat stopped being a conversation, but we still treat it like one.**

### Problem 1 — the new viewer lands with zero context and no way to get it

You click a stream at minute 47 of a three-hour session. You don't know who this is, what they're doing, why they're famous, or why chat is spamming an emote. You type "what's going on?" — and it's gone in two seconds. Nobody answers. So you leave.

**The stat to lead with — and where to get it.**

⚠️ **Provisional — replace if at all possible.** Published research on large live-stream chat finds live chat **peaks as a conversation at roughly 40 messages per 5 minutes — about one message every 7.5 seconds** — and undergoes a second, harder structural breakdown around **200 messages per 5 minutes (≈1 every 1.5 s)**, past which people copy-paste more, say less per message, and participation falls. ([arXiv:1610.06497](https://ar5iv.labs.arxiv.org/html/1610.06497)). **The problem: it's from 2016 and was measured on Twitch.** "Cite the finding, not the platform" is thinner cover than it sounds — if a judge asks for the source, the honest answer is the one word we can't say. Treat this as a placeholder, not a stat we own.

**Better: make the number Kick's own.** We already have a working Kick API client in `src/lib/kick/`. Point it at a live top-10 Kick channel for five minutes this morning and count. Then the slide reads:

> *"We measured [channel] on Kick this morning: **N messages in five minutes** — one every X seconds."*

That's ~20 minutes of work, it's native to their platform, it's verifiable, and it lands far harder with Kick judges than any citation. Do this if there's any slack before the freeze.

- **The line to say on stage:** *"Live chat stops working as a conversation at about one message every seven seconds. Every stream you actually care about on Kick is ten times past that. So for a new viewer, asking a question isn't hard — it's statistically pointless."*
- Kick's own ceiling makes the point for you: **4.6M concurrent viewers** on Stream Fighters 4 (Oct 2025). At that scale chat isn't a conversation, it's weather.

### Problem 2 — the streamer can't read their own chat, so they answer at random

At 10 messages a second nobody is *reading* chat; they're sampling it. The streamer answers whichever message their eye happened to land on. Forty people asked the same thing; one got an answer, by luck.

### Problem 3 — every answer evaporates

The streamer answers "800 DPI, 0.8 sens" at 8:14pm. Six people ask the same question by 8:40. There is no memory in a live stream. The streamer repeats themselves all night, and the people who arrive later never get it at all.

### Why this is a big opportunity (the "because xx" slide)

- Kick did **1.27 billion hours watched in Q1 2026** (+65% year on year), and by June 2026 was running **570.7M hours in the month, 806,800 average viewers, and a 1.85M peak** — with audience metrics up 18–24% on May alone. ([Streams Charts](https://streamscharts.com/overview?platform=kick), [Hexeum Q1 2026](https://hexeum.net/allposts/q1-2026-live-streaming-insights/))
- **Just Chatting is Kick's #1 category: 303.8M of those 1.27B hours in Q1 2026 — just under a quarter of everything watched.** IRL is top-five and grew **43% in a single month** (June 2026). ([Streams Charts](https://streamscharts.com/news/kick-sets-2026-watch-time-record-average-viewership-jumps))
- That last stat is the argument. Kick's biggest category is **conversation**. A conversation platform whose conversation layer breaks above one message every 7.5 seconds. And IRL — the fastest-growing slice — is exactly the format where the streamer physically cannot look at chat.
- Kick also hit a peak of **4.6M concurrent viewers** on a single event (Stream Fighters 4, Oct 2025) — at that scale chat isn't a conversation, it's weather — and something has to stand between the streamer and it.

**The pitch line:** *"Kick's #1 category is people talking. We're fixing the part where they can't hear each other."*

---
## 3. The story — one continuous journey

This is the spine of the presentation. Not four separate personas — **one arc**, following a single new viewer from lost to participating, then flipping to show what that did to the streamer. Everything demoed is a beat in this story.

### The premise

A live IRL/boxing stream. 14.5K watching. Chat is moving faster than anyone can read.

---

### Act 1 — The problem, from inside it *(the viewer who doesn't count yet)*

**Kei is new.** Clicked in from the homepage thirty seconds ago because the thumbnail looked interesting. Doesn't know who's on screen, doesn't know what they're arguing about, doesn't know why one name keeps coming up.

They do the only thing the platform offers: **they type in chat.**

> `keihara453: wait who's the guy in black?`

Four seconds later it's off screen. Nobody replies. Nobody was ever going to reply — not because chat is unfriendly, but because at this speed nobody *saw* it.

**This is the moment the whole product exists for**, and it needs to be shown, not described. The judges watch a real message get swallowed by real chat.

> **Say:** *"That's not a rude chat. That's just what 14,000 people looks like. Kei's question was never going to be answered — and Kei is about to leave."*

---

### Act 2 — Orientation *(the questions a new viewer actually has)*

Kei opens Sidekick, pastes the stream link, and asks the same question again — this time to something that will answer.

The questions come in a specific order, and it's the same order for every new viewer. **This progression is the product insight**: a newcomer isn't asking one question, they're climbing a ladder of context.

| Order | Question | What it needs | Why they ask it |
|---|---|---|---|
| 1 | *"What's going on right now?"* | Stream context + last 10 min of chat | Orientation. Do I even want to be here? |
| 2 | *"Who is this? Why is he famous?"* | Channel info + outside context | Identity. Who am I listening to? |
| 3 | *"What happened five minutes ago?"* | Time-windowed retrieval | Continuity. What did I walk in on? |
| 4 | *"Why is everyone typing that?"* | Chat clustering over the live window | Belonging. What's the joke I'm not in on? |

Question 3 is the one worth pausing on in the demo. **"What happened five minutes ago?"** is a question chat structurally cannot answer — the information has already scrolled into the void, and asking someone to recap is asking for a favour. It's the clearest single demonstration that Sidekick is doing something chat is not.

Question 4 is the belonging one. Being outside an inside joke is the fastest way to feel like you don't belong somewhere — and *"why is everyone saying that?"* is the question people are least willing to type in public.

> **Say:** *"Ninety seconds ago Kei was a stranger watching strangers. Now they know who's talking, what the argument is, and what the joke is. They didn't have to interrupt anyone to get there."*

**Link back to the brief:** this is the engagement half — but note what kind. It's not a poll or a minigame bolted onto the stream. It's *removing the reason people leave in the first minute.*

---

### Act 3 — Participation *(the lurker becomes a chatter)*

Now Kei has context, so their questions change. They stop asking *what is this* and start asking things a fan asks.

> `Kei → Sidekick: when's his next fight?`

Sidekick can't answer this. Nobody can, except the man on screen. And this is where the product does the thing that no chatbot does:

> **Sidekick:** *"That's one for him — and you're not the only one. Eleven people have asked the same thing in the last few minutes. I've put it in front of him."*

Two things just happened that are worth naming out loud:

1. **Kei was told their question mattered.** Chat has never once done that. Even an unanswered question now gets an acknowledgement and a destination.
2. **Kei's question became a signal.** They voted without knowing they were voting.

And because Sidekick can write to chat as the logged-in user, Kei can put it into the room properly if they want to — one clean message instead of shouting into the scroll.

> **Say:** *"Kei arrived as a lurker. Ninety seconds later they're a participant — and they never had to risk asking a dumb question in front of fourteen thousand people."*

**The metric this creates:** lurker → participant conversion. Asking a bot has no social cost. Asking chat does. That's the number that grows the top of the funnel, and it's the one Kick should care about most.

---

### Act 4 — The flip *(what Kei just did to the streamer's world)*

Cut to the streamer's side. Same moment, other end of the pipe.

**What chat's asking:**

```
  23×  who's the guy in the black shirt?      ✓ Sidekick answered
  11×  when's your next fight?                ● only you can answer     2m
   8×  what happened with the sparring thing?  ● only you can answer     5m
   6×  what gym is this?                       ✓ Sidekick answered
```

Kei's question is row two, with ten other people behind it.

The streamer has never had this view. Not a sentiment score, not a word cloud — **the actual questions their audience has, ranked, with the ones already handled marked off.** Twenty-nine of those forty-eight questions never needed them at all.

> **Say:** *"He's never seen this before. Not because it's clever — because nobody could read four thousand messages and tell him. Four rows need him. Everything else is already done."*

**Link back to the brief:** this is the insights half, and it's insight of a kind a dashboard can't produce. A sentiment gauge tells you chat is happy. This tells you chat wants to know when your next fight is.

---

### Act 5 — The loop closes *(the answer stops evaporating)*

The streamer glances at row two and answers it out loud, on stream, the way they always would have:

> *"Yeah, next fight's March — announcement drops next week."*

Sidekick hears it in the stream and everything downstream happens on its own:

1. The answer attaches to those eleven people's question.
2. **Kei gets it, in the streamer's own words**, with a timestamp to jump to.
3. Sidekick posts **one** line into real Kick chat, so the whole room gets it too — everyone who wondered and never asked.
4. The row flips from *only you can answer* to *✓ answered*.
5. **A new viewer arrives two minutes later and asks the same thing — and gets it instantly.**

That last step is the entire pitch. Point at it and say the line:

> **"He answered once. Everyone who ever asks again gets it. That's the loop."**

The answer stopped evaporating. That's the third problem solved, and it's the one nobody else will have touched.

---

### Act 6 — Same brain, no screen *(the Wild Card)*

Now take the streamer out of the chair. They're walking, driving, mid-round, phone mounted — the format that is Kick's fastest-growing and the one where every chat tool ever built stops working.

They hit the trigger. The overlay rises over the stream.

> *"What's chat asking?"*
>
> **Sidekick:** *"Two things worth answering — eleven people want to know when your next fight is, and eight are asking about the sparring thing from earlier."*

They answer to camera. Act 5 runs again, identically. **Same brain, no screen, no keyboard, no eyes free.**

> **Say:** *"Every chat tool ever built assumes you're sitting in front of a monitor. Kick's fastest-growing content is people who aren't."*

---

### Why this order works

The arc is deliberate and worth protecting if time gets cut:

- **It starts with a person, not a product.** Kei is on screen before Sidekick is.
- **The problem is demonstrated before it's described.** A message dying in real chat beats any slide.
- **Engagement and insight are the same event seen twice.** Kei's question *is* the streamer's row two. That's what makes it a genuine loop rather than two features in a trench coat — and the brief asks for exactly that, twice.
- **The payoff is a single sentence** anyone in the room can repeat afterwards.

**How the question changes across the arc** — the short version, if you want it on a slide:

| | Asks | Underneath it |
|---|---|---|
| **New viewer** | "what's going on?" · "who is this?" · "what did I miss?" | *Should I stay?* |
| **Oriented viewer** | "when's his next fight?" · "what happened with X?" | *Can I take part?* |
| **Streamer** | "what's chat asking?" | *What do they want from me?* |

---
## 4. The feedback loop (the thing the brief asks for twice)

Say this as a five-step cycle, out loud, pointing at the screen:

```
Viewer asks Sidekick
        ↓
Sidekick answers what it can        ← live chat, stream context, channel
        ↓
What it can't → clustered → ranked → "What chat's asking"
        ↓
Streamer answers OUT LOUD (at the desk, or prompted by voice — same brain)
        ↓
Sidekick hears it → answers the askers → posts one line into real Kick chat
        ↓
      (back to the top)
```

What makes it genuinely two-way rather than a display: **the streamer's answer changes what the AI knows.** It isn't something they look at, it's something they *empty* — and emptying it is what improves the viewer experience.

The second loop, worth one sentence: how many people ask a thing is what *promotes* it up the list. Viewers vote with their questions without knowing they're voting.

And the third, quietly the best one: **the answer stops evaporating.** Every question the streamer answers out loud becomes something Sidekick knows for the rest of the stream. The longer they stream, the less they repeat themselves.

---

## 5. Metrics — what we'd measure

Put 4 of these on one slide. Don't read all of them.

**North star**
- **Answered-question rate** — % of viewer questions that receive a real answer. Baseline for a new viewer in a 5,000-person chat is effectively 0%. Target >90%.

**Viewer side**
- **Time-to-context** — seconds from join to "I know what I'm watching". Today: never, or ~10 minutes of passive inference. With Sidekick: <10 seconds.
- **60-second survival rate** for new viewers — do they clear the early drop-off cliff. This is the retention number Kick actually cares about.
- **Lurker → participant conversion** — % of silent viewers who ask Sidekick something. Asking a bot has no social cost; asking chat does. This is the number that grows the top of the funnel.
- **Session length delta**, Sidekick users vs. control. The A/B we'd run first.

**Streamer side**
- **Self-serve rate** — % of questions Sidekick resolved without the streamer. The efficiency metric, and the one visible on screen (`✓ Sidekick answered` vs `● only you can answer`). It's what makes this survive a 4.6M-viewer event.
- **Answer leverage** — average cluster size behind each answered question. "You answered 1 question and satisfied 40 people."
- **Questions answered per hour** vs. baseline.
- **Repeat-question rate** — should fall towards zero over a session as the answer store fills. This is the memory working.

The honest one to mention: **interruption cost.** The list must stay quiet. We'd measure rows-surfaced-per-hour and hold it low on purpose — a panel that nags is a panel that gets closed.

---

## 6. How it works (the ~25 second technical beat)

Four things, said fast — and the first one is the one that lands:

1. **It's not mocked.** Sidekick is connected to a live Kick channel. Real `chat.message.sent` events off the Kick API — real users, real badges, real emotes — and when it replies into chat that's `POST /public/v1/chat` with the viewer's own OAuth token, scope `chat:write`. Two-way on a real endpoint.
2. **A rolling context window, compacted.** The agent doesn't get the whole session — it gets the last 5–10 minutes, summarised. That's what makes *"what happened five minutes ago?"* answerable, keeps latency low, and means cost scales with time, not with viewers. It's the difference between a toy and something that survives a 4.6M-viewer stream.
3. **It's an agent, not a wrapper.** Answers render their tool calls inline — `get_recent_chat`, `get_recent_questions`, `get_stream_context`, `get_answered_questions`. Questions get clustered by similarity; a confidence gate decides *answer now* vs *only the streamer knows this*. **That gate is the product.**
4. **One brain, two channels.** This is the part worth thirty seconds. The voice interface is not a second AI with its own prompt — it's **speech-to-text in front of the same endpoint the chat panel calls, and text-to-speech behind it.** The viewer typing a question and the streamer speaking one hit identical code and get identical reasoning. Adding a whole new interface cost us a transcription step, not a second system.

Stack line: Next.js + TypeScript, one insight engine behind one endpoint, both surfaces on top of it.

**If a judge pushes on latency** (they might, and it's the right question): the reasoning step is in-memory and effectively instant — the only real cost is the speech legs. We render the answer on screen the moment it exists and let the audio catch up a beat later, so the streamer *sees* it before they *hear* it and a slow text-to-speech never reads as a hang.

---

## 7. Demo — click-by-click

### 7.0 Running a live-LLM demo without dying

We chose real model calls. That's the right call for Technical Execution — but it means **latency and failure are now part of the performance**, so they have to be designed for, not hoped away.

**Latency is covered by the tool-call rendering.** This is the reason the streamed tool calls stop being a flex and become load-bearing: `⚙ get_recent_chat → 412 messages` appearing at 400ms means the screen is *alive* while the model thinks. Never let the panel show a blank spinner. Stream tokens, always.

**Talk over the wait.** The narrator's line for each beat is timed to run *while* the answer streams — the driver clicks on the first word of the sentence, not the last. Nobody should ever be watching silence.

Six mitigations, all cheap:

1. **Pre-warm** — fire a throwaway call the moment the page loads backstage, so the first real call isn't a cold connection.
2. **Tether, don't trust the venue** — phone hotspot as the primary connection, venue wifi as backup. Test both from the actual stage position.
3. **Hard timeout with a graceful fallback** — if a call exceeds ~6s, fall back to a cached answer for that exact demo question. It looks identical on screen. Nobody knows.
4. **Cache the slow ones** — the streamer primer and the channel context don't change; fetch them at page load, not on click.
5. **Small prompts, fast model** — don't stuff the whole transcript in. Retrieve, then answer.
6. **Recorded full-run backup.** Screen-capture a clean successful run before you leave the build. One keystroke plays it fullscreen. If anything goes sideways on stage, the driver hits it and the narrator keeps talking the same script without breaking stride. **This is the single most important insurance and it costs three minutes.**

**Setup before you walk on:** browser fullscreen, Kick channel already live and chatting on the left, Sidekick connected on the right, streamer FAQ view on a keystroke, phone frame ready in-page. Volume up — beats 5 and 6 need audio.

**Pick the channel late.** It has to be live *at your slot*, with chat moving, and safe to put on a projector. Shortlist three the hour before, confirm one during setup, and have the recorded backup run keyed to whichever you pick.

**On showing the phone:** don't mirror a physical phone — that's the classic on-stage failure. Render the Voice UI as a **portrait phone frame inside the web app**, driven by the same live agent, mic off the laptop. Live, legible on a projector, no AirPlay to fail. Hold the real phone as a prop and offer it after — *"come try it, it's the same page."*

Total: **2 minutes 40 seconds.** Rehearse it three times; the demo is the pitch.

| # | Time | You do | You say (gist) | The point |
|---|---|---|---|---|
| 1 | 0:20 | Real Kick channel, chat flying. Type into the **real** chat box: *"wait who's the guy in black?"* — watch it get swallowed | "That's me, thirty seconds old on this stream. My question is already gone. That's not a rude chat — that's just what fourteen thousand people looks like." | The problem, demonstrated live on their own platform |
| 2 | 0:35 | Paste the stream link into Sidekick. Ask *"what's going on right now?"* → tool calls stream → answer. Then *"who is this, why is he famous?"* | "This is live. We're not replaying fixtures — that's the chat you just watched, being read right now." | Orientation + **the "it's real" claim**, which is now the flex |
| 3 | 0:25 | Ask *"what happened five minutes ago?"* then *"why is everyone typing that?"* | "That first one chat structurally cannot answer — it already scrolled away. And nobody wants to admit in public they don't get the joke." | The two questions only Sidekick can serve |
| 4 | 0:30 | Ask *"when's his next fight?"* → Sidekick: *"that's one for him — eleven others asked too, I've put it in front of him."* **Flip to the streamer view** — row two, 11×, *only you can answer* | "It didn't guess. It knew it couldn't know — and it turned my question into a signal. Twenty-nine of those questions never needed him at all." | The confidence gate + the insight half, in one move |
| 5 | 0:25 | Streamer answers out loud. Sidekick attaches it, posts **one line into the real Kick chat** (visible on the left), row flips to ✓ — then re-ask as a new viewer → instant answer, in his words, timestamped | **"He answered once. Everyone who ever asks again gets it. That's the loop."** *(pause)* | **The money shot.** Point at the real chat message |
| 6 | 0:25 | Phone frame, stream behind it. Hold the trigger → waveform → *"what's chat asking?"* → answer spoken and rendered | "Same brain, no screen. Every chat tool ever built assumes you're at a monitor — Kick's fastest-growing content is people who aren't. And it only speaks when he asks." | Wild Card, folded in |

**Cut order if you're over time:** the second half of beat 3 → beat 1 (describe the problem instead of showing it) → beat 6 down to one sentence. **Never cut beats 4 and 5** — they are the product.

---

## 8. The 5-minute structure (mapped to their 6-step framework)

| Their step | Ours | Time | Running |
|---|---|---|---|
| 1. Hi, we're team xx | "We're Team Heidi. We built Sidekick — it answers the questions chat never gets to." | 0:20 | 0:20 |
| 2. The challenge we're solving | The three problems + the 7.5-second stat | 0:40 | 1:00 |
| 3. Our possible solution | One sentence + the three surfaces, then straight into the demo | 0:20 | 1:20 |
| — | **Live demo** (§7) | 2:40 | 3:50 |
| 4. This is a big opportunity because… | Kick's Just Chatting/IRL numbers + two metrics | 0:25 | 4:15 |
| 5. Execution — target user & next steps | "It's not mocked", the consideration, the embed ask | 0:25 | 4:40 |
| 6. Summarise & thank you | The one-sentence recap + the loop line | 0:20 | 5:00 |

Slide count: **6 max.** Title / Problem / Solution / (demo — no slide) / Opportunity + metrics / "It's real" + consideration + the ask. Anything else is time you're stealing from the demo.

---

## 8.5 How we actually run the five minutes

### Roles — two people, and only one of them talks

- **Narrator** — holds the mic, never touches a keyboard, faces the judges, does all the talking including the demo voiceover.
- **Driver** — silent, on the laptop, clicks on the narrator's cue words. Never speaks, never stands in front of the screen.

One voice for five minutes beats two voices with handovers. Every handover costs ~5 seconds and breaks the thread. If a third person must be on stage for the Collaboration mark (10%), give them the 20-second "how it works" beat and nothing else — one clean handover, not four.

**The cue-word method:** every demo beat has a trigger word in the narrator's script. The driver clicks on that word, not on a nod or a glance. Write the cue words into the driver's copy of the script in bold. It is the difference between a demo that flows and two people whispering "go... now?"

### The screen — one window, no alt-tab

Build the deck as **a route in the same Next app** (`/deck`). Then the whole presentation is one browser window in fullscreen, arrow keys between slides and demo. No alt-tab, no desktop wallpaper, no Slack notification, no "sorry, one sec." The brief asks for a presentation page anyway — this satisfies it and de-risks the run at the same time.

- Streamer queue is a **split-pane toggle**, one keystroke — not a second tab. The judges should see viewer and streamer side by side at the moment the loop closes. That's the whole point of beat 5; don't make them hold two screens in their head.
- Demo controls (question flood, new viewer joins) on **hidden keyboard shortcuts**. Visible buttons labelled "QUESTION FLOOD" tell the judges it's theatre.
- Notifications off. Do Not Disturb on. Second monitor mirrored, not extended.

### Audio — the thing that kills demos

Beat 5 needs the streamer's voice audible in the room, and beat 6 is entirely audio. **Confirm the venue takes laptop audio, not just video.** Test it during setup with actual sound, at actual volume. If they only take video, record the voice beat as a video with burned-in subtitles so it survives on mute.

### Timing checkpoints

Rehearse against these, out loud, three times with a timer visible:

- **1:20** — must be into the demo. If you're not, cut straight there mid-sentence.
- **3:50** — must be out of the demo. If you're not, the driver jumps to the last beat.
- **4:40** — must be on the closing line.

If you're behind, cut in this order: beat 1 → the second half of beat 3 → the metrics slide down to one number. **Never cut beat 5.**

### Order of the room

Judges' attention is highest in the first 30 seconds and at the demo. So: one sentence of who you are, straight into the problem *shown live* rather than described, then the demo. Save the numbers for after they already want it to exist — a stat slide before they understand the product is a stat nobody remembers.

### The last ten seconds

Land the loop line, stop talking, and let the pause sit. Don't trail off into "yeah, so, that's about it." The last thing they hear should be the sentence you most want repeated in the judging room:

> *"He answers once. Everyone who ever asks again gets it. That's the loop."*

---

## 9. Risks and how we answer them

| A judge says… | You say… |
|---|---|
| "Isn't this just ChatGPT with a stream in the prompt?" | "The chatbot is the easy half. The product is the gate — deciding what the AI *can't* answer and turning that into what the streamer sees. That's the part chat has never had." |
| "Is that actually live, or a recording?" | "Live. Pick a channel — we'll paste it in." *(Only offer this if you've tested it. If you have, it wins the room.)* |
| "Why isn't it inside the Kick page?" | "Because that's your slot to give, not ours to take. Everything behind it is your real API today — reading chat, writing to chat. Drop it into the chat column and it ships." |
| "Where does it get what the streamer is saying?" | "Stream context on our side — the chat and the write-back are your API, straight." |
| "Won't the AI answer things wrong on the streamer's behalf?" | "It never speaks *as* the streamer. It quotes them with a timestamp, or it says 'that's one for him' and escalates. Confidence gate, not a guess." |
| "Streamers already ignore their dashboards." | "That's why it isn't one. It's four questions instead of four thousand messages, and it empties itself when he talks." |
| "Doesn't this reduce chat activity — people stop talking to each other?" | "It converts lurkers into askers, and it removes the repeat questions that were crowding out actual conversation. We'd measure both." |
| "What about latency / cost at 4.6M viewers?" | "Answers are cached per cluster — one answer serves the whole cluster, so cost scales with *distinct* questions, not viewers. That's the deflection-rate metric." |

---

## 10. What still needs building (against §7)

Ordered by demo dependency, not by size. Everything here maps to a beat above; anything that maps to no beat doesn't get built.

1. Live view — Kick channel + its chat on the left, Sidekick panel on the right, paste-a-link connect (beats 1–5)
2. Live Kick chat ingestion + rolling 5/10-minute window with compaction (beats 2, 3)
3. Sidekick answers — live LLM, streamed tool calls rendered inline (beats 2, 3)
4. Question clustering + the confidence gate (*answer now* vs *only the streamer knows*) (beat 4)
5. "What chat's asking" — ranked FAQ rows, counts, ages, ✓/● status (beats 4, 5)
6. Write-back to real Kick chat via `POST /public/v1/chat` + answered-answer store + recall on re-ask (beat 5)
7. Stream context / transcript feed (beats 2, 3, 5)
8. Sidekick Voice — portrait phone frame in-page, Willow-style overlay (waveform, live transcript, spoken + rendered answer), ElevenLabs agent on the same tools (beat 6)
9. Deck (6 slides, one of them the consideration/next-steps slide) + email to events@easygo.io
10. Recorded backup run (§7.0) — three minutes of work, do it before the freeze

---

## Sources

> **Deck rule: no competitor platform is named on a slide or out loud.** The chat-velocity research below was measured on another platform — cite the *finding*, never the source platform, and replace it entirely if we get our own Kick measurement (see §2).

- [Information Overload in Group Communication (arXiv:1610.06497)](https://ar5iv.labs.arxiv.org/html/1610.06497) — the 40-msgs/5-min and 200-msgs/5-min thresholds
- [Streams Charts — Kick platform overview](https://streamscharts.com/overview?platform=kick)
- [Streams Charts — Kick sets 2026 watch-time record](https://streamscharts.com/news/kick-sets-2026-watch-time-record-average-viewership-jumps)
- [Streams Charts — Kick reaches 500M hours watched, March 2026](https://streamscharts.com/news/kick-reaches-over-500-million-hours-watched-march-2026)
- [Hexeum — Q1 2026 Live Streaming Insights](https://hexeum.net/allposts/q1-2026-live-streaming-insights/)
- [yostream.io — Why live streams fail](https://yostream.io/blog/why-live-streams-fail/) *(blog, weak source — use with care)*
