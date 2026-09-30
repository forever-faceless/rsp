/**
 * Value lists and JSON shapes shared by the database schema and the browser.
 * Kept free of database imports so client components can use them without pulling in Drizzle.
 */

export const PROJECT_STATUSES = ["upcoming", "ongoing", "completed", "sold_out"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Shared by independent properties and by sites inside a project. */
export const LISTING_STATUSES = ["available", "reserved", "sold"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const PROPERTY_TYPES = ["residential_site", "commercial_site", "house", "farm_land", "commercial_building"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

/** What a listing shows of its price on the website: the total and the rate, the total alone, or the rate alone. */
export const PRICE_DISPLAYS = ["both", "total", "rate"] as const;
export type PriceDisplay = (typeof PRICE_DISPLAYS)[number];

export const AREA_UNITS = ["sqft", "guntas", "acres", "cents"] as const;
export type AreaUnit = (typeof AREA_UNITS)[number];

export const FACINGS = ["N", "S", "E", "W", "NE", "NW", "SE", "SW"] as const;
export type Facing = (typeof FACINGS)[number];

export const LANDMARK_CATEGORIES = [
  "city_centre",
  "bus_stand",
  "railway",
  "highway",
  "hospital",
  "school",
  "college",
  "market",
  "temple",
  "industrial",
  "park",
  "airport",
  "other",
] as const;
export type LandmarkCategory = (typeof LANDMARK_CATEGORIES)[number];

export const LEAD_STATUSES = ["new", "contacted", "qualified", "closed"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_KINDS = ["buy", "sell"] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];

export const LEAD_PURPOSES = ["self_use", "investment", "other"] as const;
export type LeadPurpose = (typeof LEAD_PURPOSES)[number];

/** Bilingual free-text item used in JSON columns (amenities, features). */
export type BilingualItem = { en: string; kn: string };
export type Approval = { en: string; kn: string; number: string };

/** A stored video: either a file we host or a link to YouTube / Instagram. */
export type VideoItem = { url: string; title: string; kind: "file" | "link" };

// ---------------------------------------------------------------- survey geometry

export type LatLng = { lat: number; lng: number };

/**
 * One corner of a plot boundary. `lenFt` is the tape-measured length of the side that
 * runs from this corner to the next one; when set it is shown instead of the GPS-derived length.
 */
export type SurveyCorner = LatLng & {
  /** GPS accuracy in metres at capture time, when the corner came from the phone's GPS. */
  acc?: number | null;
  src: "gps" | "map";
  lenFt?: number | null;
};

/** An extra distance line drawn on the map, such as "site to main road". */
export type SurveyMeasure = { id: string; a: LatLng; b: LatLng; label: string; lenFt?: number | null };

/** A labelled point of interest on the plot, such as a borewell or the entrance. */
export type SurveyPoint = LatLng & { id: string; label: string };

/** The geometry of a survey, as edited in the browser and stored on the survey row. */
export type SurveyGeometry = {
  /** Where the property is. This one pin is the location the listing is saved and shown with. */
  pin: LatLng | null;
  /** The name written on the pin. Blank shows the property number instead. */
  pinLabel: string;
  accuracyM: number | null;
  corners: SurveyCorner[];
  measures: SurveyMeasure[];
  points: SurveyPoint[];
};
