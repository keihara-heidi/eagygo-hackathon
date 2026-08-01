# Deck prompt — paste everything below the line

> Attach `SCRIPT.md` (what gets said over each slide) and `sidekick-voice-ui.png` (tone reference for the phone screen).

---

Build a six-slide presentation deck as a `/deck` route in this existing Next.js app. Arrow keys to move between slides, fullscreen 16:9. It goes on a projector at 4:00 PM today in front of judges from Kick, and the team talks over it for five minutes — so the slides are a backdrop, not a script. Everything spoken lives in `SCRIPT.md`.

## What the product is

Sidekick sits next to a Kick stream and answers questions about it. A viewer who just clicked in can ask "what's going on?" or "who is this?" and get a real answer, instead of typing into a chat moving too fast for anyone to see them. Anything Sidekick can't answer — the stuff only the streamer knows — gets grouped up and shown to the streamer as a list of what chat keeps asking. There's also a phone version where the streamer just talks to it, for when they're out and about and can't look at chat.

## How to talk about it on the slides

Plain and direct. Write like you're explaining it to someone at the next desk.

- **No hype words.** No "revolutionary", no "seamless", no "AI-powered", no "game-changing".
- **No internal jargon on slides.** Don't write "one brain, two channels" or "split brain" or "escalation gate". If you need to describe the voice version, it's just *"the same agent — you talk to it instead of typing."*
- **Don't make a slogan out of the data being real.** State it plainly where it belongs (slide 5) as a fact about how it works, not as a boast.
- Contractions are fine. Short sentences are better.

---

# The six slides

These follow the framework the organisers gave: intro → challenge → solution → opportunity → execution → summary. The copy below is close to final — tighten wording if it helps the layout, don't add to it.

### Slide 1 — Hi, we're Team Heidi

| Element | Copy |
|---|---|
| Wordmark | `SIDEKICK` |
| One line under it | `Ask anything about the stream you're watching.` |
| Footer | `Team Heidi · Challenge 02` |

Big, quiet, confident. On screen for twenty seconds — nothing else on it.

### Slide 2 — The challenge we're solving

| Element | Copy |
|---|---|
| Hero stat | `1 MESSAGE EVERY 7 SECONDS` |
| Caption under it | `the point chat stops working as a conversation` |
| Three short lines, lower third | `You ask a question — it's gone in four seconds.` · `The streamer can't read chat either.` · `And when they do answer, that's gone too.` |

The stat dominates. The three lines are a footer to it, not a bulleted list, no icons.

> ⚠️ **The hero stat is provisional — build it as one swappable string constant.**
> The current number comes from academic research on large live chats, but it's from 2016 and was measured on another platform, which the team can't cite in this room. It is being replaced with a measurement taken off a live Kick channel before the deadline — something like `KICKCHANNEL · 412 MESSAGES IN 5 MINUTES`, with the caption becoming `one every 0.7 seconds`. Make the swap a one-line change.

### Slide 3 — Our solution

Three rows, generously spaced, structurally identical:

```
VIEWERS        →   ask it anything, get an answer
THE STREAMER   →   sees what chat keeps asking
NOBODY         →   gets a dashboard
```

Left column muted grey, right column white and large. **Only `gets a dashboard` is green.** The joke works by pattern-break, so keep the three rows visually identical — if you restyle the third row, it dies.

### Slide 4 — Black slide

