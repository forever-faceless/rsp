import { Check, Download, ExternalLink, FileCheck2, MapPin, MessageSquareText, Navigation } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { MapLoader } from "@/components/map/MapLoader";
import type { MapPin as Pin, MapPlot } from "@/components/map/MapView";
import { PageCurtain } from "@/components/motion/PageCurtain";
import { Reveal } from "@/components/motion/Reveal";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { EnquiryPanel } from "@/components/site/EnquiryPanel";
import { Gallery } from "@/components/site/Gallery";
import { CtaBand } from "@/components/site/HomeSections";
import { computeDistances, LandmarkList } from "@/components/site/LandmarkList";
import { CallButton, WhatsAppButton } from "@/components/site/PhoneLinks";
import { ShareButtons } from "@/components/site/ShareButtons";
import { SiteTable, type SiteRow } from "@/components/site/SiteTable";
import { ProjectStatusBadge } from "@/components/site/StatusBadge";
import { VideoGallery } from "@/components/site/VideoGallery";
import { getProjectBySlug, getSettings, getSurveyFor, listLandmarks, listSites, listSiteSurveys } from "@/lib/db/queries";
import { centroid, formatCoords, googleDirectionsLink, googleMapsLink, isValidLatLng } from "@/lib/geo";
import { fill, getDictionary, isLocale, localePath, pick, pickItem } from "@/lib/i18n";
import { publicPrice } from "@/lib/pricing";
import { formatPropertyNo, formatSiteRef, refSlug } from "@/lib/refs";
import { cn, formatINRShort, formatNumber } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/projects/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const project = await getProjectBySlug(slug);
  if (!project) return {};
  return {
    title: pick(project, "name", locale),
    description: pick(project, "tagline", locale) || pick(project, "description", locale).slice(0, 160),
    alternates: { canonical: `/${locale}/projects/${project.slug}`, languages: { en: `/en/projects/${project.slug}`, kn: `/kn/projects/${project.slug}` } },
    openGraph: {
      type: "website",
      siteName: getDictionary(locale).meta.siteName,
      locale: locale === "kn" ? "kn_IN" : "en_IN",
      url: `/${locale}/projects/${project.slug}`,
      images: [project.coverImage ? { url: project.coverImage } : { url: "/brand/og.png", width: 1200, height: 630 }],
    },
  };
}

