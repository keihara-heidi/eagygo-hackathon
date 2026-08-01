import { NextResponse } from "next/server";

import { isSpeakableWord, maskSpeech } from "@/lib/sidekick/clean-speech";
import { getSidekickRuntime } from "@/lib/sidekick/runtime";
import type { InsightEngine } from "@/lib/sidekick/insights";
import { postVoiceBriefing } from "@/lib/sidekick/voice-briefing";

export const dynamic = "force-dynamic";

/**
 * The single Sidekick brain. Routes a question to an intent, gathers data
 * from the insight engine, and reports the tool calls it made. Serves both
 * audiences: viewers (copilot widget) and the streamer (voice pipeline sends
 * `audience: "streamer"`, which unlocks streamer intents and speech-friendly
 * answers).
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
      answer: `Good news — OrbitFPS covered this ${minutesAgo(answered.answered_at ?? answered.last_asked_at)}: ${answered.answer}`,
      tool_calls: [
        {
          tool: "get_answered_questions",
          request: "GET /api/insights/answered",
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

// ---------------------------------------------------------------------------
// Streamer (voice) intents — short, speech-friendly answers
// ---------------------------------------------------------------------------

/** Qualitative mood line — no statistics, suitable for spoken answers. */
function moodLine(vibe: ReturnType<InsightEngine["vibe"]>): string {
  switch (vibe.vibe) {
    case "hype":
      return "The mood is electric — chat is absolutely buzzing.";
    case "tilted":
      return "The mood is a bit salty right now.";
    case "dead":
      return "Chat is pretty quiet at the moment.";
    default:
      return "The mood is relaxed and steady.";
  }
}

function streamerVibe(insights: InsightEngine): CopilotResponse {
  const vibe = insights.vibe();
  return {
    intent: "streamer_vibe",
    answer: moodLine(vibe),
    tool_calls: [
      {
        tool: "get_chat_vibe",
        request: "GET /api/insights/vibe",
        summary: `${vibe.vibe} · ${vibe.messages_per_minute} msg/min`,
      },
    ],
  };
}

/** "What's chat talking about?" — topics and collective emotion, zero stats. */
function streamerTopics(insights: InsightEngine): CopilotResponse {
  const vibe = insights.vibe();
  const trending = insights.trending();
  const words = trending.words
    .map((entry) => entry.word)
    .filter((word) => word.length >= 3 && isSpeakableWord(word))
    .slice(0, 3);
  // Real chat carries emotes we only know by numeric id — don't speak those.
  const topEmote = trending.emotes.find((emote) => !/^\d+$/.test(emote.name));

  const parts: string[] = [];
  if (words.length > 0) {
    parts.push(
      words.length === 1
        ? `Chat's mostly on about ${words[0]}.`
        : `Chat's mostly on about ${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}.`,
    );
  } else {
    parts.push("No single topic dominating — just general chatter.");
  }
  if (topEmote) parts.push(`${topEmote.name} is the emote of the moment.`);
  parts.push(moodLine(vibe));

  return {
    intent: "streamer_topics",
    answer: parts.join(" "),
    tool_calls: [
      {
        tool: "get_trending",
        request: "GET /api/insights/trending",
        summary: words.length > 0 ? `topics: ${words.join(", ")}` : "no dominant topic",
      },
      {
        tool: "get_chat_vibe",
        request: "GET /api/insights/vibe",
        summary: vibe.vibe,
      },
    ],
  };
}

function streamerQuestions(insights: InsightEngine): CopilotResponse {
  const pending = insights.questions().filter((cluster) => !cluster.answered);
  const top = pending[0];
  // Fire the viewer-visible 🎙 chat line; never block the spoken answer on it.
  void postVoiceBriefing().catch(() => {});
  const answer = top
    ? `Yes — ${pending.length === 1 ? "one big one" : `${pending.length} clusters`}. Most asked: ${maskSpeech(top.representative)} — ${top.count} people want to know. I've flagged it in chat; say answered when you've covered it.`
    : "Nothing pressing — no repeated questions in the queue right now.";
  return {
    intent: "streamer_questions",
    answer,
    tool_calls: [
      {
        tool: "get_recent_questions",
        request: "GET /api/insights/questions",
        summary: top ? `${pending.length} pending · top asked ${top.count}x` : "queue empty",
      },
    ],
  };
}

