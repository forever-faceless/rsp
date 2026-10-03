import { ArrowLeft, ArrowRight, Check, ExternalLink, FileCheck2, MapPin, MessageSquareText, Navigation } from "lucide-react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { MapLoader } from "@/components/map/MapLoader";
import type { MapLine, MapPin as Pin, MapPlot } from "@/components/map/MapView";
import { PageCurtain } from "@/components/motion/PageCurtain";
import { Reveal } from "@/components/motion/Reveal";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { EnquireLink, EnquireOverlay } from "@/components/site/EnquireOverlay";
import { EnquiryPanel } from "@/components/site/EnquiryPanel";
import { Gallery } from "@/components/site/Gallery";
import { InterestCard } from "@/components/site/InterestCard";
import { computeDistances, LandmarkList, MeasuredList } from "@/components/site/LandmarkList";
import { ListingCard } from "@/components/site/ListingCard";
import { CallButton, WhatsAppButton } from "@/components/site/PhoneLinks";
import { PlanPanel } from "@/components/site/PlanPanel";
import { ShareButtons } from "@/components/site/ShareButtons";
import { ListingStatusBadge, SoldStamp } from "@/components/site/StatusBadge";
import { VideoGallery } from "@/components/site/VideoGallery";
import { getSettings, listPropertyCorners, searchListings } from "@/lib/db/queries";
import { formatCoords, formatFeet, googleDirectionsLink, googleMapsLink } from "@/lib/geo";
import { fill, getDictionary, isLocale, localePath, pick, pickItem } from "@/lib/i18n";
import { lookupListing } from "@/lib/listing-detail";
import { planFromCorners, planFromDimensions } from "@/lib/plan";
import { formatSiteNo } from "@/lib/refs";
import { measureDistance, measureFt, surveySides } from "@/lib/survey";
import { formatMetres } from "@/lib/units";
import { cn, formatArea, formatINR, formatINRShort, formatNumber, telHref } from "@/lib/utils";

type Props = {
  locale: string;
  rawRef: string;
  /** True on the …/interest address: the listing with the quick enquiry card already open over it. */
  interest?: boolean;
  /** Where a shared quick enquiry link was posted, kept with the enquiry. */
  from?: string;
};

