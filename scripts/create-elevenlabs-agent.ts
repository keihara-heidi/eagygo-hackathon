/**
 * One-time setup: creates the "Sidekick" ElevenLabs conversational agent with
 * client tools matching the shared insight API, then writes
 * NEXT_PUBLIC_ELEVENLABS_AGENT_ID into .env.local.
 *
 * Run: bun run scripts/create-elevenlabs-agent.ts
 */

import { readFileSync, writeFileSync } from "node:fs";

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error("ELEVENLABS_API_KEY is not set (.env.local)");
  process.exit(1);
}

const clientTool = (name: string, description: string) => ({
  type: "client",
  name,
  description,
  expects_response: true,
  response_timeout_secs: 10,
});

const body = {
  name: "Sidekick — Kick stream copilot",
  conversation_config: {
    agent: {
      first_message:
        "Sidekick here. Ask me what chat's been saying, the vibe, or if there's anything you should answer.",
      language: "en",
      prompt: {
        prompt: [
          "You are Sidekick, a live co-pilot for OrbitFPS, a Kick streamer who is mid-game and cannot read the screen.",
          "Answer questions about the stream's live chat using your tools. ALWAYS call a tool before answering — never invent chat data.",
          "Be brief and punchy: one to three short spoken sentences, no lists, no markdown. Talk like a hype but efficient esports coach.",
          "Typical asks: what's the chat vibe, what's trending, any questions worth answering on stream, who's new today.",
          "If get_recent_questions returns unanswered clusters, lead with the most-asked one and how many people asked it.",
        ].join(" "),
        temperature: 0.3,
        tools: [
          clientTool(
            "get_chat_vibe",
            "Current chat mood: hype/chill/tilted/dead, messages per minute, and a one-line description.",
          ),
          clientTool(
            "get_recent_questions",
            "Clustered questions viewers are asking, with counts and answered status. Use when asked what to answer or what chat wants to know.",
          ),
          clientTool(
            "get_trending",
            "Trending words and emotes in chat over the last 90 seconds.",
          ),
          clientTool(
            "get_new_chatters",
            "Active chatter counts, first-time chatters, recent followers and notable events (subs, KICKs gifts).",
          ),
          clientTool(
            "get_stream_context",
            "Stream title, category, uptime and viewer count.",
          ),
        ],
      },
    },
  },
};

const response = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
  method: "POST",
  headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

if (!response.ok) {
  console.error("Agent creation failed:", response.status, await response.text());
  process.exit(1);
}

const { agent_id } = (await response.json()) as { agent_id: string };
console.log("Created ElevenLabs agent:", agent_id);

const envPath = ".env.local";
let env = "";
try {
  env = readFileSync(envPath, "utf8");
} catch {
  // fresh file
}
if (env.includes("NEXT_PUBLIC_ELEVENLABS_AGENT_ID=")) {
  env = env.replace(
    /NEXT_PUBLIC_ELEVENLABS_AGENT_ID=.*/g,
    `NEXT_PUBLIC_ELEVENLABS_AGENT_ID=${agent_id}`,
  );
} else {
  env = `${env.trimEnd()}\nNEXT_PUBLIC_ELEVENLABS_AGENT_ID=${agent_id}\n`;
}
writeFileSync(envPath, env);
console.log("Wrote NEXT_PUBLIC_ELEVENLABS_AGENT_ID to .env.local");
