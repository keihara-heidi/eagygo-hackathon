CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE TYPE "public"."stream_status" AS ENUM('scheduled', 'live', 'ended');--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kick_channel_id" text NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stream_id" uuid NOT NULL,
	"chatter_id" uuid NOT NULL,
	"kick_message_id" text,
	"content" text NOT NULL,
	"message_type" text DEFAULT 'chat' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kick_user_id" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stream_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stream_id" uuid NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"viewer_count" integer DEFAULT 0 NOT NULL,
	"chat_message_count" integer DEFAULT 0 NOT NULL,
	"unique_chatter_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"kick_livestream_id" text,
	"title" text NOT NULL,
	"category" text,
	"status" "stream_status" DEFAULT 'scheduled' NOT NULL,
	"viewer_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chatter_id_chatters_id_fk" FOREIGN KEY ("chatter_id") REFERENCES "public"."chatters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_snapshots" ADD CONSTRAINT "stream_snapshots_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streams" ADD CONSTRAINT "streams_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channels_kick_channel_id_idx" ON "channels" USING btree ("kick_channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channels_slug_idx" ON "channels" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_kick_message_id_idx" ON "chat_messages" USING btree ("kick_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chatters_kick_user_id_idx" ON "chatters" USING btree ("kick_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chatters_username_idx" ON "chatters" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "streams_kick_livestream_id_idx" ON "streams" USING btree ("kick_livestream_id");