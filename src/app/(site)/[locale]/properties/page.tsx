import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapLoader } from "@/components/map/MapLoader";
import type { MapPin } from "@/components/map/MapView";
import { Reveal } from "@/components/motion/Reveal";
import { CtaBand } from "@/components/site/HomeSections";
import { ListingCard, listingHref } from "@/components/site/ListingCard";
import { ListingFilters, type FilterValues } from "@/components/site/ListingFilters";
import { PageIntro } from "@/components/site/PageIntro";
import { FACINGS, LISTING_STATUSES, PROPERTY_TYPES, type Facing, type ListingStatus, type PropertyType } from "@/lib/db/enums";
import { getSettings, listActiveRegions, listPropertyCorners, searchListings, type ListingFilters as Filters } from "@/lib/db/queries";
import { isValidLatLng } from "@/lib/geo";
import { fill, getDictionary, isLocale, localePath, pick } from "@/lib/i18n";
import { formatRef } from "@/lib/refs";
import { cn, formatINRShort } from "@/lib/utils";

const PAGE_SIZE = 18;
const SORTS = ["newest", "price_asc", "price_desc", "area_asc", "area_desc"] as const;
const SCOPES = ["all", "independent", "projects"] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/properties">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return { title: dict.listings.title, description: dict.listings.subtitle, alternates: { canonical: `/${locale}/properties` } };
}

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function pickFrom<T extends string>(list: readonly T[], value: string): T | undefined {
  return (list as readonly string[]).includes(value) ? (value as T) : undefined;
}

