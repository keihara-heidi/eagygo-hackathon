/**
 * Fixture cast and content pools for the mock chat engine. User shapes follow
 * the docs-faithful `KickUser` model verbatim. Identities intentionally match
 * `src/lib/sidekick/personas.ts` (same user_ids/usernames) so both engines
 * present one consistent cast until the surfaces are consolidated.
 */

import type { KickBadge, KickUser } from "@/lib/kick/types";

export type CastKind = "mod" | "sub" | "regular" | "fresh";

export interface CastMember {
  user: KickUser;
  kind: CastKind;
}

const AVATAR = (seed: string) =>
  `https://api.dicebear.com/9.x/thumbs/svg?seed=${seed}`;

function makeUser(
  id: number,
  username: string,
  color: string,
  badges: KickBadge[],
): KickUser {
  return {
    user_id: id,
    username,
    is_anonymous: false,
    is_verified: false,
    profile_picture: AVATAR(username),
    channel_slug: username.toLowerCase(),
    identity: { username_color: color, badges },
  };
}

/** The mock broadcaster whose stream the demo runs against. */
export const STREAMER: KickUser = {
  user_id: 1_000_001,
  username: "OrbitFPS",
  is_anonymous: false,
  is_verified: true,
  profile_picture: AVATAR("OrbitFPS"),
  channel_slug: "orbitfps",
  identity: null,
};

/** Sidekick's bot identity — sender of digest messages posted into chat. */
export const SIDEKICK_BOT: KickUser = {
  user_id: 9_999_999,
  username: "Sidekick",
  is_anonymous: false,
  is_verified: true,
  profile_picture: AVATAR("Sidekick"),
  channel_slug: "sidekick",
  identity: {
    username_color: "#53FC18",
    badges: [{ text: "Bot", type: "bot" }],
  },
};

export const STREAM_INFO = {
  livestream_id: "mock-livestream-orbitfps-day3",
  title: "RANKED GRIND TO TOP 500 — DAY 3 !loadout !prime",
  category: { id: 108, name: "Call of Duty: Warzone", thumbnail: "" },
  language_code: "en",
  started_minutes_ago: 84,
  viewer_count: 1_243,
  tags: ["FPS", "Ranked", "English"],
  thumbnail: AVATAR("orbitfps-thumbnail"),
} as const;

export const CAST: CastMember[] = [
  {
    kind: "mod",
    user: makeUser(2001, "NightWarden", "#FF5733", [
      { text: "Moderator", type: "moderator" },
      { text: "Subscriber", type: "subscriber", count: 14 },
    ]),
  },
  {
    kind: "mod",
    user: makeUser(2002, "pixel_janitor", "#33C1FF", [
      { text: "Moderator", type: "moderator" },
      { text: "Subscriber", type: "subscriber", count: 9 },
    ]),
  },
  {
    kind: "sub",
    user: makeUser(2003, "kebab_king", "#FFD733", [
      { text: "Subscriber", type: "subscriber", count: 12 },
      { text: "Sub Gifter", type: "sub_gifter", count: 5 },
    ]),
  },
  {
    kind: "sub",
    user: makeUser(2004, "sweatyPalms", "#B03CFF", [
      { text: "Subscriber", type: "subscriber", count: 7 },
    ]),
  },
  {
    kind: "sub",
    user: makeUser(2005, "ttv_backseat", "#3CFFB0", [
      { text: "Subscriber", type: "subscriber", count: 3 },
    ]),
  },
  {
    kind: "sub",
    user: makeUser(2006, "aim_demon_04", "#FF3C8E", [
      { text: "Subscriber", type: "subscriber", count: 22 },
    ]),
  },
  { kind: "regular", user: makeUser(2007, "loot_goblin", "#FF8C33", []) },
  { kind: "regular", user: makeUser(2008, "zzz_andy", "#8CFF33", []) },
  { kind: "regular", user: makeUser(2009, "queue_dodger", "#338CFF", []) },
  { kind: "regular", user: makeUser(2010, "wraith_main", "#FF33F0", []) },
  // Fresh accounts: joined Kick this week, default color, no badges yet.
  { kind: "fresh", user: makeUser(2013, "xKovaaksGrindx", "#BFBFBF", []) },
  { kind: "fresh", user: makeUser(2014, "couch_potato_26", "#BFBFBF", []) },
];

