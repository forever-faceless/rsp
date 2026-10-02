import { ArrowRight, MapPin, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { InterestForm, OverlayKeeper } from "@/components/site/InterestForm";
import { ListingMedia } from "@/components/site/ListingMedia";
import { ListingStatusBadge } from "@/components/site/StatusBadge";
import { getSettings } from "@/lib/db/queries";
import { fill, getDictionary, isLocale, localePath, pick, type Dictionary, type Locale } from "@/lib/i18n";
import { lookupListing, type ListingDetail } from "@/lib/listing-detail";
import { priceLine } from "@/lib/pricing";
import { formatSiteNo } from "@/lib/refs";
import { formatArea } from "@/lib/utils";

/**
 * The quick enquiry for one listing, as a card over the page. This is the address to send
 * someone who has already seen the property in a post or a reel: it goes straight to the
 * questions, with a short reminder of the property beside them, and a way through to the
 * full listing for anyone who wants it.
 */

function facts(d: ListingDetail, dict: Dictionary, locale: Locale) {
  return [
    d.dimension ? `${d.dimension} ${dict.common.ft}` : "",
    d.areaSqft ? formatArea(d.areaSqft, d.areaUnit, locale) : "",
    d.facing ? `${dict.facing[d.facing]} ${dict.facing.label.toLowerCase()}` : "",
  ].filter(Boolean);
}

export async function generateMetadata({ params }: PageProps<"/[locale]/properties/[ref]/interest">): Promise<Metadata> {
  const { locale, ref } = await params;
  if (!isLocale(locale)) return {};
  const found = await lookupListing(ref);
  if (found.type !== "listing") return {};
  const d = found.detail;
  const dict = getDictionary(locale);
  const title = fill(dict.interest.title, { ref: d.ref });
  const description = [dict.types[d.type], ...facts(d, dict, locale), pick(d, "location", locale), priceLine(d.price, d.pricePerSqft, dict.common.perSqft, locale)].filter(Boolean).join(" · ");
  return {
    title,
    description,
    // The listing is the page to index; this one is a doorway to it.
    robots: { index: false, follow: true },
    alternates: { canonical: `/${locale}/properties/${d.slug}`, languages: { en: `/en/properties/${d.slug}/interest`, kn: `/kn/properties/${d.slug}/interest` } },
    openGraph: { type: "website", siteName: dict.meta.siteName, locale: locale === "kn" ? "kn_IN" : "en_IN", url: `/${locale}/properties/${d.slug}/interest`, title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function InterestPage({ params, searchParams }: PageProps<"/[locale]/properties/[ref]/interest">) {
  const { locale, ref: rawRef } = await params;
  if (!isLocale(locale)) notFound();
  const found = await lookupListing(rawRef);
  if (found.type === "project") permanentRedirect(localePath(locale, `/projects/${found.slug}`));
  if (found.type !== "listing") notFound();
  const d = found.detail;
  if (decodeURIComponent(rawRef) !== d.slug) permanentRedirect(localePath(locale, `/properties/${d.slug}/interest`));

  const dict = getDictionary(locale);
  const settings = await getSettings();
  const query = await searchParams;
  // A short tag on a shared link, such as ?from=instagram, is kept with the enquiry so the office knows where it came from.
  const fromRaw = Array.isArray(query.from) ? query.from[0] : query.from;
  const from = fromRaw && /^[a-z0-9_-]{1,24}$/i.test(fromRaw) ? fromRaw.toLowerCase() : "";

  const isSite = d.kind === "site";
  const name = pick(d, "title", locale);
  const heading = isSite ? `${dict.common.site} ${formatSiteNo(d.siteNo ?? 0)}, ${name}` : name;
  const location = pick(d, "location", locale);
  const detailsHref = localePath(locale, `/properties/${d.slug}`);
  const self = localePath(locale, `/properties/${d.slug}/interest`);
  const price = priceLine(d.price, d.pricePerSqft, dict.common.perSqft, locale) || dict.common.onRequest;
  const tags = facts(d, dict, locale);
  const wa = settings.whatsapp || settings.phonePrimary;

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-navy-950/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="interest-title" data-interest>
      <OverlayKeeper closeHref={detailsHref} />
      <div className="flex min-h-full items-start justify-center sm:items-center sm:p-6">
        <div className="relative w-full max-w-5xl bg-paper-50 shadow-lift sm:rounded-[4px] lg:grid lg:grid-cols-[1.15fr_0.85fr]">
          <Link
            href={detailsHref}
            aria-label={dict.interest.close}
            className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-[3px] bg-paper-0/90 text-navy-900 shadow-card hover:bg-paper-0"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Link>

          <div className="p-5 pt-6 sm:p-8 lg:p-10">
            {/* On a phone the property comes first, in a few words, then the questions. */}
            <div className="lg:hidden" data-interest-summary>
              <div className="flex flex-wrap items-center gap-2 pr-12">
                <span className="ref">{d.ref}</span>
                <ListingStatusBadge status={d.status} label={dict.status.listing[d.status]} />
              </div>
              <p className="mt-3 text-[1.05rem] font-semibold leading-snug text-navy-900">{heading}</p>
              {location ? (
                <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-ink-600">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-gold-600" aria-hidden="true" />
                  {location}
                </p>
              ) : null}
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {[...tags, price].map((tag) => (
                  <li key={tag} className="num rounded-[3px] border border-navy-900/12 bg-paper-0 px-2.5 py-1 text-[12.5px] font-medium text-navy-800">
                    {tag}
                  </li>
                ))}
              </ul>
              <div className="mt-5 border-t border-navy-900/10" />
            </div>

            <p className="eyebrow mt-5 lg:mt-0">{dict.interest.eyebrow}</p>
            <h2 id="interest-title" className="display-3 mt-3 pr-12 lg:pr-0">
              {fill(dict.interest.title, { ref: d.ref })}
            </h2>
            <div className="mt-6">
              <InterestForm
                locale={locale}
                t={dict.interest}
                e={dict.enquiry}
                whatsappLabel={dict.common.whatsapp}
                subject={{ ref: d.ref, label: `${d.ref}, ${name}`, ...d.ids }}
                phone={settings.phonePrimary}
                whatsapp={wa}
                source={from ? `${self}?from=${from}` : self}
                detailsHref={detailsHref}
              />
            </div>
          </div>

          {/* On a wider screen the property sits beside the questions. */}
          <aside className="hidden flex-col border-l border-navy-900/10 bg-paper-100 lg:flex lg:rounded-r-[4px]" data-interest-preview>
            <ListingMedia
              src={d.images[0]}
              alt={`${d.ref} ${heading}`}
              corners={d.geometry?.corners ?? null}
              widthFt={d.widthFt}
              depthFt={d.depthFt}
              facing={d.facing}
              sizes="420px"
              className="aspect-[4/3] w-full lg:rounded-tr-[4px]"
            />
            <div className="flex flex-1 flex-col p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="ref">{d.ref}</span>
                <ListingStatusBadge status={d.status} label={dict.status.listing[d.status]} />
              </div>
              <p className="mt-3 text-[1.2rem] font-semibold leading-snug text-navy-900">{heading}</p>
              {location ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-[14px] text-ink-600">
                  <MapPin className="h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
                  {location}
                </p>
              ) : null}
              {tags.length ? (
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <li key={tag} className="num rounded-[3px] border border-navy-900/12 bg-paper-0 px-2.5 py-1 text-[13px] font-medium text-navy-800">
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-5 font-display text-[1.6rem] font-semibold leading-none text-navy-900 [font-stretch:108%]">{price}</p>
              {d.negotiable ? <p className="mt-1.5 text-[13px] text-ink-600">{dict.common.negotiable}</p> : null}
              <Link href={detailsHref} className="link-arrow mt-auto inline-flex pt-6">
                {dict.interest.viewDetails} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </aside>

          <div className="border-t border-navy-900/10 p-5 sm:px-8 lg:hidden">
            <Link href={detailsHref} className="link-arrow inline-flex">
              {dict.interest.viewDetails} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
