/**
 * Reading coordinates in the forms people actually copy them in.
 *
 *   13.0212, 76.0943                     Google Maps, decimal degrees
 *   13°01'16.39"N 76°05'39.43"E          Google Earth, degrees minutes seconds
 *   13°01.273'N, 76°05.657'E             degrees and decimal minutes
 *   13.0212° N, 76.0943° E               decimal degrees with compass letters
 *   https://maps.google.com/...@13.0212,76.0943,17z     a pasted link
 */

export type Coordinates = { lat: number; lng: number };

const round7 = (n: number) => Number(n.toFixed(7));

function valid(lat: number, lng: number): Coordinates | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: round7(lat), lng: round7(lng) };
}

/** Curly quotes, primes and the like are turned into the plain marks the patterns below expect. */
function normalise(text: string): string {
  return text
    .replace(/[′’‘´`]/g, "'")
    .replace(/[″”“]/g, '"')
    .replace(/''/g, '"')
    .replace(/[º˚]/g, "°")
    .trim();
}

// One angle: degrees, then optional minutes and seconds, with a compass letter before or after.
const ANGLE = /([NSEW])?\s*(-?\d{1,3}(?:\.\d+)?)\s*°\s*(?:(\d{1,2}(?:\.\d+)?)\s*'\s*)?(?:(\d{1,2}(?:\.\d+)?)\s*"\s*)?([NSEW])?/gi;

type Angle = { value: number; letter: string };

function angles(text: string): Angle[] {
  const out: Angle[] = [];
  for (const m of text.matchAll(ANGLE)) {
    const degrees = Number(m[2]);
    const minutes = m[3] ? Number(m[3]) : 0;
    const seconds = m[4] ? Number(m[4]) : 0;
    if (minutes >= 60 || seconds >= 60) continue;
    const letter = (m[1] ?? m[5] ?? "").toUpperCase();
    const size = Math.abs(degrees) + minutes / 60 + seconds / 3600;
    out.push({ value: degrees < 0 || letter === "S" || letter === "W" ? -size : size, letter });
  }
  return out;
}

/** Latitude and longitude from a pair of angles, using the compass letters when they say which is which. */
function pair(a: Angle, b: Angle): Coordinates | null {
  const eastWest = (x: Angle) => x.letter === "E" || x.letter === "W";
  return eastWest(a) && !eastWest(b) ? valid(b.value, a.value) : valid(a.value, b.value);
}

/** Reads a latitude and longitude out of pasted text, or returns null when there is none. */
export function parseCoordinates(input: string): Coordinates | null {
  const text = normalise(input);
  if (!text) return null;

  // Links from Google Maps carry the point as @lat,lng or !3dlat!4dlng or q=lat,lng.
  const link = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) ?? text.match(/[@=](-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/);
  if (/^https?:/i.test(text) && link) return valid(Number(link[1]), Number(link[2]));

  if (text.includes("°")) {
    const found = angles(text);
    return found.length >= 2 ? pair(found[0], found[1]) : null;
  }

  // Plain decimals, with or without compass letters: "13.0212, 76.0943" or "N 13.0212 E 76.0943".
  const m = text.match(/^([NSEW])?\s*(-?\d{1,3}(?:\.\d+)?)\s*([NSEW])?\s*[,;\s]\s*([NSEW])?\s*(-?\d{1,3}(?:\.\d+)?)\s*([NSEW])?$/i);
  if (!m) return null;
  const letter = (x?: string, y?: string) => (x ?? y ?? "").toUpperCase();
  const signed = (n: string, l: string) => (l === "S" || l === "W" ? -Math.abs(Number(n)) : Number(n));
  const la = letter(m[1], m[3]);
  const lb = letter(m[4], m[6]);
  return pair({ value: signed(m[2], la), letter: la }, { value: signed(m[5], lb), letter: lb });
}

/** A single angle typed into one box, such as 13°01'16.39"N, as decimal degrees. */
export function parseAngle(input: string): number | null {
  const text = normalise(input);
  if (!text) return null;
  if (text.includes("°")) {
    const found = angles(text);
    return found.length === 1 ? round7(found[0].value) : null;
  }
  const m = text.match(/^(-?\d{1,3}(?:\.\d+)?)\s*([NSEW])?$/i);
  if (!m) return null;
  const letter = (m[2] ?? "").toUpperCase();
  return round7(letter === "S" || letter === "W" ? -Math.abs(Number(m[1])) : Number(m[1]));
}