export default async function PropertiesPage({ params, searchParams }: PageProps<"/[locale]/properties">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const query = await searchParams;
  const regions = await listActiveRegions();
  const wantedRegion = one(query.region).toUpperCase();

  const values: FilterValues = {
    q: one(query.q).slice(0, 60),
    region: regions.some((r) => r.code === wantedRegion) ? wantedRegion : "",
    scope: pickFrom(SCOPES, one(query.scope)) ?? "all",
    type: pickFrom(PROPERTY_TYPES, one(query.type)) ?? "",
    status: pickFrom(LISTING_STATUSES, one(query.status)) ?? "",
    facing: pickFrom(FACINGS, one(query.facing)) ?? "",
    budget: "",
    area: "",
    sort: pickFrom(SORTS, one(query.sort)) ?? "newest",
  };
  const budgetIndex = Number(one(query.budget));
  const budget = dict.search.budgets[budgetIndex - 1];
  if (budget) values.budget = String(budgetIndex);
  const areaIndex = Number(one(query.area));
  const area = dict.listings.areas[areaIndex - 1];
  if (area) values.area = String(areaIndex);
  const view = one(query.view) === "map" ? "map" : "list";

  const filters: Filters = {
    q: values.q || undefined,
    region: values.region || undefined,
    scope: values.scope as Filters["scope"],
    type: (values.type || undefined) as PropertyType | undefined,
    status: (values.status || undefined) as ListingStatus | undefined,
    facing: (values.facing || undefined) as Facing | undefined,
    minPrice: budget?.min,
    maxPrice: budget?.max,
    minArea: area?.min,
    maxArea: area?.max,
    sort: values.sort as Filters["sort"],
  };

  const [settings, all] = await Promise.all([getSettings(), searchListings(filters)]);
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(one(query.page)) || 1));
  const shown = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const corners = await listPropertyCorners(shown.filter((l) => l.kind === "property" && !l.image).map((l) => l.id));
  const activeCount = [values.region, values.type, values.status, values.facing, values.budget, values.area, values.scope !== "all" ? "x" : "", values.sort !== "newest" ? "x" : ""].filter(Boolean).length;
  const filtered = activeCount > 0 || Boolean(values.q);

  const base = localePath(locale, "/properties");
  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string> = { ...values, view, page: String(page) };
    for (const [k, v] of Object.entries(patch)) merged[k] = v ?? "";
    for (const [k, v] of Object.entries(merged)) {
      if (!v) continue;
      if ((k === "scope" && v === "all") || (k === "sort" && v === "newest") || (k === "view" && v === "list") || (k === "page" && v === "1")) continue;
      p.set(k, v);
    }
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  const pins: MapPin[] =
    view === "map"
      ? all
          .filter((l) => isValidLatLng(l.lat, l.lng))
          .slice(0, 400)
          .map((l) => ({
            id: `${l.kind}-${l.id}`,
            lat: l.lat!,
            lng: l.lng!,
            kind: "listing" as const,
            status: l.status,
            label: formatRef(l.prefix, l.propertyNo, l.siteNo),
            sub: [l.kind === "site" ? fill(dict.listings.inProject, { project: pick(l, "title", locale) }) : pick(l, "title", locale), l.dimension ? `${l.dimension} ${dict.common.ft}` : "", l.price ? formatINRShort(l.price, locale) : ""]
              .filter(Boolean)
              .join(" · "),
            href: listingHref(locale, l),
            linkText: dict.common.viewDetails,
          }))
      : [];

  return (
    <>
      <PageIntro crumbs={[{ href: localePath(locale), label: dict.nav.home }, { label: dict.listings.title }]} title={dict.listings.title} subtitle={dict.listings.subtitle} />

      <section className="container-x py-10 sm:py-14">
        <ListingFilters values={values} dict={dict} activeCount={activeCount} view={view} regions={regions.map((r) => ({ value: r.code, label: pick(r, "name", locale) || r.code }))} />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] text-ink-600" aria-live="polite">
            <span className="num font-semibold text-navy-900">{all.length === 1 ? dict.listings.countOne : fill(dict.listings.count, { count: all.length })}</span>
            {filtered ? (
              <Link href={base} className="ml-3 font-semibold text-navy-800 underline decoration-gold-500 decoration-2 underline-offset-4">
                {dict.common.clear}
              </Link>
            ) : null}
          </p>
          <div className="flex overflow-hidden rounded-[3px] border border-navy-900/18 text-[13px] font-semibold" role="group" aria-label={dict.listings.listView}>
            {(["list", "map"] as const).map((v) => (
              <Link
                key={v}
                href={href({ view: v, page: "1" })}
                scroll={false}
                aria-current={view === v ? "true" : undefined}
                className={cn("px-4 py-2 transition-colors", view === v ? "bg-navy-900 text-gold-200" : "bg-paper-0 text-navy-800 hover:bg-navy-50")}
              >
                {v === "list" ? dict.listings.listView : dict.listings.mapView}
              </Link>
            ))}
          </div>
        </div>

        {all.length === 0 ? (
          <p className="card mt-6 p-10 text-center text-ink-600">{dict.listings.empty}</p>
        ) : view === "map" ? (
          <div className="card mt-6 h-[68vh] min-h-[420px] overflow-hidden">
            <MapLoader pins={pins} fit="all" maxFitZoom={16} labels={{ map: dict.common.map, satellite: dict.common.satellite, interact: dict.common.useMap }} />
          </div>
        ) : (
          <>
            <Reveal mode="children" stagger={0.06} className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" key={JSON.stringify(values) + page}>
              {shown.map((l, i) => (
                <ListingCard
                  key={`${l.kind}-${l.id}`}
                  listing={l}
                  locale={locale}
                  dict={dict}
                  corners={l.kind === "property" ? corners.get(l.id) : null}
                  priority={i < 3}
                />
              ))}
            </Reveal>

            {pages > 1 ? (
              <nav className="mt-10 flex items-center justify-between gap-4 border-t border-navy-900/10 pt-6" aria-label="Pagination">
                {page > 1 ? (
                  <Link href={href({ page: String(page - 1) })} className="btn-outline btn-sm">
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    {dict.common.previous}
                  </Link>
                ) : (
                  <span />
                )}
                <span className="num text-[13px] text-ink-600">{fill(dict.common.page, { page, total: pages })}</span>
                {page < pages ? (
                  <Link href={href({ page: String(page + 1) })} className="btn-outline btn-sm">
                    {dict.common.next}
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </>
        )}
      </section>

      <CtaBand locale={locale} dict={dict} settings={settings} />
    </>
  );
}