/** Names cycled by the new_viewer scenario; user_ids increment from here. */
export const NEWCOMER_NAMES = [
  "first_time_phil",
  "drive_by_dana",
  "lurker_larry",
  "clip_curious",
  "randomRaider",
  "algo_sent_me",
] as const;

export const NEWCOMER_USER_ID_BASE = 3_000_001;

export function newcomerUser(index: number): KickUser {
  const base = NEWCOMER_NAMES[index % NEWCOMER_NAMES.length] ?? "new_viewer";
  // Past one full cycle, suffix a counter so every newcomer stays unseen.
  const cycle = Math.floor(index / NEWCOMER_NAMES.length);
  const name = cycle === 0 ? base : `${base}${cycle + 1}`;
  return {
    user_id: NEWCOMER_USER_ID_BASE + index,
    username: name,
    is_anonymous: false,
    is_verified: false,
    profile_picture: AVATAR(name),
    channel_slug: name.toLowerCase(),
    identity: { username_color: "#AAAAAA", badges: [] },
  };
}

// ---------------------------------------------------------------------------
// Content pools
// ---------------------------------------------------------------------------

export const EMOTES = {
  KEKW: { emote_id: "37226", name: "KEKW" },
  HYPERCLAP: { emote_id: "4148074", name: "HYPERCLAP" },
} as const;

export type EmoteName = keyof typeof EMOTES;

export const AMBIENT_LINES = [
  "W",
  "that was clean",
  "he's cracked today",
  "no shot he hits this",
  "rotation is mid, go north",
  "chat is this real",
  "lag or just me?",
  "map rotation is terrible today",
  "this lobby is sweaty",
  "GG",
  "the movement is smooth",
  "bro is gaming",
  "L rotation",
  "he baited him LOL",
  "top 500 today for sure",
  "who's the duo?",
  "this song is a banger",
] as const;

export const HYPE_LINES = [
  "CLIP IT",
  "CLIP THAT NOW",
  "LETS GOOO",
  "NO WAY",
  "INSANE",
  "W W W",
  "HE'S HIM",
  "BEST PLAY OF THE STREAM",
  "1v4?!?!",
] as const;

export const NEWCOMER_GREETINGS = [
  "hey first time here, what's going on?",
  "just got here, did I miss anything?",
  "new here — who is this guy?",
  "algorithm brought me, what's happening",
] as const;

export interface QuestionTopic {
  id: string;
  label: string;
  phrasings: readonly string[];
}

/**
 * The question_flood scenario always uses the sensitivity topic — SPEC.md's
 * demo script is "8 people have asked about your sensitivity".
 */
export const SENS_TOPIC: QuestionTopic = {
  id: "sens",
  label: "mouse sensitivity / DPI",
  phrasings: [
    "what's your sens?",
    "whats ur dpi and sens",
    "sensitivity settings?",
    "yo orbit what sens do you play on",
    "dpi??",
    "can you show your mouse settings",
    "what are your mouse settings",
    "sens/dpi pls",
  ],
};

/** Topics the baseline sprinkles in as organic single questions. */
export const QUESTION_TOPICS: readonly QuestionTopic[] = [
  SENS_TOPIC,
  {
    id: "loadout",
    label: "current loadout",
    phrasings: [
      "what loadout is this",
      "class setup?",
      "whats the smg build",
      "gun setup pls",
      "attachments?",
      "what gun is that",
      "loadout code?",
      "build for the smg?",
    ],
  },
  {
    id: "schedule",
    label: "stream schedule",
    phrasings: [
      "how long you streaming today",
      "stream tomorrow?",
      "what time do you usually go live",
      "schedule?",
      "you streaming this weekend",
      "when's the next stream",
      "daily streams?",
      "how many hours left",
    ],
  },
];
