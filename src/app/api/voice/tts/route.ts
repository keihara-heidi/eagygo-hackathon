import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // George — clear, energetic
const MODEL_ID = "eleven_flash_v2_5"; // fastest first-byte latency

/** Text-to-speech for the voice pipeline: answer text in, MP3 audio out. */
export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 1_000) {
    return NextResponse.json(
      { error: "text must be a non-empty string of at most 1000 chars" },
      { status: 400 },
    );
  }

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream?output_format=mp3_22050_32`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: MODEL_ID }),
    },
  );

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: `TTS failed (${upstream.status})`, detail: detail.slice(0, 200) },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}
