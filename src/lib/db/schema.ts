import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { Approval, BilingualItem, SurveyCorner, SurveyMeasure, SurveyPoint, VideoItem } from "./enums";
import { AREA_UNITS, FACINGS, IG_MESSAGE_KINDS, IG_SENDERS, IG_STATES, IG_TOPICS, LANDMARK_CATEGORIES, LEAD_KINDS, LEAD_PURPOSE_ANSWERS, LEAD_STATUSES, LISTING_SOURCES, LISTING_STATUSES, PRICE_DISPLAYS, PROJECT_STATUSES, PROPERTY_TYPES } from "./enums";

export * from "./enums";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
};

// ---------------------------------------------------------------- tables

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  companyNameEn: text("company_name_en").notNull().default("RSP Ventures"),
  companyNameKn: text("company_name_kn").notNull().default("ಆರ್‌ಎಸ್‌ಪಿ ವೆಂಚರ್ಸ್"),
  taglineEn: text("tagline_en").notNull().default(""),
  taglineKn: text("tagline_kn").notNull().default(""),
  phonePrimary: text("phone_primary").notNull().default("9113520194"),
  phoneSecondary: text("phone_secondary").notNull().default(""),
  whatsapp: text("whatsapp").notNull().default("9113520194"),
  email: text("email").notNull().default("rspventuresss@gmail.com"),
  addressEn: text("address_en").notNull().default(""),
  addressKn: text("address_kn").notNull().default(""),
  serviceAreaEn: text("service_area_en").notNull().default(""),
  serviceAreaKn: text("service_area_kn").notNull().default(""),
  regNumber: text("reg_number").notNull().default(""),
  gstin: text("gstin").notNull().default(""),
  establishedYear: integer("established_year"),
  aboutEn: text("about_en").notNull().default(""),
  aboutKn: text("about_kn").notNull().default(""),
  heroImage: text("hero_image").notNull().default(""),
  heroTitleEn: text("hero_title_en").notNull().default(""),
  heroTitleKn: text("hero_title_kn").notNull().default(""),
  heroSubtitleEn: text("hero_subtitle_en").notNull().default(""),
  heroSubtitleKn: text("hero_subtitle_kn").notNull().default(""),
  officeLat: real("office_lat"),
  officeLng: real("office_lng"),
  workingHoursEn: text("working_hours_en").notNull().default(""),
  workingHoursKn: text("working_hours_kn").notNull().default(""),
  statPropertiesSold: integer("stat_properties_sold").notNull().default(0),
  statProjectsDelivered: integer("stat_projects_delivered").notNull().default(0),
  statClients: integer("stat_clients").notNull().default(0),
  /** Whether the home page shows its band of figures. Off until there is something worth showing. */
  showStats: integer("show_stats", { mode: "boolean" }).notNull().default(false),
  facebookUrl: text("facebook_url").notNull().default(""),
  instagramUrl: text("instagram_url").notNull().default(""),
  youtubeUrl: text("youtube_url").notNull().default(""),
  /** The district code new listings take unless another is chosen: the HSN in HSN-0001. */
  propertyPrefix: text("property_prefix").notNull().default("HSN"),
  /** True while the database still holds the placeholder content from the seed script. */
  demoContent: integer("demo_content", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * One register per district. Each has its own code and its own run of numbers, so Hassan
 * issues HSN-0001, HSN-0002 and Mysuru issues MYS-0001, MYS-0002. A code is never renamed
 * once a listing carries it, and a number is never handed out twice.
 */
export const regions = sqliteTable("regions", {
  code: text("code").primaryKey(),
  nameEn: text("name_en").notNull().default(""),
  nameKn: text("name_kn").notNull().default(""),
  /** The number the next new property or project in this district will receive. */
  nextNo: integer("next_no").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const projects = sqliteTable(
  "projects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** District code, the HSN in HSN-0034. */
    prefix: text("prefix").notNull().default("HSN"),
    /** Shares the district's sequence with properties.propertyNo, so prefix and number identify exactly one listing. */
    propertyNo: integer("property_no").notNull(),
    slug: text("slug").notNull().unique(),
    nameEn: text("name_en").notNull(),
    nameKn: text("name_kn").notNull().default(""),
    taglineEn: text("tagline_en").notNull().default(""),
    taglineKn: text("tagline_kn").notNull().default(""),
    descriptionEn: text("description_en").notNull().default(""),
    descriptionKn: text("description_kn").notNull().default(""),
    locationEn: text("location_en").notNull().default(""),
    locationKn: text("location_kn").notNull().default(""),
    lat: real("lat"),
    lng: real("lng"),
    totalAreaAcres: real("total_area_acres"),
    totalSites: integer("total_sites"),
    status: text("status", { enum: PROJECT_STATUSES }).notNull().default("ongoing"),
    approvals: text("approvals", { mode: "json" })
      .$type<Approval[]>()
      .notNull()
      .default(sql`'[]'`),
    amenities: text("amenities", { mode: "json" })
      .$type<BilingualItem[]>()
      .notNull()
      .default(sql`'[]'`),
    coverImage: text("cover_image").notNull().default(""),
    gallery: text("gallery", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    layoutPlanImage: text("layout_plan_image").notNull().default(""),
    brochureUrl: text("brochure_url").notNull().default(""),
    videos: text("videos", { mode: "json" })
      .$type<VideoItem[]>()
      .notNull()
      .default(sql`'[]'`),
    priceFrom: integer("price_from"),
    pricePerSqft: integer("price_per_sqft"),
    /** Show "Call for price" for the project and every site in it, whatever prices are stored. */
    callForPrice: integer("call_for_price", { mode: "boolean" }).notNull().default(false),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    published: integer("published", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Set by the seed script, so placeholder rows can be removed without touching real ones. */
    isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("projects_ref").on(t.prefix, t.propertyNo)],
);

/**
 * Brokers who bring properties to the office, kept so the same broker is found again rather
 * than typed in twice. Office only: nothing in this table is ever sent to the public website.
 */
export const brokers = sqliteTable("brokers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  firm: text("firm").notNull().default(""),
  notes: text("notes").notNull().default(""),
  ...timestamps,
});

/** A listing that stands on its own: a single site, house, parcel of land or building. */
export const properties = sqliteTable(
  "properties",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** District code, the HSN in HSN-0001. */
    prefix: text("prefix").notNull().default("HSN"),
    propertyNo: integer("property_no").notNull(),
    type: text("type", { enum: PROPERTY_TYPES }).notNull().default("residential_site"),
    titleEn: text("title_en").notNull(),
    titleKn: text("title_kn").notNull().default(""),
    locationEn: text("location_en").notNull().default(""),
    locationKn: text("location_kn").notNull().default(""),
    descriptionEn: text("description_en").notNull().default(""),
    descriptionKn: text("description_kn").notNull().default(""),
    lat: real("lat"),
    lng: real("lng"),
    dimension: text("dimension").notNull().default(""),
    widthFt: real("width_ft"),
    depthFt: real("depth_ft"),
    areaSqft: real("area_sqft"),
    /** Unit the area is quoted in on the website. The stored figure is always square feet. */
    areaUnit: text("area_unit", { enum: AREA_UNITS }).notNull().default("sqft"),
    builtUpSqft: real("built_up_sqft"),
    bedrooms: integer("bedrooms"),
    floors: integer("floors"),
    facing: text("facing", { enum: FACINGS }),
    roadWidthFt: real("road_width_ft"),
    corner: integer("corner", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: LISTING_STATUSES }).notNull().default("available"),
    price: integer("price"),
    pricePerSqft: integer("price_per_sqft"),
    negotiable: integer("negotiable", { mode: "boolean" }).notNull().default(false),
    /** Which of the two figures the website shows. The other stays for office use. */
    priceDisplay: text("price_display", { enum: PRICE_DISPLAYS }).notNull().default("both"),
    /** Show "Call for price" on the website. The stored figure stays for office use and is never sent out. */
    callForPrice: integer("call_for_price", { mode: "boolean" }).notNull().default(false),
    documents: text("documents", { mode: "json" })
      .$type<Approval[]>()
      .notNull()
      .default(sql`'[]'`),
    features: text("features", { mode: "json" })
      .$type<BilingualItem[]>()
      .notNull()
      .default(sql`'[]'`),
    images: text("images", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    videos: text("videos", { mode: "json" })
      .$type<VideoItem[]>()
      .notNull()
      .default(sql`'[]'`),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    published: integer("published", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    // Office-only fields. Never sent to the public website.
    ownerName: text("owner_name").notNull().default(""),
    ownerPhone: text("owner_phone").notNull().default(""),
    privateNotes: text("private_notes").notNull().default(""),
    /** Who brought the property: the owner, or a broker from the brokers list. */
    source: text("source", { enum: LISTING_SOURCES }).notNull().default("seller"),
    brokerId: integer("broker_id").references(() => brokers.id, { onDelete: "set null" }),
    /** The agreement with the owner, or the commission agreed with the broker. */
    dealTerms: text("deal_terms").notNull().default(""),
    /** Set by the seed script, so placeholder rows can be removed without touching real ones. */
    isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("properties_ref").on(t.prefix, t.propertyNo)],
);

export const sites = sqliteTable(
  "sites",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** The number in brackets: site 12 of project HSN-0034 is HSN-0034(012). */
    siteNo: integer("site_no").notNull(),
    dimension: text("dimension").notNull().default(""),
    widthFt: real("width_ft"),
    depthFt: real("depth_ft"),
    areaSqft: real("area_sqft"),
    facing: text("facing", { enum: FACINGS }),
    roadWidthFt: real("road_width_ft"),
    corner: integer("corner", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: LISTING_STATUSES }).notNull().default("available"),
    price: integer("price"),
    pricePerSqft: integer("price_per_sqft"),
    /** Show "Call for price" for this site. The stored figure stays for office use. */
    callForPrice: integer("call_for_price", { mode: "boolean" }).notNull().default(false),
    /** Which of the two figures the website shows. The other stays for office use. */
    priceDisplay: text("price_display", { enum: PRICE_DISPLAYS }).notNull().default("both"),
    lat: real("lat"),
    lng: real("lng"),
    descriptionEn: text("description_en").notNull().default(""),
    descriptionKn: text("description_kn").notNull().default(""),
    images: text("images", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    videos: text("videos", { mode: "json" })
      .$type<VideoItem[]>()
      .notNull()
      .default(sql`'[]'`),
    features: text("features", { mode: "json" })
      .$type<BilingualItem[]>()
      .notNull()
      .default(sql`'[]'`),
    ...timestamps,
  },
  (t) => [uniqueIndex("sites_project_site_no").on(t.projectId, t.siteNo)],
);

export const landmarks = sqliteTable("landmarks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  propertyId: integer("property_id").references(() => properties.id, { onDelete: "cascade" }),
  nameEn: text("name_en").notNull(),
  nameKn: text("name_kn").notNull().default(""),
  category: text("category", { enum: LANDMARK_CATEGORIES }).notNull().default("other"),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  driveMinutes: integer("drive_minutes"),
  sortOrder: integer("sort_order").notNull().default(0),
});

/**
 * A field survey: a GPS pin, the plot boundary walked or drawn on site, extra distance
 * lines and photos. Captured on a phone, refined on a desktop, then attached to a listing.
 */
export const surveys = sqliteTable("surveys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull().default(""),
  notes: text("notes").notNull().default(""),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  propertyId: integer("property_id").references(() => properties.id, { onDelete: "set null" }),
  siteId: integer("site_id").references(() => sites.id, { onDelete: "set null" }),
  lat: real("lat"),
  lng: real("lng"),
  accuracyM: real("accuracy_m"),
  /** The name written on the pin. Blank shows the property number of the listing it is attached to. */
  pinLabel: text("pin_label").notNull().default(""),
  corners: text("corners", { mode: "json" })
    .$type<SurveyCorner[]>()
    .notNull()
    .default(sql`'[]'`),
  measures: text("measures", { mode: "json" })
    .$type<SurveyMeasure[]>()
    .notNull()
    .default(sql`'[]'`),
  points: text("points", { mode: "json" })
    .$type<SurveyPoint[]>()
    .notNull()
    .default(sql`'[]'`),
  photos: text("photos", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  areaSqft: real("area_sqft"),
  perimeterFt: real("perimeter_ft"),
  /** Set by the seed script, so placeholder rows can be removed without touching real ones. */
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});

export const teamMembers = sqliteTable("team_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nameEn: text("name_en").notNull(),
  nameKn: text("name_kn").notNull().default(""),
  roleEn: text("role_en").notNull().default(""),
  roleKn: text("role_kn").notNull().default(""),
  photo: text("photo").notNull().default(""),
  phone: text("phone").notNull().default(""),
  bioEn: text("bio_en").notNull().default(""),
  bioKn: text("bio_kn").notNull().default(""),
  published: integer("published", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
});

export const testimonials = sqliteTable("testimonials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nameEn: text("name_en").notNull(),
  nameKn: text("name_kn").notNull().default(""),
  locationEn: text("location_en").notNull().default(""),
  locationKn: text("location_kn").notNull().default(""),
  quoteEn: text("quote_en").notNull().default(""),
  quoteKn: text("quote_kn").notNull().default(""),
  photo: text("photo").notNull().default(""),
  published: integer("published", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
});

export const leads = sqliteTable("leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind", { enum: LEAD_KINDS }).notNull().default("buy"),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull().default(""),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  siteId: integer("site_id").references(() => sites.id, { onDelete: "set null" }),
  propertyId: integer("property_id").references(() => properties.id, { onDelete: "set null" }),
  /** Property number as the visitor saw it, kept even if the listing is later deleted. */
  ref: text("ref").notNull().default(""),
  purpose: text("purpose", { enum: LEAD_PURPOSE_ANSWERS }).notNull().default("self_use"),
  budget: text("budget").notNull().default(""),
  timeline: text("timeline").notNull().default(""),
  message: text("message").notNull().default(""),
  locale: text("locale").notNull().default("en"),
  source: text("source").notNull().default(""),
  status: text("status", { enum: LEAD_STATUSES }).notNull().default("new"),
  notes: text("notes").notNull().default(""),
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
  /**
   * A random key held by the visitor's browser, so the quick enquiry card keeps adding to one
   * enquiry: the number as it is typed, then the sent form, then the answers. Blank elsewhere.
   */
  draftKey: text("draft_key").notNull().default(""),
  /** False while the visitor has typed a number on the quick enquiry card without pressing send. */
  sent: integer("sent", { mode: "boolean" }).notNull().default(true),
  /** The PostHog recording of the visit the enquiry came from, for the office to watch. */
  sessionId: text("session_id").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [uniqueIndex("leads_draft_key_unique").on(t.draftKey).where(sql`draft_key <> ''`)]);

