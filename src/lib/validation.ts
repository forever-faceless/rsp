import { z } from "zod";
import { AREA_UNITS, FACINGS, LANDMARK_CATEGORIES, LEAD_KINDS, LEAD_PURPOSES, LISTING_STATUSES, PRICE_DISPLAYS, PROJECT_STATUSES, PROPERTY_TYPES } from "@/lib/db/enums";
import { isIndianMobile } from "@/lib/utils";

const optionalNumber = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().finite().nullable());

const optionalPositive = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().finite().positive().nullable());

const optionalInt = z.preprocess((v) => (v === "" || v == null ? null : Math.round(Number(v))), z.number().int().nullable());

const optionalPositiveInt = z.preprocess((v) => (v === "" || v == null ? null : Math.round(Number(v))), z.number().int().positive().nullable());

const sortOrder = z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().int()).default(0);

const latitude = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().finite().min(-90).max(90).nullable());
const longitude = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().finite().min(-180).max(180).nullable());

const facing = z.union([z.literal(""), z.enum(FACINGS)]).default("");

export const leadSchema = z.object({
  kind: z.enum(LEAD_KINDS).default("buy"),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().refine(isIndianMobile, "invalid_phone"),
  email: z.union([z.literal(""), z.string().trim().email().max(120)]).default(""),
  projectId: optionalInt,
  siteId: optionalInt,
  propertyId: optionalInt,
  ref: z.string().trim().max(40).default(""),
  purpose: z.enum(LEAD_PURPOSES).default("self_use"),
  budget: z.string().trim().max(60).default(""),
  timeline: z.string().trim().max(60).default(""),
  message: z.string().trim().max(1500).default(""),
  locale: z.enum(["en", "kn"]).default("en"),
  source: z.string().trim().max(200).default(""),
  consent: z.literal(true, { error: "consent_required" }),
  // Honeypot: real users never fill this hidden field.
  website: z.string().max(0).default(""),
});

export const projectSchema = z.object({
  nameEn: z.string().trim().min(2).max(120),
  nameKn: z.string().trim().max(160).default(""),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  taglineEn: z.string().trim().max(200).default(""),
  taglineKn: z.string().trim().max(240).default(""),
  descriptionEn: z.string().trim().max(8000).default(""),
  descriptionKn: z.string().trim().max(10000).default(""),
  locationEn: z.string().trim().max(200).default(""),
  locationKn: z.string().trim().max(240).default(""),
  totalAreaAcres: optionalPositive,
  totalSites: optionalPositiveInt,
  status: z.enum(PROJECT_STATUSES),
  priceFrom: optionalPositiveInt,
  pricePerSqft: optionalPositiveInt,
  callForPrice: z.boolean().default(false),
  brochureUrl: z.string().trim().max(500).default(""),
  featured: z.boolean().default(false),
  published: z.boolean().default(true),
  sortOrder,
});

export const propertySchema = z.object({
  type: z.enum(PROPERTY_TYPES),
  titleEn: z.string().trim().min(2).max(140),
  titleKn: z.string().trim().max(180).default(""),
  locationEn: z.string().trim().max(200).default(""),
  locationKn: z.string().trim().max(240).default(""),
  descriptionEn: z.string().trim().max(8000).default(""),
  descriptionKn: z.string().trim().max(10000).default(""),
  dimension: z.string().trim().max(40).default(""),
  widthFt: optionalPositive,
  depthFt: optionalPositive,
  areaSqft: optionalPositive,
  areaUnit: z.enum(AREA_UNITS).default("sqft"),
  builtUpSqft: optionalPositive,
  bedrooms: optionalPositiveInt,
  floors: optionalPositiveInt,
  facing,
  roadWidthFt: optionalPositive,
  corner: z.boolean().default(false),
  status: z.enum(LISTING_STATUSES),
  price: optionalPositiveInt,
  pricePerSqft: optionalPositiveInt,
  negotiable: z.boolean().default(false),
  callForPrice: z.boolean().default(false),
  priceDisplay: z.enum(PRICE_DISPLAYS).default("both"),
  featured: z.boolean().default(false),
  published: z.boolean().default(false),
  sortOrder,
  ownerName: z.string().trim().max(120).default(""),
  ownerPhone: z.string().trim().max(20).default(""),
  privateNotes: z.string().trim().max(4000).default(""),
});

export const siteSchema = z.object({
  siteNo: z.preprocess((v) => (v === "" || v == null ? NaN : Number(v)), z.number().int().min(1).max(9999)),
  dimension: z.string().trim().max(40).default(""),
  widthFt: optionalPositive,
  depthFt: optionalPositive,
  areaSqft: optionalPositive,
  facing,
  roadWidthFt: optionalPositive,
  corner: z.boolean().default(false),
  status: z.enum(LISTING_STATUSES),
  price: optionalPositiveInt,
  pricePerSqft: optionalPositiveInt,
  callForPrice: z.boolean().default(false),
  priceDisplay: z.enum(PRICE_DISPLAYS).default("both"),
  descriptionEn: z.string().trim().max(4000).default(""),
  descriptionKn: z.string().trim().max(5000).default(""),
});