function streamerWhoIsNew(insights: InsightEngine): CopilotResponse {
  const chatters = insights.chatters();
  const parts: string[] = [];
  parts.push(`${chatters.active_last_10m} people chatting in the last ten minutes.`);
  const speakableFirstTimers = chatters.first_timers.filter(isSpeakableWord);
  if (speakableFirstTimers.length > 0) {
    parts.push(
      `First-timers: ${speakableFirstTimers.slice(0, 3).join(", ")}${speakableFirstTimers.length > 3 ? ` and ${speakableFirstTimers.length - 3} more` : ""} — worth a shoutout.`,
    );
  }
  if (chatters.recent_followers.length > 0) {
    parts.push(`${chatters.recent_followers.length} new followers recently.`);
  }
  const lastNotable = chatters.notable[chatters.notable.length - 1];
  if (lastNotable) parts.push(maskSpeech(lastNotable) + ".");
  return {
    intent: "streamer_whos_new",
    answer: parts.join(" "),
    tool_calls: [
      {
        tool: "get_new_chatters",
        request: "GET /api/insights/chatters",
        summary: `${chatters.active_last_10m} active · ${chatters.first_timers.length} first-timers`,
      },
    ],
  };
}

function streamerRecap(insights: InsightEngine): CopilotResponse {
  const vibe = insights.vibe();
  const trending = insights.trending();
  const pending = insights.questions().filter((cluster) => !cluster.answered);
  const top = pending[0];
  const chatters = insights.chatters();

  const words = trending.words
    .map((entry) => entry.word)
    .filter((word) => word.length >= 3 && isSpeakableWord(word))
    .slice(0, 3);

  const parts: string[] = [moodLine(vibe)];
  parts.push(
    words.length > 0
      ? `Chat's mostly on about ${words.length === 1 ? words[0] : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`}.`
      : "No single topic dominating — just general chatter.",
  );
  parts.push(
    top
      ? `${pending.length === 1 ? "One question cluster" : `${pending.length} question clusters`} waiting — most asked: ${maskSpeech(top.representative)} (${top.count}x). Say answered once you've covered it.`
      : "No pending questions — the queue is clear.",
  );
  const speakableFirstTimers = chatters.first_timers.filter(isSpeakableWord);
  if (speakableFirstTimers.length > 0) {
    parts.push(
      `First-timers worth a shoutout: ${speakableFirstTimers.slice(0, 3).join(", ")}.`,
    );
  }
  const lastNotable = chatters.notable[chatters.notable.length - 1];
  if (lastNotable) parts.push(maskSpeech(lastNotable) + ".");

  return {
    intent: "streamer_recap",
    answer: parts.join(" "),
    tool_calls: [
      {
        tool: "get_chat_vibe",
        request: "GET /api/insights/vibe",
        summary: `${vibe.vibe} · ${vibe.messages_per_minute} msg/min`,
      },
      {
        tool: "get_trending",
        request: "GET /api/insights/trending",
        summary: words.length > 0 ? `topics: ${words.join(", ")}` : "no dominant topic",
      },
      {
        tool: "get_recent_questions",
        request: "GET /api/insights/questions",
        summary: top ? `${pending.length} pending · top asked ${top.count}x` : "queue empty",
      },
      {
        tool: "get_new_chatters",
        request: "GET /api/insights/chatters",
        summary: `${chatters.active_last_10m} active · ${chatters.first_timers.length} first-timers`,
      },
    ],
  };
}

function streamerFallback(): CopilotResponse {
  return {
    intent: "help",
    answer:
      "I can tell you the chat vibe, what's trending, questions worth answering, or who's new. What do you want?",
    tool_calls: [],
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
    audience?: unknown;
  } | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const viewer = typeof body?.viewer === "string" ? body.viewer : null;
  const auto = body?.auto === true;
  const audience = body?.audience === "streamer" ? "streamer" : "viewer";

  const insights = getSidekickRuntime().insights;

  if (audience === "streamer") {
    if (/recap|catch (me )?up|what did i miss|summar|brief me|fill me in/i.test(question)) {
      return NextResponse.json(streamerRecap(insights));
    }
    if (/question|should i answer|what.*want to know|asking|queue/i.test(question)) {
      return NextResponse.json(streamerQuestions(insights));
    }
    if (/talking about|saying|topic|trending|going on|happening|on about/i.test(question)) {
      return NextResponse.json(streamerTopics(insights));
    }
    if (/vibe|mood|feeling|energy|how('| i)?s chat/i.test(question)) {
      return NextResponse.json(streamerVibe(insights));
    }
    if (/who('| i)?s new|new (viewer|chatter|follower)|who (joined|showed|came)/i.test(question)) {
      return NextResponse.json(streamerWhoIsNew(insights));
    }
    return NextResponse.json(question.length > 3 ? streamerTopics(insights) : streamerFallback());
  }

  if (auto || /what('| i)?s (going on|happening)|catch me up|did i miss|recap|summar/i.test(question)) {
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
