import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, like, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { getDb, type Db } from "./client";
import {
  landmarks,
  leads,
  projects,
  properties,
  PROPERTY_TYPES,
  regions,
  settings,
  sites,
  surveys,
  teamMembers,
  testimonials,
  type AreaUnit,
  type Facing,
  type Landmark,
  type Lead,
  type LeadKind,
  type LeadStatus,
  type ListingStatus,
  type Project,
  type Property,
  type PropertyType,
  type Region,
  type Settings,
  type LatLng,
  type Site,
  type Survey,
  type SurveyCorner,
  type TeamMember,
  type Testimonial,
} from "./schema";
import { cleanPrefix } from "@/lib/refs";
import { publicPrice } from "@/lib/pricing";
import { geometryOf, surveyCentre } from "@/lib/survey";

export type ProjectWithCounts = Project & { siteCount: number; availableCount: number };

// ---------------------------------------------------------------- settings

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const existing = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
  if (existing) return existing;
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  return (await db.query.settings.findFirst({ where: eq(settings.id, 1) }))!;
}

// ---------------------------------------------------------------- districts and property numbers

/** Every district register, the main one first. There is always at least the main one. */
export async function listRegions(): Promise<Region[]> {
  const db = await getDb();
  const main = (await getSettings()).propertyPrefix;
  await ensureRegion(main);
  const rows = await db.query.regions.findMany({ orderBy: [asc(regions.sortOrder), asc(regions.code)] });
  return rows.sort((a, b) => Number(b.code === main) - Number(a.code === main) || a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}

export async function getRegion(code: string): Promise<Region | null> {
  const db = await getDb();
  return (await db.query.regions.findFirst({ where: eq(regions.code, cleanPrefix(code)) })) ?? null;
}

/** Makes sure a district register exists, so a code can be used before anyone has named it. */
export async function ensureRegion(code: string): Promise<void> {
  const db = await getDb();
  await db.insert(regions).values({ code: cleanPrefix(code) }).onConflictDoNothing();
}

/** How many projects and properties carry each district code. */
export async function countRegionUse(): Promise<Map<string, number>> {
  const db = await getDb();
  const [a, b] = await Promise.all([
    db.select({ code: projects.prefix, n: sql<number>`count(*)` }).from(projects).groupBy(projects.prefix),
    db.select({ code: properties.prefix, n: sql<number>`count(*)` }).from(properties).groupBy(properties.prefix),
  ]);
  const out = new Map<string, number>();
  for (const r of [...a, ...b]) out.set(r.code, (out.get(r.code) ?? 0) + Number(r.n));
  return out;
}

/**
 * Hands out the next property number in a district. The increment is a single UPDATE, so
 * two people creating listings at the same moment can never receive the same number.
 */
export async function allocatePropertyNo(prefix: string): Promise<number> {
  const code = cleanPrefix(prefix);
  await ensureRegion(code);
  const db = await getDb();
  for (let attempt = 0; attempt < 50; attempt++) {
    const [row] = await db
      .update(regions)
      .set({ nextNo: sql`${regions.nextNo} + 1` })
      .where(eq(regions.code, code))
      .returning({ next: regions.nextNo });
    const candidate = row.next - 1;
    // Skip numbers that were entered by hand ahead of the counter.
    if (!(await propertyNoInUse(code, candidate))) return candidate;
  }
  throw new Error("Could not allocate a property number.");
}

export async function propertyNoInUse(prefix: string, propertyNo: number, except?: { kind: "project" | "property"; id: number }): Promise<boolean> {
  const code = cleanPrefix(prefix);
  const db = await getDb();
  const [project, property] = await Promise.all([
    db.query.projects.findFirst({ where: and(eq(projects.prefix, code), eq(projects.propertyNo, propertyNo)), columns: { id: true } }),
    db.query.properties.findFirst({ where: and(eq(properties.prefix, code), eq(properties.propertyNo, propertyNo)), columns: { id: true } }),
  ]);
  if (project && !(except?.kind === "project" && except.id === project.id)) return true;
  if (property && !(except?.kind === "property" && except.id === property.id)) return true;
  return false;
}

/** Moves a district's counter past a number that was typed in by hand. */
export async function reservePropertyNo(prefix: string, propertyNo: number): Promise<void> {
  const code = cleanPrefix(prefix);
  await ensureRegion(code);
  const db = await getDb();
  await db
    .update(regions)
    .set({ nextNo: sql`max(${regions.nextNo}, ${propertyNo + 1})` })
    .where(eq(regions.code, code));
}

/**
 * Picks one row when a number was given without its district letters: the main district
 * wins, then whichever was listed first. With the letters given only an exact match counts.
 */
async function preferRegion<T extends { prefix: string }>(rows: T[], prefix: string | null): Promise<T | null> {
  if (!rows.length) return null;
  if (prefix) return rows.find((r) => r.prefix === cleanPrefix(prefix)) ?? null;
  const main = (await getSettings()).propertyPrefix;
  return rows.find((r) => r.prefix === main) ?? rows[0];
}

export type NumberedListing = { kind: "project"; project: Project } | { kind: "property"; property: Property };

/**
 * The project or property a typed number refers to. Only published rows are found, so
 * unpublished drafts stay private.
 */
export async function findByNo(prefix: string | null, propertyNo: number): Promise<NumberedListing | null> {
  const db = await getDb();
  const code = prefix ? cleanPrefix(prefix) : null;
  const [projectRows, propertyRows] = await Promise.all([
    db.query.projects.findMany({ where: compact([eq(projects.propertyNo, propertyNo), eq(projects.published, true), code ? eq(projects.prefix, code) : undefined]) }),
    db.query.properties.findMany({ where: compact([eq(properties.propertyNo, propertyNo), eq(properties.published, true), code ? eq(properties.prefix, code) : undefined]) }),
  ]);
  const pick = await preferRegion(
    [...projectRows.map((project) => ({ prefix: project.prefix, row: { kind: "project", project } as NumberedListing })), ...propertyRows.map((property) => ({ prefix: property.prefix, row: { kind: "property", property } as NumberedListing }))],
    code,
  );
  return pick?.row ?? null;
}

// ---------------------------------------------------------------- projects

async function attachCounts(db: Db, rows: Project[]): Promise<ProjectWithCounts[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((p) => p.id);
  const counts = await db
    .select({
      projectId: sites.projectId,
      total: sql<number>`count(*)`,
      available: sql<number>`sum(case when ${sites.status} = 'available' then 1 else 0 end)`,
    })
    .from(sites)
    .where(inArray(sites.projectId, ids))
    .groupBy(sites.projectId);
  const byId = new Map(counts.map((c) => [c.projectId, c]));
  return rows.map((p) => ({
    ...p,
    siteCount: Number(byId.get(p.id)?.total ?? 0),
    availableCount: Number(byId.get(p.id)?.available ?? 0),
  }));
}

export async function listPublishedProjects(): Promise<ProjectWithCounts[]> {
  const db = await getDb();
  const rows = await db.query.projects.findMany({
    where: eq(projects.published, true),
    orderBy: [desc(projects.featured), asc(projects.sortOrder), desc(projects.createdAt)],
  });
  return attachCounts(db, rows);
}

export async function listFeaturedProjects(limit = 3): Promise<ProjectWithCounts[]> {
  const all = await listPublishedProjects();
  // Featured projects first, then fill the remaining slots with the rest in display order.
  const featured = all.filter((p) => p.featured);
  const others = all.filter((p) => !p.featured);
  return [...featured, ...others].slice(0, limit);
}

export async function listAllProjects(): Promise<ProjectWithCounts[]> {
  const db = await getDb();
  const rows = await db.query.projects.findMany({
    orderBy: [asc(projects.sortOrder), desc(projects.createdAt)],
  });
  return attachCounts(db, rows);
}

export async function getProjectBySlug(slug: string, includeUnpublished = false): Promise<Project | null> {
  const db = await getDb();
  const where = includeUnpublished ? eq(projects.slug, slug) : and(eq(projects.slug, slug), eq(projects.published, true));
  return (await db.query.projects.findFirst({ where })) ?? null;
}

export async function getProjectById(id: number): Promise<Project | null> {
  const db = await getDb();
  return (await db.query.projects.findFirst({ where: eq(projects.id, id) })) ?? null;
}

export async function slugExists(slug: string, exceptId?: number): Promise<boolean> {
  const db = await getDb();
  const row = await db.query.projects.findFirst({ where: eq(projects.slug, slug), columns: { id: true } });
  return Boolean(row && row.id !== exceptId);
}

// ---------------------------------------------------------------- properties

export async function listAllProperties(): Promise<Property[]> {
  const db = await getDb();
  return db.query.properties.findMany({ orderBy: [asc(properties.prefix), desc(properties.propertyNo)] });
}

export async function getPropertyById(id: number): Promise<Property | null> {
  const db = await getDb();
  return (await db.query.properties.findFirst({ where: eq(properties.id, id) })) ?? null;
}

// ---------------------------------------------------------------- sites

export async function listSites(projectId: number): Promise<Site[]> {
  const db = await getDb();
  return db.query.sites.findMany({ where: eq(sites.projectId, projectId), orderBy: [asc(sites.siteNo)] });
}

export async function getSite(projectId: number, siteNo: number): Promise<Site | null> {
  const db = await getDb();
  return (await db.query.sites.findFirst({ where: and(eq(sites.projectId, projectId), eq(sites.siteNo, siteNo)) })) ?? null;
}

export async function getSiteById(id: number): Promise<Site | null> {
  const db = await getDb();
  return (await db.query.sites.findFirst({ where: eq(sites.id, id) })) ?? null;
}

export async function siteNoExists(projectId: number, siteNo: number, exceptId?: number): Promise<boolean> {
  const db = await getDb();
  const row = await db.query.sites.findFirst({
    where: and(eq(sites.projectId, projectId), eq(sites.siteNo, siteNo)),
    columns: { id: true },
  });
  return Boolean(row && row.id !== exceptId);
}

export async function nextSiteNo(projectId: number): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ max: sql<number | null>`max(${sites.siteNo})` })
    .from(sites)
    .where(eq(sites.projectId, projectId));
  return Number(row?.max ?? 0) + 1;
}

