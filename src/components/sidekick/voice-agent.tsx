"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ConversationProvider,
  useConversationControls,
  useConversationStatus,
  useConversationMode,
} from "@elevenlabs/react";
import {
  Eye,
  Flame,
  MessageCircleQuestion,
  RefreshCcw,
  UserPlus,
  X,
} from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { VOICE_PRESET } from "@/lib/sidekick/voice-preset";
import { cn } from "@/lib/utils";

import { useVoiceChatFeed, VoiceChatOverlay } from "./voice-chat-column";

const AGENT_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

const AVATAR = `https://api.dicebear.com/9.x/thumbs/svg?seed=${VOICE_PRESET.streamer}`;

interface TranscriptLine {
  id: string;
  role: "user" | "ai";
  text: string;
}

function Waveform({ active }: { active: boolean }) {
  return (
    <span className="flex h-5 items-center gap-[3px]">
      {[0, 1, 2, 3, 4].map((bar) => (
        <span
          key={bar}
          className={cn(
            "w-[4px] rounded-full bg-primary transition-all",
            active ? "sidekick-wave-bar h-5" : "h-1.5 opacity-40",
          )}
          style={{ animationDelay: `${bar * 0.12}s` }}
        />
      ))}
    </span>
  );
}

/** Kick's blocky pixel-K mark, drawn inline (kick.com blocks asset hotlinks). */
function KickLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-label="Kick" role="img">
      <g fill="currentColor">
        <rect x="2" y="2" width="8" height="24" />
        <rect x="10" y="10" width="4" height="8" />
        <rect x="14" y="6" width="4" height="4" />
        <rect x="14" y="18" width="4" height="4" />
        <rect x="18" y="2" width="8" height="8" />
        <rect x="18" y="18" width="8" height="8" />
      </g>
    </svg>
  );
}

/** Keys accepted as the push-to-talk trigger. Fn is invisible to browsers on
 * macOS, so left Control (the key directly above Fn) is the practical bind;
 * "Fn" is honored in case a browser ever reports it. */
function isPttKey(event: KeyboardEvent): boolean {
  return event.code === "ControlLeft" || event.key === "Fn";
}

/**
 * Wispr Flow-style push-to-talk HUD: invisible when idle. Hold the trigger
 * key to open the session and show the pill; on release the mic turn ends,
 * and the pill stays up just long enough for Sidekick to finish answering.
 */
function WhisprPill({ transcript }: { transcript: TranscriptLine[] }) {
  const { startSession, endSession } = useConversationControls();
  const { status } = useConversationStatus();
  const { isSpeaking } = useConversationMode();
  const [held, setHeld] = useState(false);
  const [haptic, setHaptic] = useState(false);

  const connected = status === "connected";
  const visible = held || connected;
  const lastAi = [...transcript].reverse().find((line) => line.role === "ai");

  const pulseHaptic = () => {
    setHaptic(true);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(30);
    }
    setTimeout(() => setHaptic(false), 320);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPttKey(event) || event.repeat) return;
      event.preventDefault();
      setHeld(true);
      pulseHaptic();
      if (!connected) {
        if (!AGENT_ID) {
          console.warn("NEXT_PUBLIC_ELEVENLABS_AGENT_ID is not set");
          return;
        }
        void startSession({ agentId: AGENT_ID });
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!isPttKey(event)) return;
      setHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [connected, startSession]);

  // After release: let Sidekick finish speaking, then close the session.
  // Grace is long while we still await the answer, short once it has landed.
  useEffect(() => {
    if (held || !connected || isSpeaking) return;
    const grace = lastAi ? 1_500 : 8_000;
    const timer = setTimeout(() => void endSession(), grace);
    return () => clearTimeout(timer);
  }, [held, connected, isSpeaking, lastAi, endSession]);

  if (!visible) return null;

  const label = !connected ? "Connecting…" : isSpeaking ? "Speaking…" : "Listening";

  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 z-30 flex justify-center">
      <div className={cn("pointer-events-auto relative", haptic && "sidekick-haptic")}>
        <div className="flex items-center gap-3 rounded-full bg-black/90 py-2.5 pl-3.5 pr-4 shadow-2xl shadow-black/70 backdrop-blur">
          <KickLogo
            className={cn(
              "size-5 text-primary transition-transform",
              isSpeaking && "animate-pulse",
            )}
          />
          <span className="text-sm font-semibold text-white">{label}</span>
          <Waveform active={connected} />
        </div>
        <button
          type="button"
          onClick={() => void endSession()}
          className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur hover:bg-white/40"
          aria-label="End voice session"
        >
          <X className="size-3" />
        </button>
      </div>
    </div>
  );
}

/**
 * Live IRL camera feed from the device's front-facing camera, with the
 * night-market gradient as fallback while permission is pending or denied.
 */