// ---------------------------------------------------------------- Instagram desk

/** One conversation with one Instagram account, whether it began as a DM or a comment. */
export const igThreads = sqliteTable(
  "ig_threads",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Instagram's id for this person, as given to this account. */
    igUserId: text("ig_user_id").notNull(),
    username: text("username").notNull().default(""),
    name: text("name").notNull().default(""),
    state: text("state", { enum: IG_STATES }).notNull().default("needs_you"),
    topic: text("topic", { enum: IG_TOPICS }).notNull().default("other"),
    /** The property they are asking about, once a reel or a number has said so. */
    ref: text("ref").notNull().default(""),
    projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
    siteId: integer("site_id").references(() => sites.id, { onDelete: "set null" }),
    propertyId: integer("property_id").references(() => properties.id, { onDelete: "set null" }),
    /** The lead made when they sent a phone number. */
    leadId: integer("lead_id").references(() => leads.id, { onDelete: "set null" }),
    phone: text("phone").notNull().default(""),
    /** True once the office has taken the conversation over: the automation stays out of it. */
    autoPaused: integer("auto_paused", { mode: "boolean" }).notNull().default(false),
    unread: integer("unread").notNull().default(0),
    /** When they last wrote. Instagram allows a reply for 24 hours after this. */
    lastInboundAt: integer("last_inbound_at", { mode: "timestamp" }),
    lastMessageAt: integer("last_message_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    lastText: text("last_text").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("ig_threads_user_unique").on(t.igUserId)],
);

export const igMessages = sqliteTable(
  "ig_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    threadId: integer("thread_id")
      .notNull()
      .references(() => igThreads.id, { onDelete: "cascade" }),
    direction: text("direction", { enum: ["in", "out"] }).notNull(),
    kind: text("kind", { enum: IG_MESSAGE_KINDS }).notNull().default("text"),
    sender: text("sender", { enum: IG_SENDERS }).notNull().default("them"),
    text: text("text").notNull().default(""),
    /** Instagram's id for the message or comment; a second delivery of the same one is ignored. */
    mid: text("mid").notNull().default(""),
    /** The reel or post concerned: shared in the DM, or commented on. */
    mediaId: text("media_id").notNull().default(""),
    mediaUrl: text("media_url").notNull().default(""),
    mediaTitle: text("media_title").notNull().default(""),
    /** Why sending failed, when it did. */
    failed: text("failed").notNull().default(""),
    /** What Instagram sent, kept for a while to learn its shapes. Never shown in public. */
    raw: text("raw").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("ig_messages_mid_unique").on(t.mid).where(sql`mid <> ''`)],
);