// ---------------------------------------------------------------- listings (public search)

/** One card on the public site: an independent property or a site inside a project. */
export type Listing = {
  kind: "property" | "site";
  id: number;
  /** District code, the HSN in HSN-0001. */
  prefix: string;
  propertyNo: number;
  siteNo: number | null;
  type: PropertyType;
  titleEn: string;
  titleKn: string;
  locationEn: string;
  locationKn: string;
  projectSlug: string | null;
  dimension: string;
  widthFt: number | null;
  depthFt: number | null;
  areaSqft: number | null;
  areaUnit: AreaUnit;
  facing: Facing | null;
  corner: boolean;
  status: ListingStatus;
  price: number | null;
  pricePerSqft: number | null;
  image: string;
  lat: number | null;
  lng: number | null;
  featured: boolean;
  createdAt: Date;
};

export type ListingFilters = {
  scope?: "all" | "independent" | "projects";
  /** District code, to show one register only. */
  region?: string;
  type?: PropertyType;
  status?: ListingStatus;
  facing?: Facing;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  q?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "area_asc" | "area_desc";
};

function propertyToListing(p: Property): Listing {
  return {
    kind: "property",
    id: p.id,
    prefix: p.prefix,
    propertyNo: p.propertyNo,
    siteNo: null,
    type: p.type,
    titleEn: p.titleEn,
    titleKn: p.titleKn,
    locationEn: p.locationEn,
    locationKn: p.locationKn,
    projectSlug: null,
    dimension: p.dimension,
    widthFt: p.widthFt,
    depthFt: p.depthFt,
    areaSqft: p.areaSqft,
    areaUnit: p.areaUnit,
    facing: p.facing,
    corner: p.corner,
    status: p.status,
    // Only the figures the listing has chosen to show go out; "call for price" sends none.
    ...publicPrice(p, p.callForPrice),
    image: p.images[0] ?? "",
    lat: p.lat,
    lng: p.lng,
    featured: p.featured,
    createdAt: p.createdAt,
  };
}

