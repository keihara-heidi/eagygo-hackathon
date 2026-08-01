/**
 * Fire-and-forget persistence of session events into the Drizzle schema.
 * Never on the demo path: failures are logged once and swallowed, and nothing
 * awaits these writes. Skipped entirely when DATABASE_URL is unset.
 */

import { STREAMER, STREAM_INFO } from "@/lib/chat-engine/cast";
import type { ChatEngine, StampedEvent } from "@/lib/chat-engine";

type Db = typeof import("@/db/client").db;
type Schema = typeof import("@/db/schema");

interface SinkState {
  dbPromise: Promise<{ db: Db; schema: Schema } | null> | null;
  streamRowId: string | null;
  chatterIds: Map<string, string>;
  queue: Promise<void>;
  warned: boolean;
}

const state: SinkState = {
  dbPromise: null,
  streamRowId: null,
  chatterIds: new Map(),
  queue: Promise.resolve(),
  warned: false,
};

async function loadDb() {
  if (!process.env.DATABASE_URL) return null;
  if (!state.dbPromise) {
    state.dbPromise = Promise.all([import("@/db/client"), import("@/db/schema")])
      .then(([client, schema]) => ({ db: client.db, schema }))
      .catch((error) => {
        warnOnce("DB unavailable, persistence disabled", error);
        return null;
      });
  }
  return state.dbPromise;
}

function warnOnce(message: string, error: unknown) {
  if (state.warned) return;
  state.warned = true;
  console.warn(`[sidekick db-sink] ${message}:`, error);
}

async function ensureStreamRow(db: Db, schema: Schema, engine: ChatEngine) {
  if (state.streamRowId) return state.streamRowId;

  const [channel] = await db
    .insert(schema.channels)
    .values({
      kickChannelId: String(STREAMER.user_id),
      slug: STREAMER.channel_slug,
      displayName: STREAMER.username,
      avatarUrl: STREAMER.profile_picture,
    })
    .onConflictDoUpdate({
      target: schema.channels.kickChannelId,
      set: { updatedAt: new Date() },
    })
    .returning({ id: schema.channels.id });
  if (!channel) throw new Error("channel upsert returned no row");

  const [stream] = await db
    .insert(schema.streams)
    .values({
      channelId: channel.id,
      kickLivestreamId: STREAM_INFO.livestream_id,
      title: STREAM_INFO.title,
      category: STREAM_INFO.category.name,
      status: "live",
      viewerCount: STREAM_INFO.viewer_count,
      startedAt: new Date(engine.getStreamContext().started_at),
    })
    .onConflictDoUpdate({
      target: schema.streams.kickLivestreamId,
      set: { updatedAt: new Date() },
    })
    .returning({ id: schema.streams.id });
  if (!stream) throw new Error("stream upsert returned no row");

  state.streamRowId = stream.id;
  return stream.id;
}

async function ensureChatter(
  db: Db,
  schema: Schema,
  user: { user_id: number; username: string; is_verified: boolean },
) {
  const key = String(user.user_id);
  const cached = state.chatterIds.get(key);
  if (cached) return cached;

  const [chatter] = await db
    .insert(schema.chatters)
    .values({
      kickUserId: key,
      username: user.username,
      displayName: user.username,
      isVerified: user.is_verified,
    })
    .onConflictDoUpdate({
      target: schema.chatters.kickUserId,
      set: { updatedAt: new Date() },
    })
    .returning({ id: schema.chatters.id });
  if (!chatter) throw new Error("chatter upsert returned no row");

  state.chatterIds.set(key, chatter.id);
  return chatter.id;
}

async function writeEvent(engine: ChatEngine, stamped: StampedEvent) {
  const loaded = await loadDb();
  if (!loaded) return;
  const { db, schema } = loaded;
  const { event } = stamped;
  if (event.type !== "chat.message.sent") return;

  const streamId = await ensureStreamRow(db, schema, engine);
  const chatterId = await ensureChatter(db, schema, event.payload.sender);
  await db
    .insert(schema.chatMessages)
    .values({
      streamId,
      chatterId,
      kickMessageId: event.payload.message_id,
      content: event.payload.content,
      messageType: "chat",
      metadata: { emotes: event.payload.emotes },
      sentAt: new Date(event.payload.created_at),
    })
    .onConflictDoNothing();
}

/** Enqueue an event for persistence. Serialized, non-blocking, best-effort. */
export function persistEvent(engine: ChatEngine, stamped: StampedEvent) {
  state.queue = state.queue
    .then(() => writeEvent(engine, stamped))
    .catch((error) => warnOnce("write failed, persistence degraded", error));
}
