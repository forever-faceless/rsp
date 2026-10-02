import type { Metadata } from "next";
import { listingTags } from "@/components/site/InterestCard";
import { fill, getDictionary, isLocale, pick } from "@/lib/i18n";
import { lookupListing } from "@/lib/listing-detail";
import { priceLine } from "@/lib/pricing";
import { ListingView } from "../listing-view";

/**
 * The address to send someone who has already seen the property in a post or a reel: the
 * listing, with the quick enquiry card already open over it. Closing the card leaves them on
 * the listing without reloading it.
 */
export async function generateMetadata({ params }: PageProps<"/[locale]/properties/[ref]/interest">): Promise<Metadata> {
  const { locale, ref } = await params;
  if (!isLocale(locale)) return {};
  const found = await lookupListing(ref);
  if (found.type !== "listing") return {};
  const d = found.detail;
  const dict = getDictionary(locale);
  const title = fill(dict.interest.title, { ref: d.ref });
  const description = [dict.types[d.type], ...listingTags(d, dict, locale), pick(d, "location", locale), priceLine(d.price, d.pricePerSqft, dict.common.perSqft, locale)].filter(Boolean).join(" · ");
  return {
    title,
    description,
    // The listing is the page to index; this address is a doorway to it.
    robots: { index: false, follow: true },
    alternates: { canonical: `/${locale}/properties/${d.slug}`, languages: { en: `/en/properties/${d.slug}/interest`, kn: `/kn/properties/${d.slug}/interest` } },
    openGraph: { type: "website", siteName: dict.meta.siteName, locale: locale === "kn" ? "kn_IN" : "en_IN", url: `/${locale}/properties/${d.slug}/interest`, title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function InterestPage({ params, searchParams }: PageProps<"/[locale]/properties/[ref]/interest">) {
  const { locale, ref } = await params;
  const query = await searchParams;
  // A short tag on a shared link, such as ?from=instagram, is kept with the enquiry so the office knows where it came from.
  const raw = Array.isArray(query.from) ? query.from[0] : query.from;
  const from = raw && /^[a-z0-9_-]{1,24}$/i.test(raw) ? raw.toLowerCase() : "";
  return <ListingView locale={locale} rawRef={ref} interest from={from} />;
}