function siteToListing(s: Site, project: Project): Listing {
  return {
    kind: "site",
    id: s.id,
    prefix: project.prefix,
    propertyNo: project.propertyNo,
    siteNo: s.siteNo,
    type: "residential_site",
    titleEn: project.nameEn,
    titleKn: project.nameKn,
    locationEn: project.locationEn,
    locationKn: project.locationKn,
    projectSlug: project.slug,
    dimension: s.dimension,
    widthFt: s.widthFt,
    depthFt: s.depthFt,
    areaSqft: s.areaSqft,
    areaUnit: "sqft",
    facing: s.facing,
    corner: s.corner,
    status: s.status,
    ...publicPrice(s, s.callForPrice || project.callForPrice),
    image: s.images[0] ?? "",
    lat: s.lat ?? project.lat,
    lng: s.lng ?? project.lng,
    featured: false,
    createdAt: s.createdAt,
  };
}

function compact(conditions: Array<SQL | undefined>): SQL | undefined {
  const list = conditions.filter((c): c is SQL => Boolean(c));
  return list.length ? and(...list) : undefined;
}

const statusRank: Record<ListingStatus, number> = { available: 0, reserved: 1, sold: 2 };

export async function searchListings(filters: ListingFilters = {}): Promise<Listing[]> {
  const db = await getDb();
  const scope = filters.scope ?? "all";
  const q = filters.q?.trim();
  const pattern = q ? `%${q.replace(/[%_]/g, " ").trim()}%` : null;
  const region = filters.region ? cleanPrefix(filters.region) : null;
  const out: Listing[] = [];

  if (scope !== "projects") {
    const rows = await db
      .select()
      .from(properties)
      .where(
        compact([
          eq(properties.published, true),
          region ? eq(properties.prefix, region) : undefined,
          filters.type ? eq(properties.type, filters.type) : undefined,
          filters.status ? eq(properties.status, filters.status) : undefined,
          filters.facing ? eq(properties.facing, filters.facing) : undefined,
          filters.minPrice != null ? gte(properties.price, filters.minPrice) : undefined,
          filters.maxPrice != null ? lte(properties.price, filters.maxPrice) : undefined,
          // A budget filter must not reveal a price that is being kept private.
          filters.minPrice != null || filters.maxPrice != null ? and(eq(properties.callForPrice, false), ne(properties.priceDisplay, "rate")) : undefined,
          filters.minArea != null ? gte(properties.areaSqft, filters.minArea) : undefined,
          filters.maxArea != null ? lte(properties.areaSqft, filters.maxArea) : undefined,
          pattern
            ? or(like(properties.titleEn, pattern), like(properties.titleKn, pattern), like(properties.locationEn, pattern), like(properties.locationKn, pattern), like(properties.dimension, pattern))
            : undefined,
        ]),
      );
    out.push(...rows.map(propertyToListing));
  }

  // Sites inside projects are residential sites, so any other type filter excludes them.
  if (scope !== "independent" && (!filters.type || filters.type === "residential_site")) {
    const rows = await db
      .select({ site: sites, project: projects })
      .from(sites)
      .innerJoin(projects, eq(sites.projectId, projects.id))
      .where(
        compact([
          eq(projects.published, true),
          region ? eq(projects.prefix, region) : undefined,
          filters.status ? eq(sites.status, filters.status) : undefined,
          filters.facing ? eq(sites.facing, filters.facing) : undefined,
          filters.minPrice != null ? gte(sites.price, filters.minPrice) : undefined,
          filters.maxPrice != null ? lte(sites.price, filters.maxPrice) : undefined,
          filters.minPrice != null || filters.maxPrice != null ? and(eq(sites.callForPrice, false), eq(projects.callForPrice, false), ne(sites.priceDisplay, "rate")) : undefined,
          filters.minArea != null ? gte(sites.areaSqft, filters.minArea) : undefined,
          filters.maxArea != null ? lte(sites.areaSqft, filters.maxArea) : undefined,
          pattern
            ? or(like(projects.nameEn, pattern), like(projects.nameKn, pattern), like(projects.locationEn, pattern), like(projects.locationKn, pattern), like(sites.dimension, pattern))
            : undefined,
        ]),
      );
    out.push(...rows.map((r) => siteToListing(r.site, r.project)));
  }

  const sort = filters.sort ?? "newest";
  const num = (v: number | null, empty: number) => (v == null ? empty : v);
  out.sort((a, b) => {
    // Sold listings always sink to the end, whatever the chosen order.
    const rank = statusRank[a.status] - statusRank[b.status];
    if (rank) return rank;
    switch (sort) {
      case "price_asc":
        return num(a.price, Infinity) - num(b.price, Infinity);
      case "price_desc":
        return num(b.price, -1) - num(a.price, -1);
      case "area_asc":
        return num(a.areaSqft, Infinity) - num(b.areaSqft, Infinity);
      case "area_desc":
        return num(b.areaSqft, -1) - num(a.areaSqft, -1);
      default:
        return Number(b.featured) - Number(a.featured) || b.createdAt.getTime() - a.createdAt.getTime() || a.prefix.localeCompare(b.prefix) || b.propertyNo - a.propertyNo || (a.siteNo ?? 0) - (b.siteNo ?? 0);
    }
  });
  return out;
}

