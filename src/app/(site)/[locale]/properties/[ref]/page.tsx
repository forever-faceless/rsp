import type { Metadata } from "next";
import { fill, getDictionary, isLocale, pick } from "@/lib/i18n";
import { lookupListing } from "@/lib/listing-detail";
import { priceLine } from "@/lib/pricing";
import { formatSiteNo } from "@/lib/refs";
import { formatArea } from "@/lib/utils";
import { ListingView } from "./listing-view";

export async function generateMetadata({ params }: PageProps<"/[locale]/properties/[ref]">): Promise<Metadata> {
  const { locale, ref } = await params;
  if (!isLocale(locale)) return {};
  const found = await lookupListing(ref);
  if (found.type !== "listing") return {};
  const d = found.detail;
  const dict = getDictionary(locale);
  const name = pick(d, "title", locale);
  const title = d.kind === "site" ? `${d.ref} · ${fill(dict.site.inProject, { site: formatSiteNo(d.siteNo ?? 0), project: name })}` : `${d.ref} · ${name}`;
  // What a shared link says under its picture: what it is, its size, where it is, and the price if one is shown.
  const facts = [
    dict.types[d.type],
    d.dimension ? `${d.dimension} ${dict.common.ft}` : "",
    d.areaSqft ? formatArea(d.areaSqft, d.areaUnit, locale) : "",
    d.facing ? `${dict.facing[d.facing]} ${dict.facing.label.toLowerCase()}` : "",
    pick(d, "location", locale),
    priceLine(d.price, d.pricePerSqft, dict.common.perSqft, locale),
    dict.status.listing[d.status],
  ]
    .filter(Boolean)
    .join(" · ");
  const address = `/${locale}/properties/${d.slug}`;
  return {
    title,
    description: facts,
    alternates: { canonical: address, languages: { en: `/en/properties/${d.slug}`, kn: `/kn/properties/${d.slug}` } },
    // The picture comes from opengraph-image.tsx beside this page.
    openGraph: { type: "website", siteName: dict.meta.siteName, locale: locale === "kn" ? "kn_IN" : "en_IN", url: address, title, description: facts },
    twitter: { card: "summary_large_image", title, description: facts },
  };
}

export default async function PropertyPage({ params }: PageProps<"/[locale]/properties/[ref]">) {
  const { locale, ref } = await params;
  return <ListingView locale={locale} rawRef={ref} />;
}
