import type { BilingualItem } from "@/lib/db/enums";
import { defaultLocale, type Locale } from "./config";
import { en } from "./dictionaries/en";
import { kn } from "./dictionaries/kn";

export type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = { en, kn };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}

export function otherLocale(locale: Locale): Locale {
  return locale === "en" ? "kn" : "en";
}

/** Builds a localized path: localePath("kn", "/projects/abc") -> "/kn/projects/abc" */
export function localePath(locale: Locale, path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/** Swaps the locale prefix of a pathname, keeping the rest of the URL. */
export function switchLocalePath(pathname: string, to: Locale): string {
  const parts = pathname.split("/");
  if (parts[1] === "en" || parts[1] === "kn") {
    parts[1] = to;
    return parts.join("/") || `/${to}`;
  }
  return localePath(to, pathname);
}

type Bilingual<K extends string> = { [P in `${K}En` | `${K}Kn`]?: string | null };

/**
 * Reads a bilingual DB field: pick(project, "name", "kn") -> nameKn, falling back to nameEn.
 */
export function pick<K extends string>(row: Bilingual<K>, field: K, locale: Locale): string {
  const knValue = (row as Record<string, unknown>)[`${field}Kn`];
  const enValue = (row as Record<string, unknown>)[`${field}En`];
  if (locale === "kn" && typeof knValue === "string" && knValue.trim()) return knValue;
  return typeof enValue === "string" ? enValue : "";
}

export function pickItem(item: BilingualItem, locale: Locale): string {
  return locale === "kn" && item.kn?.trim() ? item.kn : item.en;
}

/** Fills {placeholders} in a dictionary string. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}

export { locales, defaultLocale, isLocale, localeNames, type Locale } from "./config";