export async function listFeaturedProperties(limit = 6): Promise<Listing[]> {
  const db = await getDb();
  const rows = await db.query.properties.findMany({
    where: and(eq(properties.published, true), ne(properties.status, "sold")),
    orderBy: [desc(properties.featured), asc(properties.sortOrder), desc(properties.createdAt)],
    limit,
  });
  return rows.map(propertyToListing);
}

/**
 * The listing drawn on the home page's specimen sheet: the first featured property that
 * can be drawn, then any available property, then an available site in a project.
 */
export async function getHeroSpecimen(): Promise<{ listing: Listing; corners: SurveyCorner[] | null } | null> {
  const db = await getDb();
  const candidates = await db.query.properties.findMany({
    where: and(eq(properties.published, true), eq(properties.status, "available")),
    orderBy: [desc(properties.featured), asc(properties.sortOrder), desc(properties.createdAt)],
    limit: 12,
  });
  for (const p of candidates) {
    const survey = await getSurveyFor({ propertyId: p.id });
    if (survey && survey.corners.length >= 3) return { listing: propertyToListing(p), corners: survey.corners };
    if (p.widthFt && p.depthFt) return { listing: propertyToListing(p), corners: null };
  }
  const [row] = await db
    .select({ site: sites, project: projects })
    .from(sites)
    .innerJoin(projects, eq(sites.projectId, projects.id))
    .where(and(eq(projects.published, true), eq(sites.status, "available"), isNotNull(sites.widthFt), isNotNull(sites.depthFt)))
    .orderBy(desc(projects.featured), asc(projects.sortOrder), asc(sites.siteNo))
    .limit(1);
  if (!row) return null;
  const survey = await getSurveyFor({ siteId: row.site.id });
  return { listing: siteToListing(row.site, row.project), corners: survey && survey.corners.length >= 3 ? survey.corners : null };
}

