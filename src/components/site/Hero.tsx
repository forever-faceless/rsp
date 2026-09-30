import { ArrowRight, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { PropertyType, SurveyCorner } from "@/lib/db/enums";
import type { Listing } from "@/lib/db/queries";
import type { Settings } from "@/lib/db/schema";
import { formatCoords } from "@/lib/geo";
import { localePath, pick, type Dictionary, type Locale } from "@/lib/i18n";
import { planFromCorners, planFromDimensions, type PlanShape } from "@/lib/plan";
import { formatRef } from "@/lib/refs";
import { priceLine } from "@/lib/pricing";
import { formatArea } from "@/lib/utils";
import { HeroMotion } from "./HeroMotion";
import { listingHref } from "./ListingCard";
import { PlotPlan } from "./PlotPlan";
import { RefSearch } from "./RefSearch";

export type HeroSpecimen = { listing: Listing; corners: SurveyCorner[] | null };

type Props = { locale: Locale; dict: Dictionary; settings: Settings; specimen: HeroSpecimen | null; types: PropertyType[] };

/** Small registration marks at the corners of the sheet, as on a printed survey plan. */
function CropMarks() {
  const mark = "absolute h-3 w-3 border-gold-600";
  return (
    <>
      <span data-sheet-mark className={`${mark} -left-1.5 -top-1.5 border-l-2 border-t-2`} aria-hidden="true" />
      <span data-sheet-mark className={`${mark} -right-1.5 -top-1.5 border-r-2 border-t-2`} aria-hidden="true" />
      <span data-sheet-mark className={`${mark} -bottom-1.5 -left-1.5 border-b-2 border-l-2`} aria-hidden="true" />
      <span data-sheet-mark className={`${mark} -bottom-1.5 -right-1.5 border-b-2 border-r-2`} aria-hidden="true" />
    </>
  );
}

function Sheet({ locale, dict, settings, specimen }: Omit<Props, "types">) {
  const prefix = settings.propertyPrefix;
  let shape: PlanShape | null = null;
  if (specimen) {
    const { listing, corners } = specimen;
    shape = (corners && corners.length >= 3 ? planFromCorners(corners) : null) ?? planFromDimensions(listing.widthFt, listing.depthFt, listing.facing);
  }
  // With an empty register the sheet still shows what a listing will look like.
  const sample = !specimen || !shape;
  const drawn = shape ?? planFromDimensions(30, 40, "E")!;
  const listing = specimen?.listing ?? null;
  // The caption says where the drawing comes from, and never claims a survey that was not made.
  const surveyed = Boolean(specimen?.corners && specimen.corners.length >= 3);
  const caption = sample ? dict.home.sheetCaptionSample : surveyed ? dict.home.sheetCaption : dict.home.sheetCaptionStated;
  const ref = listing ? formatRef(listing.prefix, listing.propertyNo, listing.siteNo) : `${prefix}-0001`;
  const area = listing?.areaSqft ? formatArea(listing.areaSqft, listing.areaUnit, locale) : sample ? formatArea(1200, "sqft", locale) : "";
  const title = listing ? (listing.kind === "site" ? `${dict.common.site} ${String(listing.siteNo).padStart(3, "0")}, ${pick(listing, "title", locale)}` : pick(listing, "title", locale)) : "";
  const location = listing ? pick(listing, "location", locale) : "";

  const facts = [
    { label: dict.property.area, value: area },
    { label: dict.facing.label, value: listing?.facing ? dict.facing[listing.facing] : sample ? dict.facing.E : "" },
    { label: dict.common.price, value: listing ? priceLine(listing.price, listing.pricePerSqft, dict.common.perSqft, locale) || dict.common.onRequest : "" },
  ].filter((f) => f.value);

  const body = (
    <div data-sheet data-hero-hide className="relative">
      <div className="relative border border-navy-900/15 bg-paper-0 shadow-sheet">
        <CropMarks />
        <div className="flex items-center justify-between gap-3 border-b border-navy-900/10 px-5 py-3.5">
          <span className="label-mono">{dict.home.sheetTitle}</span>
          <span className="ref">{ref}</span>
        </div>
        <div className="bg-grid px-3 py-2 sm:px-5">
          <PlotPlan shape={drawn} areaLabel={area} title={`${ref} ${dict.property.plan}`} />
        </div>
        <div className="border-t border-navy-900/10 px-5 py-4">
          {title ? (
            <div data-sheet-row>
              <p className="font-display text-[1.15rem] font-semibold leading-snug text-navy-900 [font-stretch:110%]">{title}</p>
              {location ? <p className="mt-0.5 text-[13.5px] text-ink-500">{location}</p> : null}
            </div>
          ) : null}
          <dl className="mt-3 grid grid-cols-3 gap-3" data-sheet-row>
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="label-mono">{f.label}</dt>
                <dd className="num mt-1 text-[14px] font-semibold text-navy-900">{f.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-navy-900/8 pt-3" data-sheet-row>
            <span className="num text-[11.5px] text-ink-500">
              {surveyed && listing?.lat != null && listing.lng != null ? formatCoords(listing.lat, listing.lng) : caption}
            </span>
            {listing ? (
              <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-navy-800">
                {dict.common.viewDetails}
                <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover/sheet:-translate-y-0.5 group-hover/sheet:translate-x-0.5" aria-hidden="true" />
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  return listing ? (
    <Link href={listingHref(locale, listing)} className="group/sheet block" aria-label={`${ref} ${title}`}>
      {body}
    </Link>
  ) : (
    body
  );
}

export function Hero({ locale, dict, settings, specimen, types }: Props) {
  const title = pick(settings, "heroTitle", locale) || dict.home.heroTitle;
  const subtitle = pick(settings, "heroSubtitle", locale) || dict.home.heroSubtitle;
  const propertiesHref = localePath(locale, "/properties");

  return (
    <section className="bg-grid relative overflow-hidden border-b border-navy-900/10">
      {/* Paper fades back in toward the edges so the grid reads as a working surface, not wallpaper. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,transparent_30%,var(--color-paper-50)_78%)]" aria-hidden="true" />

      <HeroMotion className="container-x relative grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.12fr_0.88fr] lg:gap-14 lg:py-24">
        <div>
          <p data-hero-eyebrow data-hero-hide className="eyebrow">
            {dict.home.heroEyebrow}
          </p>
          <h1 data-hero-title data-hero-hide className="display-1 mt-6 max-w-[15ch] sm:max-w-[17ch]">
            {title}
          </h1>
          <p data-hero-fade data-hero-hide className="lede mt-6 max-w-xl">
            {subtitle}
          </p>
          <div data-hero-fade data-hero-hide className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link href={propertiesHref} className="btn-primary btn-lg">
              {dict.home.heroPrimary}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href={localePath(locale, "/sell")} className="btn-gold btn-lg">
              {dict.nav.sell}
            </Link>
          </div>

          <div data-hero-fade data-hero-hide className="mt-10 max-w-xl border-t border-navy-900/10 pt-7">
            <RefSearch
              locale={locale}
              variant="panel"
              labels={{ ...dict.search, hint: dict.search.byNumberHint, placeholder: `${settings.propertyPrefix}-0001` }}
            />
            {types.length ? (
              <ul className="mt-5 flex flex-wrap gap-2">
                {types.map((t) => (
                  <li key={t}>
                    <Link
                      href={`${propertiesHref}?type=${t}`}
                      className="inline-flex min-h-9 items-center rounded-[3px] border border-navy-900/15 bg-paper-0 px-3 text-[13px] font-medium text-ink-700 transition-colors hover:border-navy-800 hover:text-navy-900"
                    >
                      {dict.types.plural[t]}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="mx-auto w-full max-w-[500px] lg:mx-0 lg:justify-self-end">
          <Sheet locale={locale} dict={dict} settings={settings} specimen={specimen} />
        </div>
      </HeroMotion>

      {settings.heroImage ? (
        <div className="container-x relative pb-14 sm:pb-20">
          <div className="relative aspect-[16/9] overflow-hidden border border-navy-900/10 sm:aspect-[21/9]">
            <Image src={settings.heroImage} alt="" fill sizes="(min-width: 1280px) 1240px, 100vw" className="object-cover" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
