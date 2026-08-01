import type { ReactNode } from "react";

import type { KickEmote } from "@/lib/kick/types";

interface KickChatContentProps {
  content: string;
  emotes?: readonly KickEmote[];
  imageClassName?: string;
}

interface PositionedEmote {
  id: string;
  start: number;
  end: number;
}

const INLINE_EMOTE_PATTERN = /(\[emote:\d+:[^\]]+\])/g;
const INLINE_EMOTE_TOKEN = /\[emote:\d+:[^\]]+\]/;
const INLINE_EMOTE_EXACT = /^\[emote:(\d+):([^\]]+)\]$/;

function emoteUrl(id: string) {
  return `https://files.kick.com/emotes/${id}/fullsize`;
}

function EmoteImage({ alt, className, id }: { alt: string; className: string; id: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className={`mx-0.5 inline-block object-contain align-middle ${className}`}
      src={emoteUrl(id)}
    />
  );
}

function positionedEmotes(emotes: readonly KickEmote[] | undefined): PositionedEmote[] {
  return (emotes ?? [])
    .flatMap((emote) =>
      emote.positions.map((position) => ({
        id: emote.emote_id,
        start: position.s,
        end: position.e,
      })),
    )
    .sort((a, b) => a.start - b.start);
}

export function kickContentToPlainText(content: string) {
  return content.replace(/\[emote:[^:\]]+:([^\]]+)\]/g, ":$1:").trim();
}

export function KickChatContent({
  content,
  emotes,
  imageClassName = "h-7 max-w-20",
}: KickChatContentProps) {
  if (INLINE_EMOTE_TOKEN.test(content)) {
    return content.split(INLINE_EMOTE_PATTERN).map((part, index) => {
      const match = INLINE_EMOTE_EXACT.exec(part);
      if (!match) return <span key={index}>{part}</span>;

      return (
        <EmoteImage
          key={index}
          alt={match[2]}
          className={imageClassName}
          id={match[1]}
        />
      );
    });
  }

  const positions = positionedEmotes(emotes);
  if (positions.length === 0) return <span>{content}</span>;

  const parts: ReactNode[] = [];
  let cursor = 0;
  positions.forEach((emote, index) => {
    if (emote.start < cursor) return;
    if (emote.start > cursor) {
      parts.push(<span key={`text-${index}`}>{content.slice(cursor, emote.start)}</span>);
    }

    const label = content.slice(emote.start, emote.end + 1) || emote.id;
    parts.push(
      <EmoteImage
        key={`emote-${index}`}
        alt={label}
        className={imageClassName}
        id={emote.id}
      />,
    );
    cursor = emote.end + 1;
  });

  if (cursor < content.length) parts.push(<span key="text-end">{content.slice(cursor)}</span>);
  return parts;
}