/** Which property types have at least one published listing, for the shortcuts on the home page. */
export async function listActiveTypes(): Promise<PropertyType[]> {
  const db = await getDb();
  const rows = await db
    .select({ type: properties.type, n: sql<number>`count(*)` })
    .from(properties)
    .where(and(eq(properties.published, true), ne(properties.status, "sold")))
    .groupBy(properties.type);
  const found = new Set(rows.map((r) => r.type));
  const [site] = await db
    .select({ n: sql<number>`count(*)` })
    .from(sites)
    .innerJoin(projects, eq(sites.projectId, projects.id))
    .where(and(eq(projects.published, true), ne(sites.status, "sold")));
  if (Number(site?.n ?? 0) > 0) found.add("residential_site");
  return PROPERTY_TYPES.filter((t) => found.has(t));
}

/** Districts that have at least one published listing, for the filter on the property list. */
export async function listActiveRegions(): Promise<Region[]> {
  const db = await getDb();
  const [a, b] = await Promise.all([
    db.select({ code: properties.prefix }).from(properties).where(eq(properties.published, true)).groupBy(properties.prefix),
    db.select({ code: projects.prefix }).from(sites).innerJoin(projects, eq(sites.projectId, projects.id)).where(eq(projects.published, true)).groupBy(projects.prefix),
  ]);
  const active = new Set([...a, ...b].map((r) => r.code));
  return (await listRegions()).filter((r) => active.has(r.code));
}

/** Survey corners for a batch of independent properties, keyed by property id. */
export async function listPropertyCorners(propertyIds: number[]): Promise<Map<number, SurveyCorner[]>> {
  const map = new Map<number, SurveyCorner[]>();
  if (!propertyIds.length) return map;
  const db = await getDb();
  const rows = await db.query.surveys.findMany({ where: inArray(surveys.propertyId, propertyIds), orderBy: [asc(surveys.updatedAt)] });
  for (const s of rows) if (s.propertyId != null && s.corners.length >= 3) map.set(s.propertyId, s.corners);
  return map;
}

