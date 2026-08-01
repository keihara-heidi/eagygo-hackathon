import { NextResponse } from "next/server";

import { getInsights, type InsightEngine } from "@/lib/sidekick/insights";
import { getSession } from "@/lib/sidekick/session";

export const dynamic = "force-dynamic";

/**
 * The viewer copilot brain: routes a question to an intent, gathers data from
 * the insight engine, and reports the tool calls it made — the same tool
 * vocabulary the ElevenLabs voice agent uses.
 */

interface ToolCall {
  tool: string;
  request: string;
  summary: string;
}

interface CopilotResponse {
  intent: string;
  answer: string;
  tool_calls: ToolCall[];
}

function minutesAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  return minutes <= 1 ? "a moment ago" : `${minutes} min ago`;
}

function catchup(insights: InsightEngine, greeting: string | null): CopilotResponse {
  const vibe = insights.vibe();
  const trending = insights.trending();
  const context = insights.context();
  const chatters = insights.chatters();

  const topWords = trending.words.slice(0, 3).map((entry) => `"${entry.word}"`);
  const topEmote = trending.emotes[0];
  const parts: string[] = [];
  parts.push(
    `${context.streamer} is ${Math.floor(context.uptime_minutes / 60)}h ${context.uptime_minutes % 60}m into "${context.title}" (${context.category}).`,
  );
  parts.push(vibe.description);
  if (topWords.length > 0) parts.push(`Chat is talking about ${topWords.join(", ")}.`);
  if (topEmote) parts.push(`Emote of the moment: ${topEmote.name} (${topEmote.count}x).`);
  if (chatters.notable.length > 0) parts.push(`Recently: ${chatters.notable.slice(-2).join("; ")}.`);

  return {
    intent: "catchup",
    answer: `${greeting ? `Welcome, @${greeting}! ` : ""}Here's what you missed: ${parts.join(" ")}`,
    tool_calls: [
      {
        tool: "get_stream_context",
        request: "GET /api/insights/context",
        summary: `${context.category} · ${context.viewer_count} viewers`,
      },
      {
        tool: "get_chat_vibe",
        request: "GET /api/insights/vibe",
        summary: `${vibe.vibe} · ${vibe.messages_per_minute} msg/min`,
      },
      {
        tool: "get_trending",
        request: "GET /api/insights/trending",
        summary: trending.words.length > 0 ? `top word ${trending.words[0]?.word}` : "quiet",
      },
      {
        tool: "get_new_chatters",
        request: "GET /api/insights/chatters",
        summary: `${chatters.active_last_10m} active chatters`,
      },
    ],
  };
}

function streamerPrimer(insights: InsightEngine): CopilotResponse {
  const context = insights.context();
  return {
    intent: "streamer_primer",
    answer: `${context.streamer_primer} Right now: "${context.title}" with ${context.viewer_count.toLocaleString()} viewers.`,
    tool_calls: [
      {
        tool: "get_stream_context",
        request: "GET /api/insights/context",
        summary: `${context.streamer} · live ${context.uptime_minutes} min`,
      },
    ],
  };
}

function emoteExplainer(insights: InsightEngine): CopilotResponse {
  const trending = insights.trending();
  const vibe = insights.vibe();
  const top = trending.emotes[0];
  const answer = top
    ? `Chat is spamming ${top.name} (${top.count}x in the last 90s) — ${
        vibe.vibe === "hype"
          ? "something big just happened and chat is celebrating."
          : "it's the running reaction to the current moment."
      }`
    : "No big emote wave right now — chat is just vibing in plain text.";
  return {
    intent: "emote_explainer",
    answer,
    tool_calls: [
      {
        tool: "get_trending",
        request: "GET /api/insights/trending",
        summary: top ? `${top.name} x${top.count}` : "no emote spike",
      },
      {
        tool: "get_chat_vibe",
        request: "GET /api/insights/vibe",
        summary: `${vibe.vibe}`,
      },
    ],
  };
}

function recallOrFlag(insights: InsightEngine, question: string): CopilotResponse {
  const answered = insights.findAnswered(question);
  if (answered) {
    return {
      intent: "answered_recall",
      answer: `Good news — OrbitFPS covered this ${minutesAgo(answered.last_asked_at)}: ${answered.answer}`,
      tool_calls: [
        {
          tool: "get_answered_questions",
          request: "GET /api/insights/questions",
          summary: `matched "${answered.representative}" (asked ${answered.count}x)`,
        },
      ],
    };
  }

  const open = insights
    .questions()
    .find((cluster) => !cluster.answered && cluster.count >= 2);
  return {
    intent: "question_flagged",
    answer: open
      ? `You're not the only one — "${open.representative}" has been asked ${open.count}x. Sidekick has flagged it in chat so OrbitFPS sees it.`
      : "I don't have an answer for that yet — I've noted it. If more viewers ask the same thing, Sidekick will flag it to OrbitFPS in chat.",
    tool_calls: [
      {
        tool: "get_recent_questions",
        request: "GET /api/insights/questions",
        summary: open ? `${open.count} similar asks pending` : "no matching cluster yet",
      },
    ],
  };
}

function fallback(): CopilotResponse {
  return {
    intent: "help",
    answer:
      "I'm Sidekick — I watch this chat so you don't have to scroll. Try: \"what's going on?\", \"who is the streamer?\", \"why is chat spamming?\", or ask anything the streamer might have answered.",
    tool_calls: [],
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    question?: unknown;
    viewer?: unknown;
    auto?: unknown;
  } | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const viewer = typeof body?.viewer === "string" ? body.viewer : null;
  const auto = body?.auto === true;

  const insights = getInsights(getSession());

  if (auto || /what('| i)?s (going on|happening)|catch me up|did i miss/i.test(question)) {
    return NextResponse.json(catchup(insights, auto ? viewer : null));
  }
  if (/who('| i)?s? (is )?(this|the streamer|he|that)|about the streamer/i.test(question)) {
    return NextResponse.json(streamerPrimer(insights));
  }
  if (/why.*(spam|emote)|what.*(emote|kekw|hyperclap)/i.test(question)) {
    return NextResponse.json(emoteExplainer(insights));
  }
  if (question.length > 0 && (question.includes("?") || /^(what|when|who|how|why|where|can|do|does|is|are)/i.test(question))) {
    return NextResponse.json(recallOrFlag(insights, question));
  }
  return NextResponse.json(fallback());
}