Empty `#0b0b0c`. The live demo runs from here and comes back to it. (Doesn't count toward the six.)

### Slide 5 — This is a big opportunity

| Element | Copy |
|---|---|
| Stat A | `24%` — caption `of everything watched on Kick in Q1 was Just Chatting` |
| Stat B | `+43%` — caption `IRL watch time growth in a single month` |
| Conclusion, centred beneath | `Kick's biggest category is people talking.` |
| Small line at the bottom | `What we'd measure: how many questions actually get answered — and how many never have to reach the streamer.` |

The conclusion line is the only green thing here.

> Sources, if anyone asks: Just Chatting was **303.8M of Kick's 1.27B hours watched in Q1 2026** — both Kick-only figures from the same Hexeum report. 303.8 ÷ 1,270 = 23.9%, which is where 24% comes from. It is a derived figure, not a published one, so the caption must carry the period. IRL's +43% monthly watch-time growth and Kick's 570.7M hours / 806.8K average viewers / 1.85M peak are June 2026 figures from Streams Charts.

### Slide 6 — Execution: who it's for, how it works, what's next

This is the one slide allowed a bit more detail — it's carrying the technical credibility.

| Element | Copy |
|---|---|
| Heading | `WHO IT'S FOR` |
| Two lines | `New viewers landing on big channels — the ones who leave in the first minute.` · `IRL streamers, who can't look at chat at all.` |
| Divider | — |
| Heading | `HOW IT WORKS` |
| Four lines | `Paste any channel — it connects. No sign-off needed.` · `A tool-loop agent over live chat, transcript and trends.` · `Posts back into chat through the Chat API.` · `Voice is the same agent, spoken.` |
| Divider | — |
| Heading | `WHAT'S NEXT` |
| One line, green | `Put it inside the chat column. Right now you paste a stream link.` |

Three labelled blocks. Keep the labels small and muted so the content reads first. This slide is denser than the others on purpose — but it's still lines, not paragraphs.

### Slide 7 — Summarise & thank you

| Element | Copy |
|---|---|
| The line, filling the slide | `He answers once. Everyone who asks after that gets it.` |
| Footer | `Team Heidi · Thanks` |

`once` and `after that` may be green. Nothing else on the slide — no logo, no QR code, no team photo.

---

# Design system — match Kick

These values came off the live kick.com DOM, so they're accurate. `src/app/globals.css` already has them as tokens — **use the tokens, don't invent colours.**

| Token | Value | What it's for |
|---|---|---|
| `--background` | `#0b0b0c` | Every slide background |
| `--card` | `#171a1c` | Panels, blocks |
| `--secondary` | `#42474d` | Chips, dividers, secondary chrome |
| `--primary` | `#53fc18` | The green. One per slide |
| `--primary-foreground` | `#0b0b0c` | Black text on green — never white on green |
| `--foreground` | `#ffffff` | Primary text |
| `--muted-foreground` | `#9fa6ad` | Captions, labels |
| `--border` | `rgba(240,241,242,0.16)` | Every border, 1px |

**Type.** Kick's UI is Inter and nothing else — weights 400/600/700, and letter-spacing is `normal` on essentially every element on their site. So: Inter for all body, captions and labels, and **no wide-tracked uppercase micro-labels** — that's the fastest way to look like a generic startup deck instead of Kick. Booster Polygonal Bold (`--font-heading`) is allowed for hero lines and the wordmark only, since a deck isn't product UI.

**Shape.** Kick is tight-radius: 4px is the default across their whole site, with pills for badges and avatars. **Nothing `rounded-xl` or softer.** Soft bubbly corners are the single clearest tell of AI-generated UI.

---

# Rules

1. **Around 15 words per slide**, except slide 6 which is allowed more. If it's in `SCRIPT.md` it doesn't need to be on screen too.
2. **One green element per slide.** Two greens and neither one is the point.
3. **Projector legibility** — assume a washed-out projector in a bright room. Nothing under ~28px equivalent, high contrast only, no thin weights at small sizes.
4. **No bullet lists, no icon sets, no stock imagery, no gradient meshes, no glassmorphism.**
5. **Motion:** a fast cross-fade at most. No staged reveals — every animation steals time from a five-minute slot.
6. Keyboard: `←` `→` between slides, one key to jump to the live app. Don't print the shortcuts on screen.

# Technical

- Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn/ui — all installed. **Read `AGENTS.md` first**; this Next.js version has breaking changes and the guides are in `node_modules/next/dist/docs/`.
- Package manager is **Bun**. Tailwind v4 keeps its theme in the `@theme inline {}` block in `globals.css` — there is no `tailwind.config.ts`.
- `bun run typecheck`, `bun run lint` and `bun run build` must stay green.
- Deadline 4:00 PM, only committed code counts. Commit as you go.
- Other people are working in this repo right now. **Only touch files under the deck route and anything new you create** — don't refactor shared code, don't edit `src/lib/`, don't change existing routes.

# Done means

- Seven screens (six content slides plus the black demo slide), fullscreen 16:9, arrow-key navigation.
- Every colour is an existing token. Every radius is 4px or a pill.
- Read from across the room, each slide's single idea lands in about two seconds.
- It looks like Kick made it.