export async function countPublicListings(): Promise<{ properties: number; sites: number; available: number }> {
  const db = await getDb();
  const [p] = await db
    .select({ n: sql<number>`count(*)`, a: sql<number>`sum(case when ${properties.status} = 'available' then 1 else 0 end)` })
    .from(properties)
    .where(eq(properties.published, true));
  const [s] = await db
    .select({ n: sql<number>`count(*)`, a: sql<number>`sum(case when ${sites.status} = 'available' then 1 else 0 end)` })
    .from(sites)
    .innerJoin(projects, eq(sites.projectId, projects.id))
    .where(eq(projects.published, true));
  return { properties: Number(p?.n ?? 0), sites: Number(s?.n ?? 0), available: Number(p?.a ?? 0) + Number(s?.a ?? 0) };
}

/**
 * Figures taken from the register itself, so the home page moves the moment a sale is
 * recorded: every listing marked sold, and every project marked completed or sold out.
 */
export async function countRegisterFigures(): Promise<{ sold: number; delivered: number }> {
  const db = await getDb();
  const [[p], [s], [d]] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(properties).where(eq(properties.status, "sold")),
    db.select({ n: sql<number>`count(*)` }).from(sites).where(eq(sites.status, "sold")),
    db.select({ n: sql<number>`count(*)` }).from(projects).where(inArray(projects.status, ["completed", "sold_out"])),
  ]);
  return { sold: Number(p?.n ?? 0) + Number(s?.n ?? 0), delivered: Number(d?.n ?? 0) };
}

// ---------------------------------------------------------------- landmarks

export async function listLandmarks(target: { projectId: number } | { propertyId: number }): Promise<Landmark[]> {
  const db = await getDb();
  return db.query.landmarks.findMany({
    where: "projectId" in target ? eq(landmarks.projectId, target.projectId) : eq(landmarks.propertyId, target.propertyId),
    orderBy: [asc(landmarks.sortOrder), asc(landmarks.id)],
  });
}

export async function getLandmarkById(id: number): Promise<Landmark | null> {
  const db = await getDb();
  return (await db.query.landmarks.findFirst({ where: eq(landmarks.id, id) })) ?? null;
}

// ---------------------------------------------------------------- surveys

export type SurveyTarget = { projectId: number } | { propertyId: number } | { siteId: number };

function surveyTargetWhere(target: SurveyTarget): SQL {
  if ("projectId" in target) return eq(surveys.projectId, target.projectId);
  if ("propertyId" in target) return eq(surveys.propertyId, target.propertyId);
  return eq(surveys.siteId, target.siteId);
}

export type SurveyWithTarget = Survey & {
  targetLabel: string | null;
  targetPrefix: string | null;
  targetPropertyNo: number | null;
  targetSiteNo: number | null;
  targetHref: string | null;
};

export async function listSurveys(): Promise<SurveyWithTarget[]> {
  const db = await getDb();
  const rows = await db
    .select({
      survey: surveys,
      projectName: projects.nameEn,
      projectPrefix: projects.prefix,
      projectNo: projects.propertyNo,
      propertyTitle: properties.titleEn,
      propertyPrefix: properties.prefix,
      propertyNo: properties.propertyNo,
      siteNo: sites.siteNo,
      siteProjectId: sites.projectId,
    })
    .from(surveys)
    .leftJoin(projects, eq(surveys.projectId, projects.id))
    .leftJoin(properties, eq(surveys.propertyId, properties.id))
    .leftJoin(sites, eq(surveys.siteId, sites.id))
    .orderBy(desc(surveys.updatedAt));

  // A site's parent project is looked up separately: projects is already joined once above.
  const siteProjectIds = Array.from(new Set(rows.map((r) => r.siteProjectId).filter((v): v is number => v != null)));
  const siteProjects = siteProjectIds.length
    ? await db.query.projects.findMany({ where: inArray(projects.id, siteProjectIds), columns: { id: true, nameEn: true, prefix: true, propertyNo: true } })
    : [];
  const projectById = new Map(siteProjects.map((p) => [p.id, p]));

  return rows.map((r) => {
    const s = r.survey;
    if (s.siteId != null && r.siteNo != null && r.siteProjectId != null) {
      const parent = projectById.get(r.siteProjectId);
      return {
        ...s,
        targetLabel: parent?.nameEn ?? "Site",
        targetPrefix: parent?.prefix ?? null,
        targetPropertyNo: parent?.propertyNo ?? null,
        targetSiteNo: r.siteNo,
        targetHref: `/admin/projects/${r.siteProjectId}/sites/${s.siteId}`,
      };
    }
    if (s.propertyId != null && r.propertyNo != null) {
      return { ...s, targetLabel: r.propertyTitle, targetPrefix: r.propertyPrefix, targetPropertyNo: r.propertyNo, targetSiteNo: null, targetHref: `/admin/properties/${s.propertyId}` };
    }
    if (s.projectId != null && r.projectNo != null) {
      return { ...s, targetLabel: r.projectName, targetPrefix: r.projectPrefix, targetPropertyNo: r.projectNo, targetSiteNo: null, targetHref: `/admin/projects/${s.projectId}` };
    }
    return { ...s, targetLabel: null, targetPrefix: null, targetPropertyNo: null, targetSiteNo: null, targetHref: null };
  });
}

