import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const streamStatus = pgEnum("stream_status", [
  "scheduled",
  "live",
  "ended",
]);

export const channels = pgTable(
  "channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kickChannelId: text("kick_channel_id").notNull(),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("channels_kick_channel_id_idx").on(table.kickChannelId),
    uniqueIndex("channels_slug_idx").on(table.slug),
  ],
);

export const streams = pgTable(
  "streams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    kickLivestreamId: text("kick_livestream_id"),
    title: text("title").notNull(),
    category: text("category"),
    status: streamStatus("status").notNull().default("scheduled"),
    viewerCount: integer("viewer_count").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("streams_kick_livestream_id_idx").on(table.kickLivestreamId)],
);

export const chatters = pgTable(
  "chatters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kickUserId: text("kick_user_id").notNull(),
    username: text("username").notNull(),
    displayName: text("display_name"),
    isVerified: boolean("is_verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("chatters_kick_user_id_idx").on(table.kickUserId),
    uniqueIndex("chatters_username_idx").on(table.username),
  ],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    streamId: uuid("stream_id")
      .notNull()
      .references(() => streams.id, { onDelete: "cascade" }),
    chatterId: uuid("chatter_id")
      .notNull()
      .references(() => chatters.id, { onDelete: "cascade" }),
    kickMessageId: text("kick_message_id"),
    content: text("content").notNull(),
    messageType: text("message_type").notNull().default("chat"),
    metadata: jsonb("metadata").notNull().default({}),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("chat_messages_kick_message_id_idx").on(table.kickMessageId)],
);

export const streamSnapshots = pgTable("stream_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  streamId: uuid("stream_id")
    .notNull()
    .references(() => streams.id, { onDelete: "cascade" }),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  viewerCount: integer("viewer_count").notNull().default(0),
  chatMessageCount: integer("chat_message_count").notNull().default(0),
  uniqueChatterCount: integer("unique_chatter_count").notNull().default(0),
});

export const channelRelations = relations(channels, ({ many }) => ({
  streams: many(streams),
}));

export const streamRelations = relations(streams, ({ one, many }) => ({
  channel: one(channels, {
    fields: [streams.channelId],
    references: [channels.id],
  }),
  messages: many(chatMessages),
  snapshots: many(streamSnapshots),
}));

export const chatterRelations = relations(chatters, ({ many }) => ({
  messages: many(chatMessages),
}));

export const chatMessageRelations = relations(chatMessages, ({ one }) => ({
  stream: one(streams, {
    fields: [chatMessages.streamId],
    references: [streams.id],
  }),
  chatter: one(chatters, {
    fields: [chatMessages.chatterId],
    references: [chatters.id],
  }),
}));

export const streamSnapshotRelations = relations(streamSnapshots, ({ one }) => ({
  stream: one(streams, {
    fields: [streamSnapshots.streamId],
    references: [streams.id],
  }),
}));
