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

/**
 * Where a lead stands, in the order a sale moves. "contacted" is shown as "Talked". For someone
 * selling, "advance" reads as listed and "registered" as sold.
 */
export const LEAD_STATUSES = ["new", "contacted", "visit_booked", "visited", "negotiating", "advance", "registered", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
/** The stages that still need the office to do something. */
export const OPEN_LEAD_STATUSES = ["new", "contacted", "visit_booked", "visited", "negotiating", "advance"] as const;

/** How likely the office thinks the lead is to go through, set by hand after talking to them. */
export const LEAD_TEMPERATURES = ["", "hot", "warm", "cold"] as const;
export type LeadTemperature = (typeof LEAD_TEMPERATURES)[number];

/** The one thing the office has to do next for a lead. */
export const NEXT_KINDS = ["", "call", "visit", "send", "other"] as const;
export type NextKind = (typeof NEXT_KINDS)[number];

/** What is written into a lead's history. */
export const LEAD_EVENT_KINDS = ["call", "visit", "whatsapp", "note", "stage"] as const;
export type LeadEventKind = (typeof LEAD_EVENT_KINDS)[number];

/** How a call or a visit went. */
export const CONTACT_OUTCOMES = ["talked", "no_answer", "busy", "wrong_number", "came", "did_not_come"] as const;
export type ContactOutcome = (typeof CONTACT_OUTCOMES)[number];

export const LOST_REASONS = ["budget", "bought_elsewhere", "location", "unreachable", "just_looking", "other"] as const;
export type LostReason = (typeof LOST_REASONS)[number];

export const LEAD_KINDS = ["buy", "sell"] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];

/** Who brought a listing to the office: the owner directly, or a broker. Office only. */
export const LISTING_SOURCES = ["seller", "broker"] as const;
export type ListingSource = (typeof LISTING_SOURCES)[number];

export const LEAD_PURPOSES = ["self_use", "investment", "other"] as const;
export type LeadPurpose = (typeof LEAD_PURPOSES)[number];
/** A lead's purpose, or "" when the buyer has not said: the quick enquiry asks for it after the number. */
export const LEAD_PURPOSE_ANSWERS = ["", ...LEAD_PURPOSES] as const;
export type LeadPurposeAnswer = (typeof LEAD_PURPOSE_ANSWERS)[number];

/**
 * Where an Instagram conversation stands for the office.
 * needs_you: the automation could not answer, or it is switched off. auto: answered
 * automatically, nothing to do. replied: the office answered and is waiting on them.
 */
export const IG_STATES = ["needs_you", "auto", "replied", "closed", "spam"] as const;
export type IgState = (typeof IG_STATES)[number];

/** What an Instagram conversation is about, as far as it can be told. */
export const IG_TOPICS = ["reel", "property", "price", "location", "visit", "sell", "number", "greeting", "other"] as const;
export type IgTopic = (typeof IG_TOPICS)[number];

export const IG_MESSAGE_KINDS = ["text", "reel", "post", "story", "comment", "media", "other"] as const;
export type IgMessageKind = (typeof IG_MESSAGE_KINDS)[number];

/** Who wrote a message: the visitor, the automation, the office from this site, or the Instagram app (or another tool). */
export const IG_SENDERS = ["them", "auto", "office", "app"] as const;
export type IgSender = (typeof IG_SENDERS)[number];

/** What a scheduled Instagram post is: a reel (a video) or a single photo. */
export const IG_POST_KINDS = ["reel", "photo"] as const;
export type IgPostKind = (typeof IG_POST_KINDS)[number];

/**
 * Where a scheduled post stands. scheduled: waiting for its time. processing: Instagram is
 * preparing the file. publishing: being put up this moment. published: it is on Instagram.
 * failed: it did not go out, and says why.
 */
export const IG_POST_STATUSES = ["scheduled", "processing", "publishing", "published", "failed"] as const;
export type IgPostStatus = (typeof IG_POST_STATUSES)[number];

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
