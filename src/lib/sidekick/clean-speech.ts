/**
 * Speech safety for the voice pipeline: real chat content can flow into
 * spoken answers (top questions, trending words), so anything chat-derived
 * is scrubbed before it reaches TTS.
 */

const SLURS = [
  "nigger",
  "niggers",
  "nigga",
  "niggas",
  "faggot",
  "faggots",
  "fag",
  "fags",
  "retard",
  "retards",
  "retarded",
  "tranny",
  "trannies",
  "chink",
  "chinks",
  "spic",
  "spics",
  "kike",
  "kikes",
  "coon",
  "coons",
  "dyke",
  "dykes",
  "paki",
  "beaner",
  "beaners",
  "wetback",
  "wetbacks",
];

const PROFANITY = [
  "fuck",
  "fucking",
  "fucked",
  "fucker",
  "shit",
  "shitting",
  "bitch",
  "bitches",
  "cunt",
  "cunts",
  "asshole",
  "assholes",
  "dick",
  "dicks",
  "pussy",
  "pussies",
  "whore",
  "whores",
  "slut",
  "sluts",
];

const SLUR_SET = new Set(SLURS);
const BLOCKED = new Set([...SLURS, ...PROFANITY]);

const WORD_PATTERN = /[a-zA-Z']+/g;

function normalize(word: string): string {
  return word.toLowerCase().replace(/'/g, "");
}

function mask(word: string): string {
  return `${word[0]}${"*".repeat(Math.max(2, word.length - 1))}`;
}

/** Masks slurs AND profanity — used for anything spoken aloud. */
export function maskSpeech(text: string): string {
  return text.replace(WORD_PATTERN, (word) => (BLOCKED.has(normalize(word)) ? mask(word) : word));
}

/**
 * Masks slurs only — used for displayed chat content, where ordinary
 * profanity stays (that's just what chat sounds like) but hate speech never
 * renders.
 */
export function maskSlurs(text: string): string {
  return text.replace(WORD_PATTERN, (word) => (SLUR_SET.has(normalize(word)) ? mask(word) : word));
}

/** True when a single token (trending word, username) should be dropped entirely. */
export function isSpeakableWord(word: string): boolean {
  return !BLOCKED.has(normalize(word));
}
