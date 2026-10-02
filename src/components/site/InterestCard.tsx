import { ArrowRight, MapPin } from "lucide-react";
import type { Settings } from "@/lib/db/schema";
import { fill, pick, type Dictionary, type Locale } from "@/lib/i18n";
import type { ListingDetail } from "@/lib/listing-detail";
import { priceLine } from "@/lib/pricing";
import { formatSiteNo } from "@/lib/refs";
import { formatArea } from "@/lib/utils";
import { CloseEnquiryLink } from "./EnquireOverlay";
import { InterestForm } from "./InterestForm";
import { ListingMedia } from "./ListingMedia";
import { ListingStatusBadge } from "./StatusBadge";

/** Size and facing in a few words, for the tags on the card and the text of a shared link. */
export function listingTags(d: ListingDetail, dict: Dictionary, locale: Locale): string[] {
  return [
    d.dimension ? `${d.dimension} ${dict.common.ft}` : "",
    d.areaSqft ? formatArea(d.areaSqft, d.areaUnit, locale) : "",
    d.facing ? `${dict.facing[d.facing]} ${dict.facing.label.toLowerCase()}` : "",
  ].filter(Boolean);
}

type Props = { d: ListingDetail; dict: Dictionary; locale: Locale; settings: Settings; source: string; listingPath: string };

/**
 * What the quick enquiry card holds: the questions and the number, and a short reminder of the
 * property, beside them on a wide screen and above them on a phone.
 */
export function InterestCard({ d, dict, locale, settings, source, listingPath }: Props) {
  const isSite = d.kind === "site";
  const name = pick(d, "title", locale);
  const heading = isSite ? `${dict.common.site} ${formatSiteNo(d.siteNo ?? 0)}, ${name}` : name;
  const location = pick(d, "location", locale);
  const price = priceLine(d.price, d.pricePerSqft, dict.common.perSqft, locale) || dict.common.onRequest;
  const tags = listingTags(d, dict, locale);

  return (
    <>
      <div className="p-5 pt-6 sm:p-8 lg:p-10">
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
        <h2 id="interest-title" className="display-3 mt-3 lg:pr-12">
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
            whatsapp={settings.whatsapp || settings.phonePrimary}
            source={source}
            detailsHref={listingPath}
          />
        </div>
      </div>

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
          <CloseEnquiryLink href={listingPath} className="link-arrow mt-auto inline-flex pt-6">
            {dict.interest.viewDetails} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </CloseEnquiryLink>
        </div>
      </aside>

      <div className="border-t border-navy-900/10 p-5 sm:px-8 lg:hidden">
        <CloseEnquiryLink href={listingPath} className="link-arrow inline-flex">
          {dict.interest.viewDetails} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </CloseEnquiryLink>
      </div>
    </>
  );
}