export default async function ProjectPage({ params }: PageProps<"/[locale]/projects/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const project = await getProjectBySlug(slug);
  if (!project) notFound();
  const [settings, landmarks, sites, boundary, siteSurveys] = await Promise.all([
    getSettings(),
    listLandmarks({ projectId: project.id }),
    listSites(project.id),
    getSurveyFor({ projectId: project.id }),
    listSiteSurveys(project.id),
  ]);

  const prefix = project.prefix;
  const ref = formatPropertyNo(prefix, project.propertyNo);
  const name = pick(project, "name", locale);
  const tagline = pick(project, "tagline", locale);
  const location = pick(project, "location", locale);
  const projectHref = localePath(locale, `/projects/${project.slug}`);
  const siteHref = (siteNo: number) => localePath(locale, `/properties/${refSlug(prefix, project.propertyNo, siteNo)}`);

  const outline = boundary && boundary.corners.length >= 3 ? boundary.corners : null;
  const origin = isValidLatLng(project.lat, project.lng) ? { lat: project.lat!, lng: project.lng! } : outline ? centroid(outline) : null;
  const distances = origin ? computeDistances(origin, landmarks, locale) : [];
  const images = [project.coverImage, ...project.gallery.filter((g) => g !== project.coverImage)].filter(Boolean);
  const available = project.status === "sold_out" ? 0 : sites.filter((s) => s.status === "available").length;
  const totalSites = project.totalSites ?? sites.length;
  const paragraphs = pick(project, "description", locale).split(/\n{2,}/).filter(Boolean);
  const wa = settings.whatsapp || settings.phonePrimary;
  const subject = { label: `${ref}, ${name}`, projectId: project.id };

  const rows: SiteRow[] = sites.map((s) => ({
    id: s.id,
    siteNo: s.siteNo,
    refText: formatSiteRef(prefix, project.propertyNo, s.siteNo),
    dimension: s.dimension,
    areaSqft: s.areaSqft,
    facing: s.facing,
    roadWidthFt: s.roadWidthFt,
    corner: s.corner,
    status: s.status,
    ...publicPrice(s, project.callForPrice || s.callForPrice),
    href: siteHref(s.siteNo),
  }));

  // Sites with a surveyed boundary are drawn as plots; the rest that have a pin show as dots.
  const plots: MapPlot[] = [
    ...(outline ? [{ id: "boundary", corners: outline, outline: true }] : []),
    ...sites.flatMap((s) => {
      const survey = siteSurveys.get(s.id);
      if (!survey || survey.corners.length < 3) return [];
      return [{ id: `site-${s.id}`, corners: survey.corners, label: formatSiteRef(prefix, project.propertyNo, s.siteNo), status: s.status, href: siteHref(s.siteNo), linkText: dict.common.viewDetails }];
    }),
  ];
  const plotted = new Set(plots.map((p) => p.id));
  const pins: Pin[] = [
    ...(origin && !outline && plots.length === 0 ? [{ id: "main", lat: origin.lat, lng: origin.lng, label: name, sub: location, kind: "main" as const }] : []),
    ...sites
      .filter((s) => !plotted.has(`site-${s.id}`) && isValidLatLng(s.lat, s.lng))
      .map((s) => ({
        id: `site-${s.id}`,
        lat: s.lat!,
        lng: s.lng!,
        kind: "listing" as const,
        status: s.status,
        label: formatSiteRef(prefix, project.propertyNo, s.siteNo),
        sub: [s.dimension ? `${s.dimension} ${dict.common.ft}` : "", dict.status.listing[s.status]].filter(Boolean).join(" · "),
        href: siteHref(s.siteNo),
        linkText: dict.common.viewDetails,
      })),
    ...distances.map((x) => ({ id: `lm-${x.landmark.id}`, lat: x.landmark.lat, lng: x.landmark.lng, label: pick(x.landmark, "name", locale), sub: `${x.distance} · ${x.drive}`, kind: "landmark" as const })),
  ];
  const lines = origin ? distances.map((x) => ({ id: `lm-${x.landmark.id}`, a: origin, b: { lat: x.landmark.lat, lng: x.landmark.lng }, dashed: true })) : [];
  const hasPlots = plots.length > 0;

  const facts = [
    { label: dict.projects.totalSites, value: totalSites ? formatNumber(totalSites) : "" },
    { label: dict.projects.availableSites, value: sites.length || project.status === "sold_out" ? formatNumber(available) : "" },
    { label: dict.projects.area, value: project.totalAreaAcres ? `${project.totalAreaAcres} ${dict.common.acres}` : "" },
    {
      label: dict.projects.priceFrom,
      value: project.callForPrice ? dict.common.onRequest : project.priceFrom ? formatINRShort(project.priceFrom, locale) : project.pricePerSqft ? `₹${formatNumber(project.pricePerSqft)} ${dict.common.perSqft}` : dict.common.onRequest,
    },
  ].filter((f) => f.value);

  return (
    <>
      <PageCurtain mode="lift" label={ref} caption={dict.loader.opening} />

      {/* ---------- Heading ---------- */}
      <section className="surface-navy bg-grid-dark relative">
        <div className="container-x relative py-8 sm:py-12">
          <Breadcrumbs tone="dark" items={[{ href: localePath(locale), label: dict.nav.home }, { href: localePath(locale, "/projects"), label: dict.nav.projects }, { label: name }]} />
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end lg:gap-14">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="ref ref-lg !bg-gold-400 !text-navy-950">{ref}</span>
                <ProjectStatusBadge status={project.status} label={dict.status.project[project.status]} />
              </div>
              <h1 className="display-1 mt-5 !text-paper-50">{name}</h1>
              {tagline ? <p className="mt-4 max-w-2xl text-[1.1rem] leading-relaxed text-navy-200">{tagline}</p> : null}
              {location ? (
                <p className="mt-4 inline-flex items-center gap-2 text-[15px] text-gold-200">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {location}
                </p>
              ) : null}
              <ShareButtons className="mt-6" tone="dark" path={projectHref} text={`${ref} · ${name}`} labels={{ whatsapp: dict.common.shareWhatsApp, copy: dict.common.copyLink, copied: dict.common.linkCopied }} />
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row lg:flex-col lg:items-stretch">
              <a href="#enquire" className="btn-gold">
                <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                {dict.projects.enquireProject}
              </a>
              <CallButton phone={settings.phonePrimary} variant="outline-light" />
              <WhatsAppButton phone={wa} label={dict.common.whatsapp} text={fill(dict.enquiry.whatsappPrefill, { subject: subject.label })} variant="outline-light" />
            </div>
          </div>
        </div>
        {facts.length ? (
          <div className="border-t border-paper-0/10">
            <dl className={cn("container-x grid grid-cols-2 gap-y-5 py-6", facts.length >= 4 ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
              {facts.map((f) => (
                <div key={f.label} className="border-l border-gold-400/35 pl-4">
                  <dt className="label-mono !text-navy-300">{f.label}</dt>
                  <dd className="num mt-1.5 text-[1.25rem] font-medium text-gold-200">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </section>

      <div className="container-x space-y-16 py-10 sm:space-y-24 sm:py-16">
        {images.length ? (
          <Reveal>
            <Gallery images={images} alt={name} labels={{ photos: dict.common.photos, previous: dict.common.previous, next: dict.common.next, close: dict.nav.close }} />
          </Reveal>
        ) : null}

        {/* ---------- Overview ---------- */}
        <section className="grid gap-12 lg:grid-cols-[1.3fr_0.7fr] lg:gap-16">
          <div className="space-y-12">
            <Reveal>
              <p className="eyebrow">{dict.projects.overview}</p>
              <div className="prose-soft mt-5 text-[1.05rem] leading-relaxed text-ink-700">
                {paragraphs.length ? paragraphs.map((p, i) => <p key={i}>{p}</p>) : <p>{tagline || dict.projects.subtitle}</p>}
              </div>
            </Reveal>

            {project.amenities.length ? (
              <Reveal>
                <h2 className="display-3">{dict.projects.amenities}</h2>
                <ul className="mt-5 grid gap-x-8 sm:grid-cols-2">
                  {project.amenities.map((a, i) => (
                    <li key={i} className="flex items-start gap-3 border-b border-navy-900/8 py-3.5 text-[15px] text-ink-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
                      {pickItem(a, locale)}
                    </li>
                  ))}
                </ul>
              </Reveal>
            ) : null}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
            {project.approvals.length ? (
              <Reveal className="card p-5 sm:p-6">
                <h2 className="flex items-center gap-2.5 text-[1.2rem]">
                  <FileCheck2 className="h-5 w-5 text-gold-600" aria-hidden="true" />
                  {dict.projects.approvals}
                </h2>
                <ul className="mt-4">
                  {project.approvals.map((a, i) => (
                    <li key={i} className="border-t border-navy-900/8 py-3 first:border-t-0 first:pt-0">
                      <p className="text-[14.5px] font-semibold text-navy-900">{pickItem(a, locale)}</p>
                      {a.number ? <p className="num mt-0.5 text-[12px] text-ink-500">{a.number}</p> : null}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 border-t border-navy-900/8 pt-3 text-[12.5px] leading-relaxed text-ink-500">{dict.projects.approvalsNote}</p>
              </Reveal>
            ) : null}
            {project.brochureUrl ? (
              <a href={project.brochureUrl} target="_blank" rel="noopener noreferrer" className="btn-primary w-full !justify-start">
                <Download className="h-4 w-4" aria-hidden="true" />
                {dict.projects.brochure}
              </a>
            ) : null}
          </aside>
        </section>

        {/* ---------- Layout plan ---------- */}
        {project.layoutPlanImage ? (
          <section>
            <Reveal>
              <h2 className="display-2">{dict.projects.layoutPlan}</h2>
            </Reveal>
            <Reveal className="mt-8">
              <a href={project.layoutPlanImage} target="_blank" rel="noopener noreferrer" className="card block overflow-hidden">
                <div className="relative aspect-[16/11] bg-paper-100">
                  <Image src={project.layoutPlanImage} alt={`${name} ${dict.projects.layoutPlan}`} fill sizes="(min-width: 1280px) 1200px, 100vw" className="object-contain" />
                </div>
              </a>
            </Reveal>
          </section>
        ) : null}

        {/* ---------- Video ---------- */}
        {project.videos.length ? (
          <section>
            <Reveal>
              <h2 className="display-2">{project.videos.length > 1 ? dict.common.videos : dict.common.video}</h2>
            </Reveal>
            <Reveal className="mt-8">
              <VideoGallery videos={project.videos} title={name} watchLabel={dict.common.watchVideo} />
            </Reveal>
          </section>
        ) : null}

        {/* ---------- Location ---------- */}
        {origin ? (
          <section>
            <Reveal className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="display-2">{dict.projects.mapTitle}</h2>
                <p className="mt-3 max-w-xl text-[15px] text-ink-600">{dict.projects.mapText}</p>
                <p className="num mt-3 text-[13px] text-ink-500">
                  {dict.property.coordinates}: {formatCoords(origin.lat, origin.lng)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={googleMapsLink(origin.lat, origin.lng)} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  {dict.common.openInMaps}
                </a>
                <a href={googleDirectionsLink(origin.lat, origin.lng)} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm">
                  <Navigation className="h-4 w-4" aria-hidden="true" />
                  {dict.common.directions}
                </a>
              </div>
            </Reveal>
            <Reveal className={cn("mt-8 grid gap-6", distances.length > 0 && "lg:grid-cols-[1.4fr_0.6fr]")}>
              <div className="card h-[400px] overflow-hidden sm:h-[480px] lg:h-[560px]">
                <MapLoader
                  pins={pins}
                  plots={plots}
                  lines={lines}
                  base={hasPlots ? "satellite" : "map"}
                  fit="focus"
                  maxFitZoom={hasPlots ? 19 : 16}
                  labels={{ map: dict.common.map, satellite: dict.common.satellite, interact: dict.common.useMap, close: dict.common.closeMap, expand: dict.common.fullScreen }}
                />
              </div>
              {distances.length ? (
                <div className="card p-5 sm:p-6">
                  <h3 className="text-[1.2rem]">{dict.projects.nearby}</h3>
                  <p className="mt-1 text-[12.5px] text-ink-500">{dict.projects.nearbyText}</p>
                  <div className="mt-3">
                    <LandmarkList items={distances} locale={locale} dict={dict} />
                  </div>
                </div>
              ) : null}
            </Reveal>
          </section>
        ) : null}

        {/* ---------- Sites ---------- */}
        <section id="sites" className="scroll-mt-28">
          <Reveal>
            <p className="eyebrow">{ref}</p>
            <h2 className="display-2 mt-4">{dict.projects.sitesTitle}</h2>
            <p className="mt-3 text-[15px] text-ink-600">{dict.projects.sitesSubtitle}</p>
          </Reveal>
          <Reveal className="mt-8">
            {sites.length ? (
              <SiteTable
                sites={rows}
                locale={locale}
                labels={{
                  siteNo: dict.common.propertyNo,
                  dimension: dict.projects.dimension,
                  area: dict.projects.areaSqft,
                  facing: dict.facing.label,
                  road: dict.projects.road,
                  price: dict.common.price,
                  status: dict.projects.projectStatus,
                  onlyAvailable: dict.projects.onlyAvailable,
                  facingFilter: dict.projects.facingFilter,
                  dimensionFilter: dict.projects.dimensionFilter,
                  all: dict.common.all,
                  clear: dict.common.clear,
                  noResults: dict.common.noResults,
                  showing: dict.projects.showingSites,
                  showAll: dict.projects.showAllSites,
                  corner: dict.common.corner,
                  onRequest: dict.common.onRequest,
                  perSqft: dict.common.perSqft,
                  sqft: dict.common.sqft,
                  ft: dict.common.ft,
                  statusLabels: dict.status.listing,
                  facingLabels: dict.facing,
                }}
              />
            ) : (
              <p className="card p-10 text-center text-ink-600">{project.status === "sold_out" ? dict.projects.allSold : dict.projects.noSites}</p>
            )}
          </Reveal>
        </section>

        <Reveal>
          <EnquiryPanel locale={locale} dict={dict} settings={settings} subject={subject} source={projectHref} title={dict.projects.enquireProject} />
        </Reveal>
      </div>

      <CtaBand locale={locale} dict={dict} settings={settings} subject={name} />
    </>
  );
}
