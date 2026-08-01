/**
 * Cast of mock chat participants. User shapes follow the docs-faithful
 * `KickUser` model so every generated event mirrors a real webhook payload.
 */

import type { KickBadge, KickUser } from "@/lib/kick/types";

export interface Persona {
  user: KickUser;
  kind: "mod" | "sub" | "regular" | "newcomer";
}

const AVATAR = (seed: string) => `https://api.dicebear.com/9.x/thumbs/svg?seed=${seed}`;

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

export const STREAM_INFO = {
  title: "RANKED GRIND TO TOP 500 — DAY 3 !loadout !prime",
  category: { id: 108, name: "Call of Duty: Warzone", thumbnail: "" },
  language: "en",
  started_minutes_ago: 84,
  viewer_count: 1_243,
};

/** Sidekick's bot identity — used for digest messages posted into chat. */
export const SIDEKICK_BOT: KickUser = {
  user_id: 9_999_999,
  username: "Sidekick",
  is_anonymous: false,
  is_verified: true,
  profile_picture: AVATAR("Sidekick"),
  channel_slug: "sidekick",
  identity: { username_color: "#53FC18", badges: [{ text: "Bot", type: "bot" }] },
};

export const PERSONAS: Persona[] = [
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
  { kind: "regular", user: makeUser(2011, "casual_carl", "#33FFF0", []) },
  { kind: "regular", user: makeUser(2012, "no_scope_nora", "#F0FF33", []) },
];

/** Pool of usernames used when the demo spawns brand-new viewers. */
export const NEWCOMER_NAMES = [
  "first_time_phil",
  "drive_by_dana",
  "lurker_larry",
  "clip_curious",
  "randomRaider",
  "algo_sent_me",
];

// ---------------------------------------------------------------------------
// Message content pools
// ---------------------------------------------------------------------------

export const EMOTES = {
  KEKW: { emote_id: "37226", name: "KEKW" },
  HYPERCLAP: { emote_id: "4148074", name: "HYPERCLAP" },
} as const;

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
];

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
];

export interface QuestionTopic {
  id: string;
  label: string;
  answer: string;
  phrasings: string[];
}

export const QUESTION_TOPICS: QuestionTopic[] = [
  {
    id: "sens",
    label: "mouse sensitivity / DPI",
    answer: "800 DPI, 0.8 in-game — he answered this on stream.",
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
  },
  {
    id: "loadout",
    label: "current loadout",
    answer: "HRM-9 with the Purifier attachment set — pinned in !loadout.",
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
    answer: "Streaming daily until Top 500, usually 7pm AEST starts.",
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

export const NEWCOMER_GREETINGS = [
  "hey first time here, what's going on?",
  "just got here, did I miss anything?",
  "new here — who is this guy?",
  "algorithm brought me, what's happening",
];
