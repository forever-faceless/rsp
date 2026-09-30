import type { PriceDisplay } from "@/lib/db/enums";
import { formatINRShort, formatNumber } from "@/lib/utils";

/**
 * The figures a visitor may see for a listing. "Call for price" sends none. Otherwise the
 * listing's own choice decides: the total, the rate per square foot, or both. Whatever is
 * held back is dropped here, on the server, so it never reaches a page.
 */
export function publicPrice(
  row: { price: number | null; pricePerSqft: number | null; priceDisplay: PriceDisplay },
  callForPrice: boolean,
): { price: number | null; pricePerSqft: number | null } {
  if (callForPrice) return { price: null, pricePerSqft: null };
  return {
    price: row.priceDisplay === "rate" ? null : row.price,
    pricePerSqft: row.priceDisplay === "total" ? null : row.pricePerSqft,
  };
}

/** One short line for cards, tables and videos: the total, else the rate, else nothing. */
export function priceLine(price: number | null, pricePerSqft: number | null, perSqft: string, locale: "en" | "kn" = "en"): string {
  if (price) return formatINRShort(price, locale);
  if (pricePerSqft) return `₹${formatNumber(pricePerSqft)} ${perSqft}`;
  return "";
}
