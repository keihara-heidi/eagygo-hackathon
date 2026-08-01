/**
 * Domain models for the KICK Public API.
 *
 * Field names mirror https://docs.kick.com verbatim (snake_case) so that mock
 * data built against these types is faithful to the real payloads — a hard
 * requirement of the hackathon brief.
 */

// ---------------------------------------------------------------------------
// Shared user shapes
// ---------------------------------------------------------------------------

export interface KickBadge {
  text: string;
  type: string;
  count?: number;
}

export interface KickIdentity {
  username_color: string;
  badges: KickBadge[];
}

/** User shape carried by webhook payloads that omit anonymity/identity. */
export interface KickWebhookUser {
  user_id: number;
  username: string;
  is_verified: boolean;
  profile_picture: string;
  channel_slug: string;
}

/** Full user shape carried by chat-style webhook payloads. */
export interface KickUser extends KickWebhookUser {
  is_anonymous: boolean;
  identity: KickIdentity | null;
}

// ---------------------------------------------------------------------------
// Emotes (chat.message.sent carries these pre-parsed)
// ---------------------------------------------------------------------------

export interface KickEmotePosition {
  s: number;
  e: number;
}

export interface KickEmote {
  emote_id: string;
  positions: KickEmotePosition[];
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export interface KickCategory {
  id: number;
  name: string;
  thumbnail: string;
}

export interface KickChannelStream {
  custom_tags: string[];
  is_live: boolean;
  is_mature: boolean;
  key: string;
  language: string;
  start_time: string;
  thumbnail: string;
  url: string;
  viewer_count: number;
}

export interface KickChannel {
  active_subscribers_count: number;
  banner_picture: string;
  broadcaster_user_id: number;
  canceled_subscribers_count: number;
  category: KickCategory;
  channel_description: string;
  slug: string;
  stream: KickChannelStream;
  stream_title: string;
}

export interface PatchChannelsParams {
  category_id?: number;
  custom_tags?: string[];
  stream_title?: string;
}

// ---------------------------------------------------------------------------
// Channel rewards
// ---------------------------------------------------------------------------

export interface KickChannelReward {
  id: string;
  title: string;
  cost: number;
  description: string;
  background_color: string;
  is_enabled: boolean;
  is_paused: boolean;
  is_user_input_required: boolean;
  should_redemptions_skip_request_queue: boolean;
}

export interface PostChannelRewardsBody {
  cost: number;
  title: string;
  background_color?: string;
  description?: string;
  is_enabled?: boolean;
  is_user_input_required?: boolean;
  should_redemptions_skip_request_queue?: boolean;
}

export interface PatchChannelRewardsBody {
  background_color?: string;
  cost?: number;
  description?: string;
  is_enabled?: boolean;
  is_paused?: boolean;
  is_user_input_required?: boolean;
  should_redemptions_skip_request_queue?: boolean;
  title?: string;
}

export type KickRedemptionStatus = "pending" | "accepted" | "rejected";

export interface KickChannelRewardRedemption {
  id: string;
  redeemed_at: string;
  redeemer: { user_id: number };
  status: KickRedemptionStatus;
  user_input: string;
}

export interface KickMinimalChannelReward {
  id: string;
  title: string;
  cost?: number;
  description?: string;
  can_manage?: boolean;
  is_deleted?: boolean;
}

export interface KickRedemptionsByReward {
  redemptions: KickChannelRewardRedemption[];
  reward: KickMinimalChannelReward;
}

export type KickFailedRedemptionReason =
  | "UNKNOWN"
  | "NOT_PENDING"
  | "NOT_FOUND"
  | "NOT_OWNED";

export interface KickFailedRedemption {
  id: string;
  reason: KickFailedRedemptionReason;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface PostChatParams {
  content: string;
  type: "user" | "bot";
  broadcaster_user_id?: number;
  reply_to_message_id?: string;
}

export interface KickChatMessageResponse {
  is_sent: boolean;
  message_id: string;
}

// ---------------------------------------------------------------------------
// Livestreams (v2 shape — v1 is deprecated)
// ---------------------------------------------------------------------------

export interface KickLivestreamUser {
  id: number;
  profile_picture: string;
  username: string;
}

export type KickLivestreamCategory = KickCategory;

export interface KickLivestreamChannel {
  slug: string;
}

export interface KickLivestream {
  broadcaster_user: KickLivestreamUser;
  category: KickLivestreamCategory;
  channel: KickLivestreamChannel;
  has_mature_content: boolean;
  id: string;
  language_code: string;
  started_at: string;
  tags: string[];
  thumbnail: string;
  title: string;
  viewer_count: number;
}

export interface KickLivestreamStats {
  total_count: number;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface KickGetUser {
  user_id: number;
  name: string;
  profile_picture: string;
  email?: string;
}

// ---------------------------------------------------------------------------
// KICKs leaderboard
// ---------------------------------------------------------------------------

export interface KickKicksLeaderboardEntry {
  gifted_amount: number;
  rank: number;
  user_id: number;
  username: string;
}

export interface KickKicksLeaderboard {
  lifetime: KickKicksLeaderboardEntry[];
  month: KickKicksLeaderboardEntry[];
  week: KickKicksLeaderboardEntry[];
}

// ---------------------------------------------------------------------------
// Event subscriptions
// ---------------------------------------------------------------------------

export interface KickEventSubscription {
  app_id: string;
  broadcaster_user_id: number;
  created_at: string;
  event: string;
  id: string;
  method: string;
  updated_at: string;
  version: number;
}

export interface KickEventSubscriptionResult {
  name: string;
  version: number;
  subscription_id?: string;
  error?: string;
}
