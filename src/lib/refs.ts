/**
 * Property numbers.
 *
 *   HSN-0001        an independent property, or a project as a whole, in the Hassan register
 *   HSN-0034(012)   site 12 inside project HSN-0034
 *   MYS-0001        the first listing in the Mysuru register
 *
 * The letters name the district and each district counts on its own, so the letters and the
 * number together identify a listing. In web addresses the brackets become a second dash
 * (hsn-0034-012), because chat apps tend to drop a trailing ")" when they turn a pasted
 * address into a link.
 */

export const DEFAULT_PREFIX = "HSN";
const PROPERTY_DIGITS = 4;
const SITE_DIGITS = 3;

export type ParsedRef = { prefix: string | null; propertyNo: number; siteNo: number | null };

export function cleanPrefix(prefix: string | null | undefined): string {
  const p = (prefix ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
  return p || DEFAULT_PREFIX;
}

/** True for a district code that can head a property number: two to five letters. */
export function isPrefix(value: string | null | undefined): value is string {
  return /^[A-Z]{2,5}$/.test(value ?? "");
}

function pad(n: number, width: number): string {
  return String(Math.trunc(n)).padStart(width, "0");
}

/** HSN-0001 */
export function formatPropertyNo(prefix: string, propertyNo: number): string {
  return `${cleanPrefix(prefix)}-${pad(propertyNo, PROPERTY_DIGITS)}`;
}

/** HSN-0034(012) */
export function formatSiteRef(prefix: string, propertyNo: number, siteNo: number): string {
  return `${formatPropertyNo(prefix, propertyNo)}(${pad(siteNo, SITE_DIGITS)})`;
}

export function formatRef(prefix: string, propertyNo: number, siteNo?: number | null): string {
  return siteNo == null ? formatPropertyNo(prefix, propertyNo) : formatSiteRef(prefix, propertyNo, siteNo);
}

/** Bare site number as printed inside the brackets: 012 */
export function formatSiteNo(siteNo: number): string {
  return pad(siteNo, SITE_DIGITS);
}

/** Address-safe form: hsn-0034 or hsn-0034-012 */
export function refSlug(prefix: string, propertyNo: number, siteNo?: number | null): string {
  const base = `${cleanPrefix(prefix).toLowerCase()}-${pad(propertyNo, PROPERTY_DIGITS)}`;
  return siteNo == null ? base : `${base}-${pad(siteNo, SITE_DIGITS)}`;
}

/**
 * Reads a property number typed by a person or taken from an address.
 * Accepts "HSN-0034(012)", "hsn-0034-012", "HSN 34 (12)", "MYS 7", "34/12", "0034" and similar.
 * The letters are optional; without them the lookup falls back to the main district.
 */
export function parseRef(input: string | null | undefined): ParsedRef | null {
  if (!input) return null;
  let text: string;
  try {
    text = decodeURIComponent(input);
  } catch {
    text = input;
  }
  const match = text.trim().match(/^([a-z]{1,5})?[\s._-]*(\d{1,6})\s*(?:[(\-/.\s]\s*(\d{1,4})\s*\)?)?$/i);
  if (!match) return null;
  const prefix = match[1] ? match[1].toUpperCase() : null;
  const propertyNo = Number(match[2]);
  const siteNo = match[3] == null ? null : Number(match[3]);
  if (!Number.isInteger(propertyNo) || propertyNo < 1) return null;
  if (siteNo != null && (!Number.isInteger(siteNo) || siteNo < 1)) return null;
  return { prefix, propertyNo, siteNo };
}