export async function getSurveyById(id: number): Promise<Survey | null> {
  const db = await getDb();
  return (await db.query.surveys.findFirst({ where: eq(surveys.id, id) })) ?? null;
}

/** The most recently edited survey attached to a listing. */
export async function getSurveyFor(target: SurveyTarget): Promise<Survey | null> {
  const db = await getDb();
  return (await db.query.surveys.findFirst({ where: surveyTargetWhere(target), orderBy: [desc(surveys.updatedAt)] })) ?? null;
}

/**
 * A listing's location is the pin of its survey. This repeats it onto the listing's own row
 * whenever a survey is saved, attached, detached or deleted, so lists and maps can read it
 * without opening the survey. With no survey that says where the listing is, it has no location.
 */
export async function syncListingLocation(target: SurveyTarget): Promise<void> {
  const db = await getDb();
  const rows = await db.query.surveys.findMany({ where: surveyTargetWhere(target), orderBy: [desc(surveys.updatedAt), desc(surveys.id)] });
  let at: LatLng | null = null;
  for (const row of rows) {
    at = surveyCentre(geometryOf(row));
    if (at) break;
  }
  const place = { lat: at ? Number(at.lat.toFixed(7)) : null, lng: at ? Number(at.lng.toFixed(7)) : null };
  if ("propertyId" in target) await db.update(properties).set(place).where(eq(properties.id, target.propertyId));
  else if ("siteId" in target) await db.update(sites).set(place).where(eq(sites.id, target.siteId));
  else await db.update(projects).set(place).where(eq(projects.id, target.projectId));
}

/** Surveys of every site in a project, keyed by site id, for drawing the whole layout at once. */
export async function listSiteSurveys(projectId: number): Promise<Map<number, Survey>> {
  const db = await getDb();
  const rows = await db
    .select({ survey: surveys })
    .from(surveys)
    .innerJoin(sites, eq(surveys.siteId, sites.id))
    .where(and(eq(sites.projectId, projectId), isNotNull(surveys.siteId)))
    .orderBy(asc(surveys.updatedAt));
  const map = new Map<number, Survey>();
  // Ascending order means the newest survey of a site is the one left in the map.
  for (const r of rows) if (r.survey.siteId != null) map.set(r.survey.siteId, r.survey);
  return map;
}

/** Everything a survey can be attached to, for the picker in the survey studio. */
export type SurveyTargetOption = { key: string; label: string; prefix: string; propertyNo: number; siteNo: number | null };

export async function listSurveyTargets(): Promise<SurveyTargetOption[]> {
  const db = await getDb();
  const [props, projs, siteRows] = await Promise.all([
    db.query.properties.findMany({ columns: { id: true, prefix: true, propertyNo: true, titleEn: true }, orderBy: [asc(properties.prefix), desc(properties.propertyNo)] }),
    db.query.projects.findMany({ columns: { id: true, prefix: true, propertyNo: true, nameEn: true }, orderBy: [asc(projects.prefix), desc(projects.propertyNo)] }),
    db
      .select({ id: sites.id, siteNo: sites.siteNo, projectPrefix: projects.prefix, projectNo: projects.propertyNo, projectName: projects.nameEn })
      .from(sites)
      .innerJoin(projects, eq(sites.projectId, projects.id))
      .orderBy(asc(projects.prefix), desc(projects.propertyNo), asc(sites.siteNo)),
  ]);
  return [
    ...props.map((p) => ({ key: `property:${p.id}`, label: p.titleEn, prefix: p.prefix, propertyNo: p.propertyNo, siteNo: null })),
    ...projs.map((p) => ({ key: `project:${p.id}`, label: `${p.nameEn} (whole layout)`, prefix: p.prefix, propertyNo: p.propertyNo, siteNo: null })),
    ...siteRows.map((s) => ({ key: `site:${s.id}`, label: s.projectName, prefix: s.projectPrefix, propertyNo: s.projectNo, siteNo: s.siteNo })),
  ];
}

