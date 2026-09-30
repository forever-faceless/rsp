import "server-only";
import type { Approval, AreaUnit, BilingualItem, Facing, ListingStatus, PropertyType, SurveyGeometry, VideoItem } from "@/lib/db/enums";
import { findByNo, getSite, getSurveyFor, listLandmarks } from "@/lib/db/queries";
import type { Landmark, Project } from "@/lib/db/schema";
import { isValidLatLng } from "@/lib/geo";
import { publicPrice } from "@/lib/pricing";
import { formatRef, parseRef, refSlug } from "@/lib/refs";
import { geometryOf, hasGeometry, surveyCentre } from "@/lib/survey";

/**
 * Everything the public page shows about one listing, whether it is an independent
 * property or a site inside a project. Office-only fields never enter this shape.
 */
export type ListingDetail = {
  kind: "property" | "site";
  ref: string;
  slug: string;
  prefix: string;
  propertyNo: number;
  siteNo: number | null;
  ids: { propertyId: number | null; siteId: number | null; projectId: number | null };
  type: PropertyType;
  titleEn: string;
  titleKn: string;
  locationEn: string;
  locationKn: string;
  descriptionEn: string;
  descriptionKn: string;
  status: ListingStatus;
  price: number | null;
  pricePerSqft: number | null;
  negotiable: boolean;
  dimension: string;
  widthFt: number | null;
  depthFt: number | null;
  areaSqft: number | null;
  areaUnit: AreaUnit;
  builtUpSqft: number | null;
  bedrooms: number | null;
  floors: number | null;
  facing: Facing | null;
  roadWidthFt: number | null;
  corner: boolean;
  features: BilingualItem[];
  documents: Approval[];
  images: string[];
  videos: VideoItem[];
  /** Where the map pin goes: the pin of the listing's survey. A site with no survey of its own shows its project's. */
  pin: { lat: number; lng: number } | null;
  /** The name given to the pin in the survey. Blank means the property number is shown. */
  pinLabel: string;
  /** True when the pin marks this listing itself rather than the project around it. */
  pinIsExact: boolean;
  geometry: SurveyGeometry | null;
  surveyAreaSqft: number | null;
  surveyPerimeterFt: number | null;
  landmarks: Landmark[];
  project: Pick<Project, "id" | "slug" | "nameEn" | "nameKn" | "prefix" | "propertyNo"> | null;
  updatedAt: Date;
};

export type ListingLookup = { type: "listing"; detail: ListingDetail } | { type: "project"; slug: string } | { type: "none" };

function point(lat: number | null, lng: number | null) {
  return isValidLatLng(lat, lng) ? { lat: lat as number, lng: lng as number } : null;
}

/**
 * Resolves a property number from a web address to the listing it names. A number without
 * its district letters is looked for in the main district first.
 */
export async function lookupListing(rawRef: string): Promise<ListingLookup> {
  const parsed = parseRef(rawRef);
  if (!parsed) return { type: "none" };
  const found = await findByNo(parsed.prefix, parsed.propertyNo);
  if (!found) return { type: "none" };

  if (parsed.siteNo != null) {
    if (found.kind !== "project") return { type: "none" };
    const { project } = found;
    const prefix = project.prefix;
    const site = await getSite(project.id, parsed.siteNo);
    if (!site) return { type: "none" };
    const [survey, landmarks] = await Promise.all([getSurveyFor({ siteId: site.id }), listLandmarks({ projectId: project.id })]);
    const geometry = survey && hasGeometry(geometryOf(survey)) ? geometryOf(survey) : null;
    const own = (geometry ? surveyCentre(geometry) : null) ?? point(site.lat, site.lng);
    return {
      type: "listing",
      detail: {
        kind: "site",
        ref: formatRef(prefix, project.propertyNo, site.siteNo),
        slug: refSlug(prefix, project.propertyNo, site.siteNo),
        prefix,
        propertyNo: project.propertyNo,
        siteNo: site.siteNo,
        ids: { propertyId: null, siteId: site.id, projectId: project.id },
        type: "residential_site",
        titleEn: project.nameEn,
        titleKn: project.nameKn,
        locationEn: project.locationEn,
        locationKn: project.locationKn,
        descriptionEn: site.descriptionEn,
        descriptionKn: site.descriptionKn,
        status: site.status,
        ...publicPrice({ price: site.price, pricePerSqft: site.pricePerSqft ?? project.pricePerSqft, priceDisplay: site.priceDisplay }, site.callForPrice || project.callForPrice),
        negotiable: false,
        dimension: site.dimension,
        widthFt: site.widthFt,
        depthFt: site.depthFt,
        areaSqft: site.areaSqft,
        areaUnit: "sqft",
        builtUpSqft: null,
        bedrooms: null,
        floors: null,
        facing: site.facing,
        roadWidthFt: site.roadWidthFt,
        corner: site.corner,
        features: site.features,
        documents: project.approvals,
        images: site.images.length ? site.images : [project.coverImage, ...project.gallery].filter(Boolean),
        videos: site.videos,
        pin: own ?? point(project.lat, project.lng),
        pinLabel: own ? (geometry?.pinLabel ?? "") : "",
        pinIsExact: Boolean(own),
        geometry,
        surveyAreaSqft: survey?.areaSqft ?? null,
        surveyPerimeterFt: survey?.perimeterFt ?? null,
        landmarks,
        project: { id: project.id, slug: project.slug, nameEn: project.nameEn, nameKn: project.nameKn, prefix: project.prefix, propertyNo: project.propertyNo },
        updatedAt: site.updatedAt,
      },
    };
  }

  if (found.kind === "project") return { type: "project", slug: found.project.slug };

  const { property } = found;
  const prefix = property.prefix;
  const [survey, landmarks] = await Promise.all([getSurveyFor({ propertyId: property.id }), listLandmarks({ propertyId: property.id })]);
  const geometry = survey && hasGeometry(geometryOf(survey)) ? geometryOf(survey) : null;
  const pin = (geometry ? surveyCentre(geometry) : null) ?? point(property.lat, property.lng);
  return {
    type: "listing",
    detail: {
      kind: "property",
      ref: formatRef(prefix, property.propertyNo),
      slug: refSlug(prefix, property.propertyNo),
      prefix,
      propertyNo: property.propertyNo,
      siteNo: null,
      ids: { propertyId: property.id, siteId: null, projectId: null },
      type: property.type,
      titleEn: property.titleEn,
      titleKn: property.titleKn,
      locationEn: property.locationEn,
      locationKn: property.locationKn,
      descriptionEn: property.descriptionEn,
      descriptionKn: property.descriptionKn,
      status: property.status,
      ...publicPrice(property, property.callForPrice),
      negotiable: property.callForPrice ? false : property.negotiable,
      dimension: property.dimension,
      widthFt: property.widthFt,
      depthFt: property.depthFt,
      areaSqft: property.areaSqft,
      areaUnit: property.areaUnit,
      builtUpSqft: property.builtUpSqft,
      bedrooms: property.bedrooms,
      floors: property.floors,
      facing: property.facing,
      roadWidthFt: property.roadWidthFt,
      corner: property.corner,
      features: property.features,
      documents: property.documents,
      images: property.images,
      videos: property.videos,
      pin,
      pinLabel: geometry?.pinLabel ?? "",
      pinIsExact: Boolean(pin),
      geometry,
      surveyAreaSqft: survey?.areaSqft ?? null,
      surveyPerimeterFt: survey?.perimeterFt ?? null,
      landmarks,
      project: null,
      updatedAt: property.updatedAt,
    },
  };
}