export const landmarkSchema = z.object({
  nameEn: z.string().trim().min(1).max(120),
  nameKn: z.string().trim().max(160).default(""),
  category: z.enum(LANDMARK_CATEGORIES),
  lat: z.coerce.number().finite().min(-90).max(90),
  lng: z.coerce.number().finite().min(-180).max(180),
  driveMinutes: optionalPositiveInt,
});

export const teamSchema = z.object({
  nameEn: z.string().trim().min(2).max(120),
  nameKn: z.string().trim().max(160).default(""),
  roleEn: z.string().trim().max(120).default(""),
  roleKn: z.string().trim().max(160).default(""),
  phone: z.string().trim().max(20).default(""),
  bioEn: z.string().trim().max(2000).default(""),
  bioKn: z.string().trim().max(2500).default(""),
  published: z.boolean().default(true),
  sortOrder,
});

export const testimonialSchema = z.object({
  nameEn: z.string().trim().min(2).max(120),
  nameKn: z.string().trim().max(160).default(""),
  locationEn: z.string().trim().max(120).default(""),
  locationKn: z.string().trim().max(160).default(""),
  quoteEn: z.string().trim().max(1200).default(""),
  quoteKn: z.string().trim().max(1500).default(""),
  published: z.boolean().default(true),
  sortOrder,
});

const stat = z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().int().min(0)).default(0);

export const settingsSchema = z.object({
  companyNameEn: z.string().trim().min(2).max(200),
  companyNameKn: z.string().trim().max(240).default(""),
  taglineEn: z.string().trim().max(200).default(""),
  taglineKn: z.string().trim().max(240).default(""),
  phonePrimary: z.string().trim().max(20).default(""),
  phoneSecondary: z.string().trim().max(20).default(""),
  whatsapp: z.string().trim().max(20).default(""),
  email: z.string().trim().max(120).default(""),
  addressEn: z.string().trim().max(500).default(""),
  addressKn: z.string().trim().max(600).default(""),
  serviceAreaEn: z.string().trim().max(200).default(""),
  serviceAreaKn: z.string().trim().max(240).default(""),
  regNumber: z.string().trim().max(80).default(""),
  gstin: z.string().trim().max(20).default(""),
  establishedYear: optionalPositiveInt,
  aboutEn: z.string().trim().max(8000).default(""),
  aboutKn: z.string().trim().max(10000).default(""),
  heroTitleEn: z.string().trim().max(200).default(""),
  heroTitleKn: z.string().trim().max(240).default(""),
  heroSubtitleEn: z.string().trim().max(400).default(""),
  heroSubtitleKn: z.string().trim().max(480).default(""),
  officeLat: latitude,
  officeLng: longitude,
  workingHoursEn: z.string().trim().max(120).default(""),
  workingHoursKn: z.string().trim().max(160).default(""),
  statPropertiesSold: stat,
  statProjectsDelivered: stat,
  statClients: stat,
  showStats: z.boolean().default(false),
  facebookUrl: z.string().trim().max(300).default(""),
  instagramUrl: z.string().trim().max(300).default(""),
  youtubeUrl: z.string().trim().max(300).default(""),
  propertyPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,5}$/, "Use 2 to 5 letters"),
});

/** A district register: two to five letters that head every property number in it. */
export const regionSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,5}$/, "Use 2 to 5 letters"),
  nameEn: z.string().trim().max(80).default(""),
  nameKn: z.string().trim().max(120).default(""),
});

// ---------------------------------------------------------------- survey geometry

const latLng = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

const measuredFt = z.number().finite().positive().max(100_000).nullable().optional();

export const surveyGeometrySchema = z.object({
  pin: latLng.nullable(),
  pinLabel: z.string().trim().max(60).default(""),
  accuracyM: z.number().finite().min(0).max(100_000).nullable(),
  corners: z
    .array(latLng.extend({ acc: z.number().finite().min(0).nullable().optional(), src: z.enum(["gps", "map"]), lenFt: measuredFt }))
    .max(200),
  measures: z.array(z.object({ id: z.string().min(1).max(40), a: latLng, b: latLng, label: z.string().trim().max(80), lenFt: measuredFt })).max(100),
  points: z.array(latLng.extend({ id: z.string().min(1).max(40), label: z.string().trim().max(80) })).max(100),
});

export const surveyMetaSchema = z.object({
  title: z.string().trim().max(140).default(""),
  notes: z.string().trim().max(4000).default(""),
});

export type LeadInput = z.infer<typeof leadSchema>;
export { optionalInt, optionalNumber };
