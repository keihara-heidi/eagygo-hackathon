"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Eye,
  Flame,
  MessageCircleQuestion,
  RadioTower,
  RefreshCcw,
  UserPlus,
} from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { VOICE_PRESET } from "@/lib/sidekick/voice-preset";
import { cn } from "@/lib/utils";

import { useRealKickChat } from "./use-real-kick-chat";
import { useVoiceChatFeed, VoiceChatOverlay } from "./voice-chat-column";

const AVATAR = `https://api.dicebear.com/9.x/thumbs/svg?seed=${VOICE_PRESET.streamer}`;

// ---------------------------------------------------------------------------
// Minimal Web Speech API typings (Chrome's webkit-prefixed implementation)
// ---------------------------------------------------------------------------

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

function createRecognition(): SpeechRecognitionLike | null {
  const w = window as typeof window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

// ---------------------------------------------------------------------------
// One-brain voice pipeline: hold key → STT → /copilot/ask → TTS → audio out
// ---------------------------------------------------------------------------

type Phase = "idle" | "listening" | "thinking" | "speaking";

/** Fn is invisible to browsers on macOS, so left Control (the key directly
 * above Fn) is the practical bind; "Fn" is honored if ever reported. */
function isPttKey(event: KeyboardEvent): boolean {
  return event.code === "ControlLeft" || event.key === "Fn";
}

function useVoicePipeline() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [haptic, setHaptic] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const heldRef = useRef(false);

  const reset = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    transcriptRef.current = "";
    setPhase("idle");
  }, []);

  const pulseHaptic = () => {
    setHaptic(true);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(30);
    }
    setTimeout(() => setHaptic(false), 320);
  };

  const beginListening = useCallback(() => {
    const recognition = createRecognition();
    if (!recognition) {
      console.warn("SpeechRecognition unavailable in this browser");
      return;
    }
    transcriptRef.current = "";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result) text += result[0].transcript;
      }
      transcriptRef.current = text;
    };
    recognition.onerror = () => {};
    recognition.start();
    recognitionRef.current = recognition;
    setPhase("listening");
  }, []);

  const submit = useCallback(async () => {
    recognitionRef.current?.stop();
    // Give the recognizer a beat to flush its final result.
    await new Promise((resolve) => setTimeout(resolve, 350));
    recognitionRef.current = null;

    const question = transcriptRef.current.trim();
    transcriptRef.current = "";
    if (!question) {
      setPhase("idle");
      return;
    }

    setPhase("thinking");
    try {
      const { data } = await apiClient.post<{ answer: string }>("/copilot/ask", {
        question,
        audience: "streamer",
      });

      const ttsResponse = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: data.answer }),
      });
      if (!ttsResponse.ok) throw new Error(`TTS ${ttsResponse.status}`);
      const blob = await ttsResponse.blob();

      const audio = new Audio(URL.createObjectURL(blob));
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(audio.src);
        audioRef.current = null;
        setPhase("idle");
      };
      setPhase("speaking");
      await audio.play();
    } catch (error) {
      console.warn("voice pipeline failed:", error);
      setPhase("idle");
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        reset();
        return;
      }
      if (!isPttKey(event) || event.repeat || heldRef.current) return;
      event.preventDefault();
      heldRef.current = true;
      pulseHaptic();
      // Interrupt any playing answer and start a fresh turn.
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      beginListening();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!isPttKey(event) || !heldRef.current) return;
      heldRef.current = false;
      void submit();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [beginListening, submit, reset]);

  return { phase, haptic };
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

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

/**
 * Siri-style state indicator: whole-screen edge glow (breathing while
 * listening/thinking, fast pulse while speaking) plus a floating pixel-K.
 * No pill, no text — answers are voice-only.
 */
function VoiceGlow({ phase, haptic }: { phase: Phase; haptic: boolean }) {
  if (phase === "idle") return null;
  const speaking = phase === "speaking";
  return (
    <>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-30 sm:rounded-[36px]",
          "sidekick-glow",
          speaking ? "sidekick-glow-speaking" : "sidekick-glow-listening",
          haptic && "sidekick-haptic",
        )}
      />
      <div className="pointer-events-none absolute inset-x-0 top-16 z-30 flex justify-center">
        <KickLogo
          className={cn(
            "size-7 text-primary drop-shadow-[0_0_12px_rgba(83,252,24,0.8)]",
            speaking ? "animate-pulse" : "sidekick-glow-listening",
          )}
        />
      </div>
    </>
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
  const trigger = (scenario: string) =>
    void apiClient.post("/demo", { action: "trigger", scenario });
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        title="Hype spike"
        onClick={() => trigger("hype_spike")}
        className="rounded-full bg-black/30 p-1.5 text-white/40 hover:text-orange-400"
      >
        <Flame className="size-3.5" />
      </button>
      <button
        type="button"
        title="Question flood"
        onClick={() => trigger("question_flood")}
        className="rounded-full bg-black/30 p-1.5 text-white/40 hover:text-sky-400"
      >
        <MessageCircleQuestion className="size-3.5" />
      </button>
      <button
        type="button"
        title="New viewer"
        onClick={() => trigger("new_viewer")}
        className="rounded-full bg-black/30 p-1.5 text-white/40 hover:text-primary"
      >
        <UserPlus className="size-3.5" />
      </button>
    </div>
  );
}

export function VoiceAgent() {
  const events = useVoiceChatFeed();
  const { phase, haptic } = useVoicePipeline();
  const realChat = useRealKickChat();

  // Auto-connect to a real channel via ?chatroom=<id>&channel=<slug>.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chatroom = params.get("chatroom");
    if (chatroom) realChat.connect(chatroom, params.get("channel") ?? "kick");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleRealChat = () => {
    if (realChat.status === "live" || realChat.status === "connecting") {
      realChat.disconnect();
      return;
    }
    const chatroom = window.prompt(
      "Kick chatroom ID (open kick.com/api/v2/channels/<name> in a tab → chatroom.id)",
      "18490228", // kaneljoseph
    );
    if (!chatroom?.trim()) return;
    const channelLabel =
      window.prompt("Channel name (for display)", "kaneljoseph") ?? "kick";
    realChat.connect(chatroom.trim(), channelLabel);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-neutral-950">
      {/* Letterboxed phone viewport on desktop; full screen on a real phone */}
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
              <p className="max-w-40 truncate text-[9px] text-white/60">
                {realChat.status === "live"
                  ? `real chat · ${realChat.channel}`
                  : VOICE_PRESET.title}
              </p>
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
            <div className="flex items-center gap-1">
              <button
                type="button"
                title={
                  realChat.status === "live"
                    ? `Streaming real chat from ${realChat.channel} — click to fall back to mock`
                    : "Connect a real Kick channel's chat"
                }
                onClick={toggleRealChat}
                className={cn(
                  "rounded-full bg-black/30 p-1.5 transition-colors",
                  realChat.status === "live" && "text-primary",
                  realChat.status === "connecting" && "animate-pulse text-amber-400",
                  realChat.status === "failed" && "text-destructive",
                  realChat.status === "off" && "text-white/40 hover:text-white",
                )}
              >
                <RadioTower className="size-3.5" />
              </button>
              <DemoTriggers />
            </div>
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
        <VoiceGlow phase={phase} haptic={haptic} />
      </div>
    </div>
  );
}
