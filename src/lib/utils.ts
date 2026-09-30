import type { AreaUnit } from "@/lib/db/enums";
import { convertArea } from "@/lib/geo";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/** ₹12,50,000 */
export function formatINR(value: number): string {
  return `₹${inr.format(value)}`;
}

/** ₹12.5 L or ₹1.2 Cr, for cards where space is tight. */
export function formatINRShort(value: number, locale: "en" | "kn" = "en"): string {
  const trim = (n: number) => n.toFixed(2).replace(/\.?0+$/, "");
  if (value >= 1_00_00_000) {
    const cr = value / 1_00_00_000;
    const n = cr >= 10 ? trim(Math.round(cr * 10) / 10) : trim(cr);
    return locale === "kn" ? `₹${n} ಕೋಟಿ` : `₹${n} Cr`;
  }
  if (value >= 1_00_000) {
    const l = value / 1_00_000;
    const n = l >= 10 ? trim(Math.round(l * 10) / 10) : trim(l);
    return locale === "kn" ? `₹${n} ಲಕ್ಷ` : `₹${n} L`;
  }
  return formatINR(value);
}

export function formatNumber(value: number): string {
  return inr.format(value);
}

const unitLabels: Record<AreaUnit, { en: string; kn: string }> = {
  sqft: { en: "sq ft", kn: "ಚ.ಅಡಿ" },
  cents: { en: "cents", kn: "ಸೆಂಟ್ಸ್" },
  guntas: { en: "guntas", kn: "ಗುಂಟೆ" },
  acres: { en: "acres", kn: "ಎಕರೆ" },
};

/** "1,200 sq ft", "12.5 guntas", "2.25 acres" */
export function formatArea(sqft: number, unit: AreaUnit = "sqft", locale: "en" | "kn" = "en"): string {
  const value = convertArea(sqft, unit);
  const text = unit === "sqft" ? inr.format(Math.round(value)) : inr2.format(value);
  return `${text} ${unitLabels[unit][locale]}`;
}

/** Keeps digits only, drops a leading 0 or +91 so numbers can be compared and dialled. */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function isIndianMobile(raw: string): boolean {
  return /^[6-9]\d{9}$/.test(normalisePhone(raw));
}

export function telHref(raw: string): string {
  const n = normalisePhone(raw);
  return n.length === 10 ? `tel:+91${n}` : `tel:${raw.replace(/\s+/g, "")}`;
}

export function formatPhoneDisplay(raw: string): string {
  const n = normalisePhone(raw);
  if (n.length === 10) return `+91 ${n.slice(0, 5)} ${n.slice(5)}`;
  return raw;
}

export function whatsappHref(raw: string, text?: string): string {
  const n = normalisePhone(raw);
  const number = n.length === 10 ? `91${n}` : n;
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${number}${q}`;
}

export function formatDate(date: Date, locale: "en" | "kn" = "en"): string {
  return new Intl.DateTimeFormat(locale === "kn" ? "kn-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Turns a YouTube watch, share or shorts link into its embeddable form. Null for anything else. */
export function youtubeEmbedUrl(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}
