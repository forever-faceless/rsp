import type { IgTopic } from "@/lib/db/enums";
import { normalisePhone } from "@/lib/utils";

/**
 * Reading an Instagram message: is there a phone number in it, a property number, and what
 * is it asking for. Plain rules on purpose. A message these rules cannot place is handed to
 * the office rather than guessed at.
 */

/** An Indian mobile number written anywhere in the text, in any of the usual spellings. */
export function findPhone(text: string): string | null {
  // +91 98765 43210, 98765-43210, 09876543210, 9 8 7 6 5 4 3 2 1 0
  const matches = text.match(/(?<!\d)(?:\+?\s*91[\s-]*)?0?[6-9](?:[\s-]?\d){9}(?!\d)/g) ?? [];
  for (const raw of matches) {
    const digits = normalisePhone(raw);
    if (/^[6-9]\d{9}$/.test(digits)) return digits;
  }
  return null;
}

/**
 * Property numbers written in the text, such as "HSN-0002", "hsn 2" or "MYS 7 (12)". The
 * letters must be one of the office's district codes, so "for 30" or "rs 50" are not taken
 * for one.
 */
export function findRefs(text: string, prefixes: string[]): string[] {
  const known = new Set(prefixes.map((p) => p.toUpperCase()));
  const out: string[] = [];
  for (const m of text.matchAll(/(?<![a-z])([a-z]{2,5})[\s._-]{0,2}(\d{1,5})(?:\s?\(\s?(\d{1,4})\s?\))?(?!\d)/gi)) {
    if (!known.has(m[1].toUpperCase())) continue;
    out.push(`${m[1].toUpperCase()}-${m[2]}${m[3] ? `(${m[3]})` : ""}`);
  }
  return [...new Set(out)];
}

// English, Kannada, and Kannada as it is typed in English letters.
const WORDS: Record<Exclude<IgTopic, "reel" | "number" | "other">, string[]> = {
  sell: ["sell", "selling", "for sale my", "want to sale", "maratakke", "marata", "marbeku", "ಮಾರಾಟ", "ಮಾರಬೇಕು", "ಮಾರಲು"],
  price: ["price", "prise", "prize", "rate", "cost", "how much", "amount", "budget", "bele", "yestu", "eshtu", "estu", "ಬೆಲೆ", "ಪ್ರೈಸ್", "ರೇಟ್", "ರೇಟು", "ದರ", "ಎಷ್ಟು"],
  location: ["location", "where", "address", "map", "route", "direction", "landmark", "yelli", "elli", "jaaga", "jaga", "ಎಲ್ಲಿ", "ಲೊಕೇಶನ್", "ವಿಳಾಸ", "ಜಾಗ"],
  visit: ["visit", "see the site", "see the property", "show me", "site nod", "nodbeku", "nodabeku", "ನೋಡಬೇಕು", "ವಿಸಿಟ್", "ಭೇಟಿ"],
  property: ["detail", "details", "info", "information", "interested", "intrested", "available", "tell me more", "more about", "link", "vivara", "mahiti", "beku", "ವಿವರ", "ಮಾಹಿತಿ", "ಬೇಕು", "ಇದೆಯಾ"],
  greeting: ["hi", "hii", "hiii", "hello", "helo", "hlo", "hey", "namaste", "namaskara", "namaskar", "ನಮಸ್ಕಾರ", "ನಮಸ್ತೆ", "ಹಾಯ್", "ಹಲೋ"],
};

const has = (text: string, word: string) =>
  // Latin words must stand alone ("hi" is not in "this"); Kannada has no such word edges to rely on.
  /^[a-z ]+$/.test(word) ? new RegExp(`(?<![a-z])${word}(?![a-z])`, "i").test(text) : text.includes(word);

/** What a message is asking for, or "other" when the rules cannot tell. */
export function topicOf(text: string): IgTopic {
  const t = text.toLowerCase().trim();
  if (!t) return "other";
  for (const topic of ["sell", "price", "location", "visit", "property"] as const) {
    if (WORDS[topic].some((w) => has(t, w))) return topic;
  }
  // A greeting counts only when it is more or less the whole message.
  if (t.length <= 24 && WORDS.greeting.some((w) => has(t, w))) return "greeting";
  return "other";
}

const YES = ["yes", "yess", "yeah", "yep", "ya", "ok", "okay", "sure", "send", "haudu", "howdu", "houdu", "kalisi", "kalsi", "ಹೌದು", "ಹೂ", "ಸರಿ", "ಕಳುಹಿಸಿ", "ಕಳಿಸಿ"];
const NO = ["no", "not", "dont", "don't", "illa", "beda", "ಇಲ್ಲ", "ಬೇಡ"];

/**
 * The answer to "Interested in this property?" when it is typed rather than tapped: the
 * details, the price, or null when it is neither and so for the office to read.
 */
export function answerOf(text: string): "details" | "price" | null {
  const t = text.toLowerCase().trim();
  if (!t || t.length > 40 || NO.some((w) => has(t, w))) return null;
  if (WORDS.price.some((w) => has(t, w))) return "price";
  return [...YES, ...WORDS.property].some((w) => has(t, w)) ? "details" : null;
}

const ACKS = new Set(["ok", "okk", "okay", "oky", "okie", "k", "kk", "hm", "hmm", "fine", "good", "nice", "super", "thanks", "thank", "thankyou", "thanku", "tq", "ty", "thx", "tnx", "sari", "seri", "aythu", "aitu", "ayitu", "ಸರಿ", "ಆಯ್ತು", "ಓಕೆ", "ಧನ್ಯವಾದ", "ಧನ್ಯವಾದಗಳು"]);
/** Words that ride along with one of those ("ok sir", "thank you") but are not one by themselves. */
const RIDERS = new Set(["sir", "you", "madam", "anna", "bro"]);

/**
 * A bare "ok", "thanks" or thumbs up: it closes an exchange and asks nothing, so it needs no
 * answer and no one's attention. Anything with a question in it is not one of these.
 */
export function isAck(text: string): boolean {
  if (!text.trim() || text.length > 30 || /[?？]/.test(text)) return false;
  // What is left once emoji and punctuation are gone: nothing (it was only a thumbs up), or a word or two.
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return true;
  return words.length <= 3 && words.every((w) => ACKS.has(w) || RIDERS.has(w)) && words.some((w) => ACKS.has(w));
}

/** True when a comment on a reel should get the details: any of the office's chosen words, or a number. */
export function commentAsks(text: string, words: string[]): boolean {
  const t = text.toLowerCase();
  return words.some((w) => w && has(t, w.toLowerCase())) || findPhone(text) != null;
}

/** The office's comment words as a list, from the comma-separated box in settings. */
export function splitWords(list: string): string[] {
  return list
    .split(/[,\n]/)
    .map((w) => w.trim())
    .filter(Boolean);
}

export const DEFAULT_COMMENT_WORDS = "details, detail, price, rate, info, interested, location, link, available, cost, ಬೆಲೆ, ವಿವರ, ಮಾಹಿತಿ, ಬೇಕು, ಎಷ್ಟು, bele, vivara, mahiti, beku";