function CameraFeed() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = mediaStream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = mediaStream;
          void video.play();
          setLive(true);
        }
      })
      .catch(() => setLive(false));

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_15%,rgba(252,182,69,0.25),transparent_45%),radial-gradient(circle_at_20%_80%,rgba(197,114,253,0.18),transparent_50%),linear-gradient(170deg,#1a1210_0%,#241a12_45%,#120d0f_100%)]">
      <video
        ref={videoRef}
        muted
        playsInline
        className={cn(
          "absolute inset-0 size-full scale-x-[-1] object-cover transition-opacity duration-500",
          live ? "opacity-100" : "opacity-0",
        )}
      />
      {!live && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pb-40">
          <span className="text-4xl font-black uppercase tracking-tight text-white/10">
            {VOICE_PRESET.streamer}
          </span>
          <span className="text-xs text-white/25">
            [ camera feed — {VOICE_PRESET.location} ]
          </span>
        </div>
      )}
    </div>
  );
}

function DemoTriggers() {
  const trigger = (payload: Record<string, unknown>) =>
    void apiClient.post("/demo/trigger", payload);
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        title="Hype spike"
        onClick={() => trigger({ action: "hype" })}
        className="rounded-full bg-black/30 p-1.5 text-white/40 hover:text-orange-400"
      >
        <Flame className="size-3.5" />
      </button>
      <button
        type="button"
        title="Question flood"
        onClick={() => trigger({ action: "question_flood", topic: "schedule" })}
        className="rounded-full bg-black/30 p-1.5 text-white/40 hover:text-sky-400"
      >
        <MessageCircleQuestion className="size-3.5" />
      </button>
      <button
        type="button"
        title="New viewer"
        onClick={() => trigger({ action: "new_viewer" })}
        className="rounded-full bg-black/30 p-1.5 text-white/40 hover:text-primary"
      >
        <UserPlus className="size-3.5" />
      </button>
    </div>
  );
}

export function VoiceAgent() {
  const events = useVoiceChatFeed();
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);

  const clientTools = useMemo(() => {
    const tool = (name: string, path: string, onCall?: () => void) => async () => {
      onCall?.();
      const { data } = await apiClient.get<unknown>(path);
      return JSON.stringify(data);
    };
    return {
      get_chat_vibe: tool("get_chat_vibe", "/insights/vibe"),
      get_recent_questions: tool("get_recent_questions", "/insights/questions", () => {
        // Surface the "streamer consulted chat" moment to viewers (debounced server-side).
        void apiClient.post("/voice/briefed");
      }),
      get_trending: tool("get_trending", "/insights/trending"),
      get_new_chatters: tool("get_new_chatters", "/insights/chatters"),
      get_stream_context: tool("get_stream_context", "/insights/context"),
    };
  }, []);

  return (
    <ConversationProvider
      clientTools={clientTools}
      onMessage={({ message, source }) => {
        setTranscript((current) => [
          ...current.slice(-20),
          { id: crypto.randomUUID(), role: source === "ai" ? "ai" : "user", text: message },
        ]);
      }}
    >
      {/* Letterboxed phone viewport on desktop; full screen on a real phone */}
      <div className="flex h-screen items-center justify-center bg-neutral-950">
        <div className="relative h-full max-h-[900px] w-full max-w-[420px] overflow-hidden bg-black sm:rounded-[36px] sm:border sm:border-neutral-800 sm:shadow-[0_0_80px_rgba(0,0,0,0.9)]">
          <CameraFeed />

          {/* top chrome */}
          <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3 pt-4">
            <div className="flex items-center gap-2 rounded-full bg-black/40 py-1 pl-1 pr-3 backdrop-blur">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={AVATAR}
                alt={VOICE_PRESET.streamer}
                className="size-7 rounded-full border border-primary"
              />
              <div className="leading-tight">
                <p className="text-[11px] font-bold text-white">{VOICE_PRESET.streamer}</p>
                <p className="max-w-40 truncate text-[9px] text-white/60">{VOICE_PRESET.title}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-destructive px-1.5 py-0.5 text-[9px] font-black text-white">
                  LIVE
                </span>
                <span className="flex items-center gap-1 rounded bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur">
                  <Eye className="size-2.5" /> {VOICE_PRESET.viewers.toLocaleString()}
                </span>
              </div>
              <DemoTriggers />
            </div>
          </div>

          {/* camera flip affordance, sells the phone POV */}
          <button
            type="button"
            className="absolute right-3 top-1/2 z-10 rounded-full bg-black/30 p-2 text-white/40"
            title="Flip camera (mock)"
          >
            <RefreshCcw className="size-4" />
          </button>

          <VoiceChatOverlay events={events} />
          <WhisprPill transcript={transcript} />
        </div>
      </div>
    </ConversationProvider>
  );
}
