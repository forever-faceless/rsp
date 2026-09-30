import { ArrowUpRight, MapPin } from "lucide-react";
import Link from "next/link";
import type { Listing } from "@/lib/db/queries";
import type { SurveyCorner } from "@/lib/db/enums";
import { fill, localePath, pick, type Dictionary, type Locale } from "@/lib/i18n";
import { formatRef, refSlug } from "@/lib/refs";
import { cn, formatArea, formatINRShort, formatNumber } from "@/lib/utils";
import { ListingMedia } from "./ListingMedia";
import { ListingStatusBadge, SoldStamp } from "./StatusBadge";

type Props = {
  listing: Listing;
  locale: Locale;
  dict: Dictionary;
  corners?: SurveyCorner[] | null;
  priority?: boolean;
  className?: string;
};

export function listingHref(locale: Locale, listing: Pick<Listing, "prefix" | "propertyNo" | "siteNo">): string {
  return localePath(locale, `/properties/${refSlug(listing.prefix, listing.propertyNo, listing.siteNo)}`);
}

export function ListingCard({ listing, locale, dict, corners, priority, className }: Props) {
  const ref = formatRef(listing.prefix, listing.propertyNo, listing.siteNo);
  const href = listingHref(locale, listing);
  const name = pick(listing, "title", locale);
  const isSite = listing.kind === "site";
  const title = isSite ? `${dict.common.site} ${String(listing.siteNo).padStart(3, "0")}` : name;
  const location = pick(listing, "location", locale);
  const sold = listing.status === "sold";

  const facts = [
    listing.dimension ? `${listing.dimension} ${dict.common.ft}` : null,
    listing.areaSqft ? formatArea(listing.areaSqft, listing.areaUnit, locale) : null,
    listing.facing ? dict.facing[listing.facing] : null,
  ].filter(Boolean) as string[];

  return (
    <article className={cn("card card-hover group relative flex h-full flex-col overflow-hidden", className)}>
      <div className="relative">
        <ListingMedia
          src={listing.image}
          alt={`${ref} ${title}`}
          corners={corners}
          widthFt={listing.widthFt}
          depthFt={listing.depthFt}
          facing={listing.facing}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          priority={priority}
          className="aspect-[4/3]"
          imageClassName={cn("transition-transform duration-700 ease-out group-hover:scale-[1.04]", sold && "grayscale-[55%]")}
        />
        {sold ? (
          <>
            <div className="pointer-events-none absolute inset-0 bg-paper-50/55" aria-hidden="true" />
            <SoldStamp label={dict.status.listing.sold} />
          </>
        ) : null}
        <div className="absolute inset-x-3 top-3 z-[3] flex items-start justify-between gap-2">
          <span className="ref">{ref}</span>
          {sold ? null : <ListingStatusBadge status={listing.status} label={dict.status.listing[listing.status]} className="shadow-card" />}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="label-mono">
          {isSite ? fill(dict.listings.inProject, { project: name }) : dict.types[listing.type]}
          {listing.corner ? <span className="text-gold-700"> · {dict.common.corner}</span> : null}
        </p>
        <h3 className="mt-2 text-[1.2rem] leading-snug">
          <Link href={href} className="after:absolute after:inset-0">
            {title}
          </Link>
        </h3>
        {location ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-[14px] text-ink-500">
            <MapPin className="mt-[3px] h-3.5 w-3.5 shrink-0 text-gold-600" aria-hidden="true" />
            {location}
          </p>
        ) : null}

        {facts.length ? (
          <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t border-navy-900/8 pt-4 text-[13.5px] font-medium text-ink-700">
            {facts.map((f, i) => (
              <li key={f} className={cn("num", i > 0 && "before:mr-3 before:text-ink-300 before:content-['/']")}>
                {f}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <p>
            {listing.price ? (
              <span className="font-display text-[1.35rem] font-semibold text-navy-900 [font-stretch:108%]">{formatINRShort(listing.price, locale)}</span>
            ) : listing.pricePerSqft ? (
              <>
                <span className="font-display text-[1.35rem] font-semibold text-navy-900 [font-stretch:108%]">₹{formatNumber(listing.pricePerSqft)}</span>{" "}
                <span className="text-[13px] font-medium text-ink-600">{dict.common.perSqft}</span>
              </>
            ) : (
              <span className="text-[14px] font-medium text-ink-600">{dict.common.onRequest}</span>
            )}
          </p>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] border border-navy-900/15 text-navy-800 transition-colors duration-300 group-hover:border-navy-800 group-hover:bg-navy-800 group-hover:text-gold-200">
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </div>
    </article>
  );
}