/** A listing's page. The listing address and its …/interest address both render this. */
export async function ListingView({ locale, rawRef, interest = false, from = "" }: Props) {
  if (!isLocale(locale)) notFound();
  const found = await lookupListing(rawRef);
  if (found.type === "project") permanentRedirect(localePath(locale, `/projects/${found.slug}`));
  if (found.type !== "listing") notFound();
  const d = found.detail;
  // One address per listing: "HSN-34(12)" and similar spellings all land on the canonical one.
  if (decodeURIComponent(rawRef) !== d.slug) permanentRedirect(localePath(locale, `/properties/${d.slug}${interest ? "/interest" : ""}`));

  const dict = getDictionary(locale);
  const settings = await getSettings();
  const isSite = d.kind === "site";
  const name = pick(d, "title", locale);
  const siteLabel = isSite ? `${dict.common.site} ${formatSiteNo(d.siteNo ?? 0)}` : "";
  const heading = isSite ? siteLabel : name;
  const location = pick(d, "location", locale);
  const description = pick(d, "description", locale);
  const pageHref = localePath(locale, `/properties/${d.slug}`);
  // Every "enquire" on this page opens the quick enquiry card over it, at this address.
  const interestHref = `${pageHref}/interest`;
  const enquirySource = interest ? `${interestHref}${from ? `?from=${from}` : ""}` : pageHref;
  // The card's language switch keeps the tag of the link it was opened from.
  const languageHrefs = {
    en: `${localePath("en", `/properties/${d.slug}/interest`)}${from ? `?from=${from}` : ""}`,
    kn: `${localePath("kn", `/properties/${d.slug}/interest`)}${from ? `?from=${from}` : ""}`,
  };
  const projectHref = d.project ? localePath(locale, `/projects/${d.project.slug}`) : null;
  const subjectLabel = `${d.ref}, ${name}`;
  const wa = settings.whatsapp || settings.phonePrimary;
  const waText = fill(dict.enquiry.whatsappPrefill, { subject: subjectLabel });
  const subject = { ref: d.ref, label: subjectLabel, ...d.ids };

  // ---------- site plan
  const corners = d.geometry?.corners ?? [];
  const shape = (corners.length >= 3 ? planFromCorners(corners) : null) ?? planFromDimensions(d.widthFt, d.depthFt, d.facing);
  const surveyed = corners.length >= 3;
  // The area entered on the listing is the one shown, so a figure from the deed can correct what GPS gave.
  const planArea = d.areaSqft ? formatArea(d.areaSqft, d.areaUnit, locale) : surveyed && d.surveyAreaSqft ? formatArea(d.surveyAreaSqft, d.areaUnit, locale) : undefined;
  const perimeter = surveyed ? d.surveyPerimeterFt : shape ? shape.sidesFt.reduce((a, b) => a + b, 0) : null;

  // ---------- facts
  const landType = d.type === "farm_land";
  const facts: { label: string; value: string }[] = [
    { label: dict.property.type, value: isSite ? dict.types.residential_site : dict.types[d.type] },
    { label: dict.property.dimension, value: d.dimension ? `${d.dimension} ${dict.common.ft}` : "" },
    { label: landType ? dict.property.landArea : dict.property.area, value: d.areaSqft ? formatArea(d.areaSqft, d.areaUnit, locale) : "" },
    { label: dict.property.builtUp, value: d.builtUpSqft ? formatArea(d.builtUpSqft, "sqft", locale) : "" },
    { label: dict.property.bedrooms, value: d.bedrooms ? String(d.bedrooms) : "" },
    { label: dict.property.floors, value: d.floors ? String(d.floors) : "" },
    { label: dict.facing.label, value: d.facing ? dict.facing[d.facing] : "" },
    { label: dict.common.cornerSite, value: d.corner ? dict.common.yes : "" },
    { label: dict.property.ratePerSqft, value: d.pricePerSqft ? `₹${formatNumber(d.pricePerSqft)} ${dict.common.perSqft}` : "" },
  ].filter((f) => f.value);

  // The particulars are laid out so that every row is full: the cells of a row share its width,
  // and the rows are kept as even as the count allows. Four facts make one row of four, not four
  // cells and a gap; six make two rows of three.
  const perRow = (most: number) => Math.ceil(facts.length / Math.ceil(facts.length / most));
  const factWidth = cn(
    ["", "basis-full", "basis-1/2"][perRow(2)],
    ["", "sm:basis-full", "sm:basis-1/2", "sm:basis-1/3"][perRow(3)],
    ["", "lg:basis-full", "lg:basis-1/2", "lg:basis-1/3", "lg:basis-1/4", "lg:basis-1/5"][perRow(5)],
  );

  // ---------- map
  const distances = d.pin ? computeDistances(d.pin, d.landmarks, locale) : [];
  // The places the survey measured to, nearest first, so nobody has to follow the lines across the map.
  const measured = (d.geometry?.measures ?? [])
    .filter((m) => m.label.trim())
    .map((m) => ({ id: m.id, name: m.label.trim(), ft: measureFt(m) }))
    .sort((a, b) => a.ft - b.ft)
    .map((m) => ({ id: m.id, name: m.name, distance: formatMetres(m.ft, locale) }));
  const hasNearby = measured.length > 0 || distances.length > 0;
  const plots: MapPlot[] = surveyed ? [{ id: "plot", corners, label: d.ref, status: d.status, active: true, sideLabels: surveySides(corners).map((s) => formatFeet(s.ft)) }] : [];
  const lines: MapLine[] = [
    ...(d.geometry?.measures ?? []).map((m) => ({ id: m.id, a: m.a, b: m.b, label: measureDistance(m), endLabel: m.label || undefined })),
    ...(d.pin ? distances.map((x) => ({ id: `lm-${x.landmark.id}`, a: d.pin!, b: { lat: x.landmark.lat, lng: x.landmark.lng }, dashed: true })) : []),
  ];
  const pins: Pin[] = [
    // The pin is the property's location, so it is always on the map, with its name on it.
    ...(d.pin ? [{ id: "main", lat: d.pin.lat, lng: d.pin.lng, label: d.pinIsExact ? d.ref : name, sub: location, kind: "main" as const, tag: d.pinLabel || (d.pinIsExact ? d.ref : name) }] : []),
    ...(d.geometry?.points ?? []).map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, label: p.label || d.ref, kind: "point" as const })),
    ...distances.map((x) => ({ id: `lm-${x.landmark.id}`, lat: x.landmark.lat, lng: x.landmark.lng, label: pick(x.landmark, "name", locale), sub: `${x.distance} · ${x.drive}`, kind: "landmark" as const })),
  ];

  // ---------- related
  const related = (await searchListings(isSite ? { scope: "projects", status: "available" } : { scope: "independent", type: d.type, status: "available" }))
    .filter((l) => (isSite ? l.prefix === d.prefix && l.propertyNo === d.propertyNo && l.siteNo !== d.siteNo : !(l.prefix === d.prefix && l.propertyNo === d.propertyNo)))
    .slice(0, 3);
  const relatedCorners = await listPropertyCorners(related.filter((l) => l.kind === "property").map((l) => l.id));

  const paragraphs = description.split(/\n{2,}/).filter(Boolean);
  const hasAbout = paragraphs.length > 0 || d.features.length > 0 || d.documents.length > 0;

  return (
    <>
      {/* Someone arriving on a shared enquiry link goes straight to the card, without the opening curtain. */}
      {interest ? null : <PageCurtain mode="lift" label={d.ref} caption={dict.loader.opening} />}
      <EnquireOverlay interestPath={interestHref} listingPath={pageHref} closeLabel={dict.interest.close}>
        <InterestCard d={d} dict={dict} locale={locale} settings={settings} source={enquirySource} listingPath={pageHref} languageHrefs={languageHrefs} />
      </EnquireOverlay>

      {/* ---------- Heading ---------- */}
      <section className="bg-grid relative border-b border-navy-900/10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,transparent_20%,var(--color-paper-50)_75%)]" aria-hidden="true" />
        <div className="container-x relative py-8 sm:py-12">
          <Breadcrumbs
            items={[
              { href: localePath(locale), label: dict.nav.home },
              ...(d.project && projectHref
                ? [{ href: localePath(locale, "/projects"), label: dict.nav.projects }, { href: projectHref, label: name }]
                : [{ href: localePath(locale, "/properties"), label: dict.nav.properties }]),
              { label: d.ref },
            ]}
          />

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end lg:gap-14">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="ref ref-lg">{d.ref}</span>
                <ListingStatusBadge status={d.status} label={dict.status.listing[d.status]} />
                {d.corner ? <span className="badge bg-gold-100 text-gold-800">{dict.common.cornerSite}</span> : null}
              </div>
              <h1 className="display-1 mt-5">{heading}</h1>
              <p className="mt-3 text-[1.05rem] text-ink-600">
                {isSite && projectHref ? (
                  <Link href={projectHref} className="font-semibold text-navy-800 underline decoration-gold-500 decoration-2 underline-offset-4">
                    {name}
                  </Link>
                ) : (
                  <span className="font-medium">{dict.types[d.type]}</span>
                )}
                {location ? (
                  <span className="ml-3 inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-gold-600" aria-hidden="true" />
                    {location}
                  </span>
                ) : null}
              </p>
              <p className="mt-4 max-w-xl text-[14.5px] text-ink-500">{dict.property.statusNote[d.status]}</p>
              <ShareButtons
                className="mt-6"
                path={pageHref}
                text={`${d.ref} · ${isSite ? `${siteLabel}, ${name}` : name}`}
                labels={{ whatsapp: dict.common.shareWhatsApp, copy: dict.common.copyLink, copied: dict.common.linkCopied }}
              />
            </div>

            <div className="card relative overflow-hidden p-5 shadow-card sm:p-6">
              {d.status === "sold" ? <SoldStamp label={dict.status.listing.sold} className="sold-stamp-corner" /> : null}
              {/* The listing chooses what to show: the total, the rate per square foot, or both. */}
              <p className="label-mono">{d.price || !d.pricePerSqft ? dict.property.totalPrice : dict.property.ratePerSqft}</p>
              <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {d.price ? (
                  <span className="font-display text-[2.3rem] font-semibold leading-none text-navy-900 [font-stretch:110%]">{formatINRShort(d.price, locale)}</span>
                ) : d.pricePerSqft ? (
                  <>
                    <span className="font-display text-[2.3rem] font-semibold leading-none text-navy-900 [font-stretch:110%]">₹{formatNumber(d.pricePerSqft)}</span>
                    <span className="num text-[13.5px] text-ink-500">{dict.common.perSqft}</span>
                  </>
                ) : settings.phonePrimary ? (
                  <a href={telHref(settings.phonePrimary)} className="font-display text-[1.9rem] font-semibold leading-tight text-navy-900 underline decoration-gold-500 decoration-2 underline-offset-[6px] [font-stretch:110%] hover:decoration-navy-900">
                    {dict.common.onRequest}
                  </a>
                ) : (
                  <span className="font-display text-[1.9rem] font-semibold leading-tight text-navy-900 [font-stretch:110%]">{dict.common.onRequest}</span>
                )}
                {d.price ? <span className="num text-[13.5px] text-ink-500">{formatINR(d.price)}</span> : null}
              </p>
              {(d.price && d.pricePerSqft) || d.negotiable ? (
                <p className="mt-2 text-[13.5px] text-ink-600">
                  {d.price && d.pricePerSqft ? (
                    <span className="num">
                      ₹{formatNumber(d.pricePerSqft)} {dict.common.perSqft}
                    </span>
                  ) : null}
                  {d.price && d.pricePerSqft && d.negotiable ? " · " : ""}
                  {d.negotiable ? dict.common.negotiable : ""}
                </p>
              ) : null}
              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <EnquireLink href={interestHref} className="btn-primary">
                  <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                  {dict.common.enquireNow}
                </EnquireLink>
                <WhatsAppButton phone={wa} label={dict.common.whatsapp} text={waText} variant="outline" />
              </div>
              <CallButton phone={settings.phonePrimary} variant="ghost" className="mt-2 w-full !justify-start" />
            </div>
          </div>
        </div>
      </section>

      <div className="container-x space-y-16 py-10 sm:space-y-24 sm:py-16">
        {/* ---------- Photographs ---------- */}
        {d.images.length ? (
          <Reveal>
            <Gallery images={d.images} alt={`${d.ref} ${heading}`} labels={{ photos: dict.common.photos, previous: dict.common.previous, next: dict.common.next, close: dict.nav.close }} />
          </Reveal>
        ) : null}

        {/* ---------- Particulars ---------- */}
        {facts.length ? (
          <Reveal as="dl" mode="children" stagger={0.05} className="flex flex-wrap border-l border-t border-navy-900/12">
            {facts.map((f) => (
              <div key={f.label} className={cn("min-w-0 grow border-b border-r border-navy-900/12 bg-paper-0 px-4 py-5 sm:px-5", factWidth)}>
                <dt className="label-mono">{f.label}</dt>
                <dd className="num mt-2 text-[1.05rem] font-semibold text-navy-900">{f.value}</dd>
              </div>
            ))}
          </Reveal>
        ) : null}

        {/* ---------- Description and enquiry ----------
            Only when something has been written about the property. With nothing to say, the block
            is left out and the enquiry form at the foot of the page does the asking. */}
        {hasAbout ? (
          <section className="max-w-4xl">
            <div className="space-y-12">
              {paragraphs.length ? (
                <Reveal>
                  <h2 className="display-3">{dict.property.overview}</h2>
                  <div className="prose-soft mt-5 text-[1.02rem] leading-relaxed text-ink-700">
                    {paragraphs.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                </Reveal>
              ) : null}

              {d.features.length ? (
                <Reveal>
                  <h2 className="display-3">{dict.property.highlights}</h2>
                  <ul className="mt-5 grid gap-x-8 sm:grid-cols-2">
                    {d.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-3 border-b border-navy-900/8 py-3.5 text-[15px] text-ink-700">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
                        {pickItem(f, locale)}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              ) : null}

              {d.documents.length ? (
                <Reveal>
                  <h2 className="display-3 flex items-center gap-3">
                    <FileCheck2 className="h-5 w-5 text-gold-600" aria-hidden="true" />
                    {isSite ? dict.projects.approvals : dict.property.documents}
                  </h2>
                  <ul className="mt-5 border-t border-navy-900/10">
                    {d.documents.map((a, i) => (
                      <li key={i} className="flex flex-col gap-1 border-b border-navy-900/10 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                        <span className="text-[15px] font-medium text-navy-900">{pickItem(a, locale)}</span>
                        {a.number ? <span className="num text-[12.5px] text-ink-500">{a.number}</span> : null}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-[13px] leading-relaxed text-ink-500">{isSite ? dict.projects.approvalsNote : dict.property.documentsNote}</p>
                </Reveal>
              ) : null}

            </div>

            {projectHref ? (
              <Link href={projectHref} className="btn-ghost mt-8 !justify-start text-[14px]">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {dict.site.backToProject}
              </Link>
            ) : null}
          </section>
        ) : null}

        {/* ---------- Location ---------- */}
        {d.pin ? (
          <section>
            <Reveal className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="display-2">{dict.property.location}</h2>
                <p className="mt-3 max-w-xl text-[15px] text-ink-600">{d.pinIsExact ? dict.property.locationText : dict.projects.mapText}</p>
                <p className="num mt-3 text-[13px] text-ink-500">
                  {dict.property.coordinates}: {formatCoords(d.pin.lat, d.pin.lng)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={googleMapsLink(d.pin.lat, d.pin.lng)} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  {dict.common.openInMaps}
                </a>
                <a href={googleDirectionsLink(d.pin.lat, d.pin.lng)} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm">
                  <Navigation className="h-4 w-4" aria-hidden="true" />
                  {dict.common.directions}
                </a>
              </div>
            </Reveal>
            <Reveal className={cn("mt-8 grid gap-6", hasNearby && "lg:grid-cols-[1.4fr_0.6fr]")}>
              <div className="card h-[380px] overflow-hidden sm:h-[460px] lg:h-[540px]">
                <MapLoader
                  pins={pins}
                  plots={plots}
                  lines={lines}
                  base={surveyed ? "satellite" : "map"}
                  fit="focus"
                  maxFitZoom={surveyed ? 21 : 16}
                  labels={{ map: dict.common.map, satellite: dict.common.satellite, interact: dict.common.useMap }}
                />
              </div>
              {hasNearby ? (
                <div className="card p-5 sm:p-6">
                  <h3 className="text-[1.2rem]">{dict.property.nearby}</h3>
                  <p className="mt-1 text-[12.5px] text-ink-500">{distances.length ? (isSite ? dict.projects.nearbyText : dict.property.nearbyText) : dict.property.measuredText}</p>
                  <div className={cn("mt-3", measured.length > 0 && distances.length > 0 && "divide-y divide-navy-900/8")}>
                    <MeasuredList items={measured} />
                    <LandmarkList items={distances} locale={locale} dict={dict} />
                  </div>
                </div>
              ) : null}
            </Reveal>
          </section>
        ) : null}

        {/* ---------- Site plan ---------- */}
        {shape ? (
          <section>
            <Reveal>
              <p className="eyebrow">{d.ref}</p>
              <h2 className="display-2 mt-4">{dict.property.plan}</h2>
            </Reveal>
            <Reveal className="mt-8">
              <PlanPanel
                dict={dict}
                shape={shape}
                refText={d.ref}
                areaLabel={planArea}
                perimeterFt={perimeter}
                roadLabel={d.roadWidthFt ? `${formatFeet(d.roadWidthFt)} ${dict.projects.road}` : undefined}
              />
            </Reveal>
          </section>
        ) : null}

        {/* ---------- Video ---------- */}
        {d.videos.length ? (
          <section>
            <Reveal>
              <h2 className="display-2">{d.videos.length > 1 ? dict.common.videos : dict.common.video}</h2>
            </Reveal>
            <Reveal className="mt-8">
              <VideoGallery videos={d.videos} title={d.ref} watchLabel={dict.common.watchVideo} />
            </Reveal>
          </section>
        ) : null}

        {/* ---------- Enquiry ---------- */}
        <Reveal>
          <EnquiryPanel locale={locale} dict={dict} settings={settings} subject={subject} source={pageHref} title={fill(dict.property.enquireTitle, { ref: d.ref })} text={dict.property.enquireText} id="enquire" href={interestHref} />
        </Reveal>

        {/* ---------- Related ---------- */}
        {related.length ? (
          <section>
            <Reveal className="flex items-end justify-between gap-4">
              <h2 className="display-2">{isSite ? dict.site.otherSites : dict.property.similar}</h2>
              <Link href={isSite && projectHref ? `${projectHref}#sites` : localePath(locale, `/properties?type=${d.type}`)} className="link-arrow hidden shrink-0 sm:inline-flex">
                {dict.common.viewAll}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Reveal>
            <Reveal mode="children" stagger={0.1} className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((l) => (
                <ListingCard key={`${l.kind}-${l.id}`} listing={l} locale={locale} dict={dict} corners={l.kind === "property" ? relatedCorners.get(l.id) : null} />
              ))}
            </Reveal>
          </section>
        ) : null}
      </div>
    </>
  );
}