// ---------------------------------------------------------------- team & testimonials

export async function listTeam(publishedOnly = true): Promise<TeamMember[]> {
  const db = await getDb();
  return db.query.teamMembers.findMany({
    where: publishedOnly ? eq(teamMembers.published, true) : undefined,
    orderBy: [asc(teamMembers.sortOrder), asc(teamMembers.id)],
  });
}

export async function getTeamMember(id: number): Promise<TeamMember | null> {
  const db = await getDb();
  return (await db.query.teamMembers.findFirst({ where: eq(teamMembers.id, id) })) ?? null;
}

export async function listTestimonials(publishedOnly = true): Promise<Testimonial[]> {
  const db = await getDb();
  return db.query.testimonials.findMany({
    where: publishedOnly ? eq(testimonials.published, true) : undefined,
    orderBy: [asc(testimonials.sortOrder), asc(testimonials.id)],
  });
}

export async function getTestimonial(id: number): Promise<Testimonial | null> {
  const db = await getDb();
  return (await db.query.testimonials.findFirst({ where: eq(testimonials.id, id) })) ?? null;
}

// ---------------------------------------------------------------- leads

export type LeadWithRefs = Lead & { subject: string | null };

export async function listLeads(filters: { status?: LeadStatus; kind?: LeadKind } = {}): Promise<LeadWithRefs[]> {
  const db = await getDb();
  const rows = await db
    .select({
      lead: leads,
      projectName: projects.nameEn,
      propertyTitle: properties.titleEn,
    })
    .from(leads)
    .leftJoin(projects, eq(leads.projectId, projects.id))
    .leftJoin(properties, eq(leads.propertyId, properties.id))
    .where(compact([filters.status ? eq(leads.status, filters.status) : undefined, filters.kind ? eq(leads.kind, filters.kind) : undefined]))
    .orderBy(desc(leads.createdAt));
  return rows.map((r) => ({ ...r.lead, subject: r.propertyTitle ?? r.projectName ?? null }));
}

export async function countLeadsByStatus(): Promise<Record<LeadStatus, number>> {
  const db = await getDb();
  const rows = await db.select({ status: leads.status, n: sql<number>`count(*)` }).from(leads).groupBy(leads.status);
  const out: Record<LeadStatus, number> = { new: 0, contacted: 0, qualified: 0, closed: 0 };
  for (const r of rows) out[r.status] = Number(r.n);
  return out;
}

export async function getDashboardStats() {
  const db = await getDb();
  const count = async (query: Promise<{ n: number }[]>) => Number((await query)[0]?.n ?? 0);
  const [projectCount, siteCount, availableSites, propertyCount, availableProperties, draftProperties, surveyCount, looseSurveys, leadCounts, recent] =
    await Promise.all([
      count(db.select({ n: sql<number>`count(*)` }).from(projects)),
      count(db.select({ n: sql<number>`count(*)` }).from(sites)),
      count(db.select({ n: sql<number>`count(*)` }).from(sites).where(eq(sites.status, "available"))),
      count(db.select({ n: sql<number>`count(*)` }).from(properties)),
      count(db.select({ n: sql<number>`count(*)` }).from(properties).where(eq(properties.status, "available"))),
      count(db.select({ n: sql<number>`count(*)` }).from(properties).where(eq(properties.published, false))),
      count(db.select({ n: sql<number>`count(*)` }).from(surveys)),
      count(
        db
          .select({ n: sql<number>`count(*)` })
          .from(surveys)
          .where(sql`${surveys.projectId} is null and ${surveys.propertyId} is null and ${surveys.siteId} is null`),
      ),
      countLeadsByStatus(),
      listLeads(),
    ]);
  return {
    projects: projectCount,
    sites: siteCount,
    availableSites,
    properties: propertyCount,
    availableProperties,
    draftProperties,
    surveys: surveyCount,
    looseSurveys,
    leads: leadCounts,
    recentLeads: recent.slice(0, 6),
  };
}