/** A reel or post, and the listing it is about. Filled from the account's own posts and from reels shared in DMs. */
export const igMedia = sqliteTable(
  "ig_media",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mediaId: text("media_id").notNull(),
    kind: text("kind").notNull().default("reel"),
    caption: text("caption").notNull().default(""),
    permalink: text("permalink").notNull().default(""),
    thumbnail: text("thumbnail").notNull().default(""),
    postedAt: integer("posted_at", { mode: "timestamp" }),
    ref: text("ref").notNull().default(""),
    projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
    siteId: integer("site_id").references(() => sites.id, { onDelete: "set null" }),
    propertyId: integer("property_id").references(() => properties.id, { onDelete: "set null" }),
    /** Comments counted last time, so only reels with new comments are looked at again. */
    commentsCount: integer("comments_count").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("ig_media_media_unique").on(t.mediaId)],
);

/** One row: the switches, the wording of the automatic replies, and the connection to Instagram. */
export const igSettings = sqliteTable("ig_settings", {
  id: integer("id").primaryKey(),
  /** Automatic replies to DMs. Off until the office turns it on, so it never answers beside another tool. */
  dmAuto: integer("dm_auto", { mode: "boolean" }).notNull().default(false),
  /** Automatic replies to comments: a public line and the details by DM. */
  commentAuto: integer("comment_auto", { mode: "boolean" }).notNull().default(false),
  /** No longer read: every comment on a reel tied to a property is answered unless words are given below. */
  commentAll: integer("comment_all", { mode: "boolean" }).notNull().default(false),
  /** The office's own words that a comment must carry to be answered. Empty for no such limit. */
  commentWords: text("comment_words").notNull().default(""),
  /** When comment replies were last switched on. Comments older than this are left alone. */
  commentSince: integer("comment_since", { mode: "timestamp" }),
  /** Language of the listing link sent in replies. */
  linkLocale: text("link_locale", { enum: ["en", "kn"] }).notNull().default("kn"),
  /** The replies' wording. Blank means the built-in text. */
  templates: text("templates", { mode: "json" }).$type<Record<string, string>>().notNull().default({}),
  /** The connection. The token is only ever read on the server. */
  accessToken: text("access_token").notNull().default(""),
  tokenExpiresAt: integer("token_expires_at", { mode: "timestamp" }),
  igUserId: text("ig_user_id").notNull().default(""),
  igUsername: text("ig_username").notNull().default(""),
  lastWebhookAt: integer("last_webhook_at", { mode: "timestamp" }),
  lastError: text("last_error").notNull().default(""),
  ...timestamps,
});

export type IgThread = typeof igThreads.$inferSelect;
export type IgMessage = typeof igMessages.$inferSelect;
export type IgMediaRow = typeof igMedia.$inferSelect;
export type IgSettings = typeof igSettings.$inferSelect;

export type Settings = typeof settings.$inferSelect;
export type Region = typeof regions.$inferSelect;
export type NewRegion = typeof regions.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Broker = typeof brokers.$inferSelect;
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type Landmark = typeof landmarks.$inferSelect;
export type NewLandmark = typeof landmarks.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
export type Survey = typeof surveys.$inferSelect;
export type NewSurvey = typeof surveys.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type Testimonial = typeof testimonials.$inferSelect;
export type NewTestimonial = typeof testimonials.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
