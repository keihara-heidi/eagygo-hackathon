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

const BLOCKED = new Set([...SLURS, ...PROFANITY]);

const WORD_PATTERN = /[a-zA-Z']+/g;

function isBlocked(word: string): boolean {
  return BLOCKED.has(word.toLowerCase().replace(/'/g, ""));
}

/** Masks blocked words in free text: "word" -> "w***". */
export function maskSpeech(text: string): string {
  return text.replace(WORD_PATTERN, (word) =>
    isBlocked(word) ? `${word[0]}${"*".repeat(Math.max(2, word.length - 1))}` : word,
  );
}

/** True when a single token (trending word, username) should be dropped entirely. */
export function isSpeakableWord(word: string): boolean {
  return !isBlocked(word);
}
