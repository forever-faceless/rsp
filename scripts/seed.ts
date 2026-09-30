/**
 * Seeds DEMO content so the site looks alive on first run.
 * Everything here (names, prices, approval numbers, coordinates) is placeholder data, and
 * every row is marked as demo so the admin panel can remove it in one step.
 *
 *   npm run db:seed              insert the demo content into an empty database
 *   npm run db:seed -- --reset   wipe all content first, then insert it
 */
import { eq, sql } from "drizzle-orm";
import { getDb } from "../src/lib/db/client";
import type { Facing, ListingStatus, SurveyCorner, SurveyMeasure } from "../src/lib/db/enums";
import { landmarks, leads, projects, properties, regions, settings, sites, surveys, teamMembers, testimonials, type NewSite, type NewSurvey } from "../src/lib/db/schema";
import { DEMO_SETTINGS } from "../src/lib/demo";
import { destination, FT_PER_M, polygonAreaSqft, roundTo } from "../src/lib/geo";
import { summariseSurvey } from "../src/lib/survey";

type LatLng = { lat: number; lng: number };

const ft = (n: number) => n / FT_PER_M;

/** A rectangular plot. `x` runs along `bearing`, `y` runs 90 degrees clockwise from it; both in feet. */
function plot(origin: LatLng, bearing: number, x: number, y: number, width: number, depth: number): SurveyCorner[] {
  const at = (px: number, py: number) => destination(destination(origin, bearing, ft(px)), bearing + 90, ft(py));
  const ring = [at(x, y), at(x + width, y), at(x + width, y + depth), at(x, y + depth)];
  const lengths = [width, depth, width, depth];
  return ring.map((p, i) => ({ lat: roundTo(p.lat, 7), lng: roundTo(p.lng, 7), src: "map" as const, lenFt: lengths[i] }));
}

function centre(points: LatLng[]): LatLng {
  return { lat: roundTo(points.reduce((s, p) => s + p.lat, 0) / points.length, 7), lng: roundTo(points.reduce((s, p) => s + p.lng, 0) / points.length, 7) };
}

function survey(corners: SurveyCorner[], extra: Partial<NewSurvey> = {}): NewSurvey {
  const c = centre(corners);
  const summary = summariseSurvey(corners);
  return { corners, lat: c.lat, lng: c.lng, areaSqft: summary.areaSqft, perimeterFt: summary.perimeterFt, isDemo: true, ...extra };
}

const hassanLandmarks = {
  centre: { nameEn: "N.R. Circle, Hassan", nameKn: "ಎನ್.ಆರ್. ವೃತ್ತ, ಹಾಸನ", category: "city_centre" as const, lat: 13.0072, lng: 76.0996 },
  bus: { nameEn: "KSRTC Bus Stand", nameKn: "ಕೆಎಸ್ಆರ್‌ಟಿಸಿ ಬಸ್ ನಿಲ್ದಾಣ", category: "bus_stand" as const, lat: 13.0033, lng: 76.1046 },
  rail: { nameEn: "Hassan Railway Station", nameKn: "ಹಾಸನ ರೈಲು ನಿಲ್ದಾಣ", category: "railway" as const, lat: 13.0112, lng: 76.1141 },
  highway: { nameEn: "NH-75 junction", nameKn: "NH-75 ಜಂಕ್ಷನ್", category: "highway" as const, lat: 13.018, lng: 76.123 },
  hospital: { nameEn: "HIMS Hospital", nameKn: "ಹಿಮ್ಸ್ ಆಸ್ಪತ್ರೆ", category: "hospital" as const, lat: 13.0035, lng: 76.0919 },
  college: { nameEn: "Malnad College of Engineering", nameKn: "ಮಲೆನಾಡು ಇಂಜಿನಿಯರಿಂಗ್ ಕಾಲೇಜು", category: "college" as const, lat: 12.999, lng: 76.121 },
};

/** District registers. Real configuration rather than demo content, so the clean-up leaves them alone. */
const DISTRICTS = [
  { code: "HSN", nameEn: "Hassan", nameKn: "ಹಾಸನ" },
  { code: "MYS", nameEn: "Mysuru", nameKn: "ಮೈಸೂರು" },
  { code: "BNG", nameEn: "Bengaluru", nameKn: "ಬೆಂಗಳೂರು" },
];

async function main() {
  const db = await getDb();
  const reset = process.argv.includes("--reset");

  const existing = (await db.query.projects.findFirst()) ?? (await db.query.properties.findFirst());
  if (existing && !reset) {
    console.log("The database already has listings. Use `npm run db:seed -- --reset` to replace everything.");
    return;
  }
  if (reset) {
    await db.delete(leads);
    await db.delete(surveys);
    await db.delete(landmarks);
    await db.delete(sites);
    await db.delete(projects);
    await db.delete(properties);
    await db.delete(testimonials);
    await db.delete(teamMembers);
    await db.delete(settings);
  }

  await db
    .insert(settings)
    .values({
      id: 1,
      ...DEMO_SETTINGS,
      serviceAreaEn: "",
      serviceAreaKn: "",
      propertyPrefix: "HSN",
      demoContent: true,
    })
    .onConflictDoUpdate({ target: settings.id, set: { ...DEMO_SETTINGS, demoContent: true } });

  for (const [i, r] of DISTRICTS.entries()) {
    await db
      .insert(regions)
      .values({ ...r, sortOrder: i })
      .onConflictDoUpdate({ target: regions.code, set: { nameEn: r.nameEn, nameKn: r.nameKn, sortOrder: i } });
  }

  // ------------------------------------------------------------ independent properties

  const p1 = plot({ lat: 13.01462, lng: 76.09318 }, 84, 0, 0, 30, 40);
  const p2 = plot({ lat: 13.02318, lng: 76.12655 }, 102, 0, 0, 40, 60);
  const p3 = plot({ lat: 13.00012, lng: 76.10988 }, 8, 0, 0, 30, 50);
  const p5 = plot({ lat: 13.00655, lng: 76.10442 }, 96, 0, 0, 50, 80);
  const p6 = plot({ lat: 12.99105, lng: 76.08732 }, 276, 0, 0, 30, 50);
  // Farm land is rarely a rectangle; this one has five corners walked with GPS.
  const farm: SurveyCorner[] = [
    { lat: 13.06122, lng: 76.15518, src: "gps", acc: 3.2 },
    { lat: 13.06141, lng: 76.15632, src: "gps", acc: 2.8 },
    { lat: 13.06068, lng: 76.15671, src: "gps", acc: 3.6 },
    { lat: 13.05988, lng: 76.15624, src: "gps", acc: 4.1 },
    { lat: 13.06004, lng: 76.15506, src: "gps", acc: 3.0 },
  ];
  const farmArea = Math.round(polygonAreaSqft(farm));

  const documents = [
    { en: "E-khata", kn: "ಇ-ಖಾತೆ", number: "" },
    { en: "Encumbrance certificate, 30 years", kn: "ಋಣಭಾರ ಪ್ರಮಾಣಪತ್ರ, 30 ವರ್ಷ", number: "" },
    { en: "Tax paid receipt, current year", kn: "ತೆರಿಗೆ ಪಾವತಿ ರಶೀದಿ, ಪ್ರಸಕ್ತ ವರ್ಷ", number: "" },
  ];

  const inserted = await db
    .insert(properties)
    .values([
      {
        propertyNo: 1,
        type: "residential_site",
        titleEn: "East facing site in Vidyanagar",
        titleKn: "ವಿದ್ಯಾನಗರದಲ್ಲಿ ಪೂರ್ವ ದಿಕ್ಕಿನ ನಿವೇಶನ",
        locationEn: "Vidyanagar, Hassan",
        locationKn: "ವಿದ್ಯಾನಗರ, ಹಾಸನ",
        descriptionEn:
          "A level 30 × 40 site on a quiet residential street in Vidyanagar, with houses already built on both sides.\n\nThe road in front is a 30 ft tar road. Water and underground drainage lines run along it, and the site has been fenced at all four corners.",
        descriptionKn:
          "ವಿದ್ಯಾನಗರದ ಶಾಂತ ವಸತಿ ರಸ್ತೆಯಲ್ಲಿರುವ ಸಮತಟ್ಟಾದ 30 × 40 ನಿವೇಶನ. ಎರಡೂ ಬದಿಯಲ್ಲಿ ಈಗಾಗಲೇ ಮನೆಗಳಿವೆ.\n\nಮುಂದೆ 30 ಅಡಿ ಡಾಂಬರು ರಸ್ತೆ ಇದೆ. ನೀರು ಮತ್ತು ಒಳಚರಂಡಿ ಸಂಪರ್ಕ ರಸ್ತೆಯಲ್ಲೇ ಲಭ್ಯ. ನಾಲ್ಕೂ ಮೂಲೆಗಳಲ್ಲಿ ಗಡಿ ಕಲ್ಲುಗಳನ್ನು ಹಾಕಲಾಗಿದೆ.",
        ...centre(p1),
        dimension: "30 × 40",
        widthFt: 30,
        depthFt: 40,
        areaSqft: 1200,
        facing: "E",
        roadWidthFt: 30,
        status: "available",
        price: 2160000,
        pricePerSqft: 1800,
        negotiable: true,
        documents,
        features: [
          { en: "East facing", kn: "ಪೂರ್ವ ದಿಕ್ಕು" },
          { en: "Water and drainage on the street", kn: "ರಸ್ತೆಯಲ್ಲೇ ನೀರು ಮತ್ತು ಒಳಚರಂಡಿ" },
          { en: "Houses on both sides", kn: "ಎರಡೂ ಬದಿಯಲ್ಲಿ ಮನೆಗಳು" },
        ],
        featured: true,
        published: true,
        sortOrder: 2,
        isDemo: true,
      },
      {
        propertyNo: 2,
        type: "residential_site",
        titleEn: "Corner site near the ring road",
        titleKn: "ರಿಂಗ್ ರಸ್ತೆ ಬಳಿಯ ಮೂಲೆ ನಿವೇಶನ",
        locationEn: "Near Ring Road, Hassan",
        locationKn: "ರಿಂಗ್ ರಸ್ತೆ ಬಳಿ, ಹಾಸನ",
        descriptionEn:
          "A 40 × 60 corner site with roads on two sides, a short walk from the ring road.\n\nThe longer side faces a 40 ft road and the shorter side a 30 ft cross road, which makes it suitable for a house with separate parking access.",
        descriptionKn:
          "ಎರಡು ಬದಿಯಲ್ಲಿ ರಸ್ತೆ ಇರುವ 40 × 60 ಮೂಲೆ ನಿವೇಶನ. ರಿಂಗ್ ರಸ್ತೆಗೆ ನಡೆದು ಹೋಗುವಷ್ಟು ಹತ್ತಿರ.\n\nಉದ್ದದ ಬದಿ 40 ಅಡಿ ರಸ್ತೆಗೆ ಮತ್ತು ಚಿಕ್ಕ ಬದಿ 30 ಅಡಿ ಅಡ್ಡ ರಸ್ತೆಗೆ ಮುಖ ಮಾಡಿದೆ. ಪ್ರತ್ಯೇಕ ಪಾರ್ಕಿಂಗ್ ಪ್ರವೇಶವಿರುವ ಮನೆಗೆ ಸೂಕ್ತ.",
        ...centre(p2),
        dimension: "40 × 60",
        widthFt: 40,
        depthFt: 60,
        areaSqft: 2400,
        facing: "NE",
        roadWidthFt: 40,
        corner: true,
        status: "available",
        price: 5200000,
        pricePerSqft: 2167,
        documents,
        features: [
          { en: "Roads on two sides", kn: "ಎರಡು ಬದಿಯಲ್ಲಿ ರಸ್ತೆ" },
          { en: "40 ft main road", kn: "40 ಅಡಿ ಮುಖ್ಯ ರಸ್ತೆ" },
        ],
        featured: true,
        published: true,
        sortOrder: 1,
        isDemo: true,
      },
      {
        propertyNo: 3,
        type: "house",
        titleEn: "Three bedroom house in K.R. Puram",
        titleKn: "ಕೆ.ಆರ್. ಪುರಂನಲ್ಲಿ ಮೂರು ಕೋಣೆಗಳ ಮನೆ",
        locationEn: "K.R. Puram, Hassan",
        locationKn: "ಕೆ.ಆರ್. ಪುರಂ, ಹಾಸನ",
        descriptionEn:
          "A two storey house on a 30 × 50 site. Ground floor has the living room, kitchen, one bedroom and covered parking for one car. Two bedrooms and an open terrace are on the first floor.\n\nBuilt in 2019. Borewell and municipal water connection.",
        descriptionKn:
          "30 × 50 ನಿವೇಶನದಲ್ಲಿ ಎರಡು ಮಹಡಿಯ ಮನೆ. ನೆಲ ಮಹಡಿಯಲ್ಲಿ ಹಾಲ್, ಅಡುಗೆಮನೆ, ಒಂದು ಕೋಣೆ ಮತ್ತು ಒಂದು ಕಾರಿಗೆ ಪಾರ್ಕಿಂಗ್. ಮೊದಲ ಮಹಡಿಯಲ್ಲಿ ಎರಡು ಕೋಣೆಗಳು ಮತ್ತು ತೆರೆದ ಟೆರೇಸ್.\n\n2019 ರಲ್ಲಿ ನಿರ್ಮಿಸಲಾಗಿದೆ. ಬೋರ್‌ವೆಲ್ ಮತ್ತು ನಗರಸಭೆ ನೀರಿನ ಸಂಪರ್ಕವಿದೆ.",
        ...centre(p3),
        dimension: "30 × 50",
        widthFt: 30,
        depthFt: 50,
        areaSqft: 1500,
        builtUpSqft: 2100,
        bedrooms: 3,
        floors: 2,
        facing: "N",
        roadWidthFt: 30,
        status: "available",
        price: 9500000,
        documents,
        features: [
          { en: "Covered car parking", kn: "ಕಾರ್ ಪಾರ್ಕಿಂಗ್" },
          { en: "Borewell and municipal water", kn: "ಬೋರ್‌ವೆಲ್ ಮತ್ತು ನಗರಸಭೆ ನೀರು" },
          { en: "Open terrace", kn: "ತೆರೆದ ಟೆರೇಸ್" },
        ],
        published: true,
        sortOrder: 3,
        isDemo: true,
      },
      {
        propertyNo: 4,
        type: "farm_land",
        titleEn: "Farm land near Shantigrama",
        titleKn: "ಶಾಂತಿಗ್ರಾಮ ಬಳಿ ಕೃಷಿ ಜಮೀನು",
        locationEn: "Shantigrama hobli, Hassan taluk",
        locationKn: "ಶಾಂತಿಗ್ರಾಮ ಹೋಬಳಿ, ಹಾಸನ ತಾಲ್ಲೂಕು",
        descriptionEn:
          "Level agricultural land with a mud road along the northern edge. One borewell with a three phase connection. Currently under ragi and maize.\n\nThe boundary was walked with GPS; the side lengths on the plan are approximate and will be confirmed by a licensed surveyor before registration.",
        descriptionKn:
          "ಉತ್ತರ ಬದಿಯಲ್ಲಿ ಮಣ್ಣಿನ ರಸ್ತೆ ಇರುವ ಸಮತಟ್ಟಾದ ಕೃಷಿ ಜಮೀನು. ತ್ರೀ ಫೇಸ್ ಸಂಪರ್ಕದೊಂದಿಗೆ ಒಂದು ಬೋರ್‌ವೆಲ್. ಸದ್ಯ ರಾಗಿ ಮತ್ತು ಮೆಕ್ಕೆಜೋಳ ಬೆಳೆಯಲಾಗುತ್ತಿದೆ.\n\nಗಡಿಯನ್ನು ಜಿಪಿಎಸ್ ಮೂಲಕ ಗುರುತಿಸಲಾಗಿದೆ. ನಕ್ಷೆಯಲ್ಲಿರುವ ಬದಿಗಳ ಉದ್ದ ಅಂದಾಜು. ನೋಂದಣಿಗೆ ಮೊದಲು ಪರವಾನಗಿ ಪಡೆದ ಸರ್ವೇಯರ್ ಅದನ್ನು ಖಚಿತಪಡಿಸುತ್ತಾರೆ.",
        ...centre(farm),
        areaSqft: farmArea,
        areaUnit: "acres",
        status: "available",
        price: 6250000,
        documents: [
          { en: "RTC (pahani)", kn: "ಪಹಣಿ (ಆರ್‌ಟಿಸಿ)", number: "" },
          { en: "Mutation register extract", kn: "ಮ್ಯುಟೇಶನ್ ಪ್ರತಿ", number: "" },
        ],
        features: [
          { en: "Borewell with three phase power", kn: "ತ್ರೀ ಫೇಸ್ ವಿದ್ಯುತ್‌ನೊಂದಿಗೆ ಬೋರ್‌ವೆಲ್" },
          { en: "Road access on the northern side", kn: "ಉತ್ತರ ಬದಿಯಲ್ಲಿ ರಸ್ತೆ ಸಂಪರ್ಕ" },
        ],
        published: true,
        sortOrder: 4,
        isDemo: true,
      },
      {
        propertyNo: 5,
        callForPrice: true,
        type: "commercial_site",
        titleEn: "Commercial site on B.M. Road",
        titleKn: "ಬಿ.ಎಂ. ರಸ್ತೆಯಲ್ಲಿ ವಾಣಿಜ್ಯ ನಿವೇಶನ",
        locationEn: "B.M. Road, Hassan",
        locationKn: "ಬಿ.ಎಂ. ರಸ್ತೆ, ಹಾಸನ",
        descriptionEn: "A 50 × 80 commercial site with 50 ft of frontage on B.M. Road, between the bus stand and N.R. Circle.",
        descriptionKn: "ಬಿ.ಎಂ. ರಸ್ತೆಯಲ್ಲಿ 50 ಅಡಿ ಮುಂಭಾಗವಿರುವ 50 × 80 ವಾಣಿಜ್ಯ ನಿವೇಶನ. ಬಸ್ ನಿಲ್ದಾಣ ಮತ್ತು ಎನ್.ಆರ್. ವೃತ್ತದ ನಡುವೆ.",
        ...centre(p5),
        dimension: "50 × 80",
        widthFt: 50,
        depthFt: 80,
        areaSqft: 4000,
        facing: "S",
        roadWidthFt: 80,
        status: "reserved",
        price: 16000000,
        pricePerSqft: 4000,
        documents,
        published: true,
        sortOrder: 5,
        isDemo: true,
      },
      {
        propertyNo: 6,
        type: "residential_site",
        titleEn: "West facing site in Hemavathi Nagar",
        titleKn: "ಹೇಮಾವತಿ ನಗರದಲ್ಲಿ ಪಶ್ಚಿಮ ದಿಕ್ಕಿನ ನಿವೇಶನ",
        locationEn: "Hemavathi Nagar, Hassan",
        locationKn: "ಹೇಮಾವತಿ ನಗರ, ಹಾಸನ",
        ...centre(p6),
        dimension: "30 × 50",
        widthFt: 30,
        depthFt: 50,
        areaSqft: 1500,
        facing: "W",
        roadWidthFt: 30,
        status: "sold",
        price: 2475000,
        pricePerSqft: 1650,
        published: true,
        sortOrder: 6,
        isDemo: true,
      },
    ])
    .returning({ id: properties.id, propertyNo: properties.propertyNo });

  const propertyId = (no: number) => inserted.find((p) => p.propertyNo === no)!.id;

  const roadLine: SurveyMeasure = { id: "to-road", a: centre([p2[0], p2[1]]), b: destination(centre([p2[0], p2[1]]), 12, ft(210)), label: "To ring road", lenFt: 210 };
  await db.insert(surveys).values([
    survey(p1, { title: "Vidyanagar 30 × 40", propertyId: propertyId(1) }),
    survey(p2, { title: "Ring road corner site", propertyId: propertyId(2), measures: [roadLine] }),
    survey(p3, { title: "K.R. Puram house", propertyId: propertyId(3) }),
    survey(farm, { title: "Shantigrama farm land", propertyId: propertyId(4), accuracyM: 3.4, notes: "Walked the boundary with the owner. North-east corner stone is missing." }),
    survey(p5, { title: "B.M. Road commercial", propertyId: propertyId(5) }),
    survey(p6, { title: "Hemavathi Nagar 30 × 50", propertyId: propertyId(6) }),
  ]);

  await db.insert(landmarks).values([
    { propertyId: propertyId(1), ...hassanLandmarks.centre, driveMinutes: 8, sortOrder: 0 },
    { propertyId: propertyId(1), ...hassanLandmarks.hospital, driveMinutes: 6, sortOrder: 1 },
    { propertyId: propertyId(1), ...hassanLandmarks.bus, driveMinutes: 10, sortOrder: 2 },
    { propertyId: propertyId(2), ...hassanLandmarks.highway, driveMinutes: 3, sortOrder: 0 },
    { propertyId: propertyId(2), ...hassanLandmarks.rail, driveMinutes: 8, sortOrder: 1 },
    { propertyId: propertyId(2), ...hassanLandmarks.centre, driveMinutes: 12, sortOrder: 2 },
    { propertyId: propertyId(3), ...hassanLandmarks.bus, driveMinutes: 5, sortOrder: 0 },
    { propertyId: propertyId(3), ...hassanLandmarks.college, driveMinutes: 6, sortOrder: 1 },
    { propertyId: propertyId(4), ...hassanLandmarks.centre, driveMinutes: 25, sortOrder: 0 },
    { propertyId: propertyId(4), ...hassanLandmarks.highway, driveMinutes: 14, sortOrder: 1 },
  ]);

  // ------------------------------------------------------------ projects

  const amenities = [
    { en: "30 ft and 40 ft tar roads", kn: "30 ಮತ್ತು 40 ಅಡಿ ಡಾಂಬರು ರಸ್ತೆಗಳು" },
    { en: "Underground drainage", kn: "ಭೂಗತ ಒಳಚರಂಡಿ" },
    { en: "Piped water to every site", kn: "ಪ್ರತಿ ನಿವೇಶನಕ್ಕೆ ಕೊಳವೆ ನೀರು" },
    { en: "Street lights", kn: "ಬೀದಿ ದೀಪಗಳು" },
    { en: "Park and open space", kn: "ಉದ್ಯಾನವನ ಮತ್ತು ತೆರೆದ ಸ್ಥಳ" },
    { en: "Boundary stones on every site", kn: "ಪ್ರತಿ ನಿವೇಶನಕ್ಕೆ ಗಡಿ ಕಲ್ಲುಗಳು" },
  ];
  const approvals = [
    { en: "Layout approval, Hassan Urban Development Authority", kn: "ಲೇಔಟ್ ಅನುಮೋದನೆ, ಹಾಸನ ನಗರಾಭಿವೃದ್ಧಿ ಪ್ರಾಧಿಕಾರ", number: "DEMO/LAY/0001" },
    { en: "Land conversion order", kn: "ಭೂ ಪರಿವರ್ತನೆ ಆದೇಶ", number: "DEMO/ALN/0001" },
    { en: "Encumbrance certificate, 30 years", kn: "ಋಣಭಾರ ಪ್ರಮಾಣಪತ್ರ, 30 ವರ್ಷ", number: "" },
  ];

  const [meadows] = await db
    .insert(projects)
    .values({
      propertyNo: 7,
      slug: "rsp-meadows",
      nameEn: "RSP Meadows",
      nameKn: "ಆರ್‌ಎಸ್‌ಪಿ ಮೆಡೋಸ್",
      taglineEn: "Thirty six sites off the ring road, with roads and drainage in place",
      taglineKn: "ರಿಂಗ್ ರಸ್ತೆ ಬಳಿ ಮೂವತ್ತಾರು ನಿವೇಶನಗಳು, ರಸ್ತೆ ಮತ್ತು ಒಳಚರಂಡಿ ಸಿದ್ಧ",
      descriptionEn:
        "RSP Meadows is a compact layout of 36 residential sites, a few minutes from the ring road and the NH-75 junction.\n\nEvery site is 30 × 40 ft and faces either east or west. Roads, drainage and water lines were completed before the first site was sold, and each site has been plotted individually on the map below.",
      descriptionKn:
        "ಆರ್‌ಎಸ್‌ಪಿ ಮೆಡೋಸ್ 36 ವಸತಿ ನಿವೇಶನಗಳ ಲೇಔಟ್. ರಿಂಗ್ ರಸ್ತೆ ಮತ್ತು NH-75 ಜಂಕ್ಷನ್‌ನಿಂದ ಕೆಲವೇ ನಿಮಿಷಗಳ ದೂರ.\n\nಪ್ರತಿ ನಿವೇಶನ 30 × 40 ಅಡಿ, ಪೂರ್ವ ಅಥವಾ ಪಶ್ಚಿಮ ದಿಕ್ಕಿಗೆ ಮುಖ ಮಾಡಿದೆ. ಮೊದಲ ನಿವೇಶನ ಮಾರುವ ಮೊದಲೇ ರಸ್ತೆ, ಒಳಚರಂಡಿ ಮತ್ತು ನೀರಿನ ಕೊಳವೆಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸಲಾಗಿದೆ. ಪ್ರತಿ ನಿವೇಶನವನ್ನು ಕೆಳಗಿನ ನಕ್ಷೆಯಲ್ಲಿ ಪ್ರತ್ಯೇಕವಾಗಿ ಗುರುತಿಸಲಾಗಿದೆ.",
      locationEn: "Off Ring Road, Hassan",
      locationKn: "ರಿಂಗ್ ರಸ್ತೆ ಬಳಿ, ಹಾಸನ",
      lat: 13.0262,
      lng: 76.1318,
      totalAreaAcres: 1.6,
      totalSites: 36,
      status: "ongoing",
      approvals,
      amenities,
      priceFrom: 1980000,
      pricePerSqft: 1650,
      featured: true,
      published: true,
      sortOrder: 1,
      isDemo: true,
    })
    .returning({ id: projects.id });

  const [heights] = await db
    .insert(projects)
    .values({
      propertyNo: 8,
      slug: "rsp-heights",
      nameEn: "RSP Heights",
      nameKn: "ಆರ್‌ಎಸ್‌ಪಿ ಹೈಟ್ಸ್",
      taglineEn: "Upcoming layout on the Hassan to Belur road",
      taglineKn: "ಹಾಸನ ಬೇಲೂರು ರಸ್ತೆಯಲ್ಲಿ ಮುಂಬರುವ ಲೇಔಟ್",
      descriptionEn:
        "RSP Heights is planned on nine acres near Dudda. The land has been purchased and the layout plan has been submitted for approval. Sites will be listed here once the approval is received.",
      descriptionKn: "ಆರ್‌ಎಸ್‌ಪಿ ಹೈಟ್ಸ್ ದುದ್ದ ಬಳಿ ಒಂಬತ್ತು ಎಕರೆಯಲ್ಲಿ ಯೋಜಿಸಲಾಗಿದೆ. ಜಮೀನು ಖರೀದಿ ಪೂರ್ಣಗೊಂಡಿದ್ದು, ಲೇಔಟ್ ನಕ್ಷೆಯನ್ನು ಅನುಮೋದನೆಗೆ ಸಲ್ಲಿಸಲಾಗಿದೆ. ಅನುಮೋದನೆ ದೊರೆತ ನಂತರ ನಿವೇಶನಗಳನ್ನು ಇಲ್ಲಿ ಪಟ್ಟಿ ಮಾಡಲಾಗುವುದು.",
      locationEn: "Dudda, Hassan to Belur Road",
      locationKn: "ದುದ್ದ, ಹಾಸನ ಬೇಲೂರು ರಸ್ತೆ",
      lat: 13.065,
      lng: 76.03,
      totalAreaAcres: 9,
      totalSites: 110,
      status: "upcoming",
      approvals: [{ en: "Layout plan submitted for approval", kn: "ಲೇಔಟ್ ನಕ್ಷೆಯನ್ನು ಅನುಮೋದನೆಗೆ ಸಲ್ಲಿಸಲಾಗಿದೆ", number: "" }],
      amenities: amenities.slice(0, 4),
      featured: true,
      published: true,
      sortOrder: 2,
      isDemo: true,
    })
    .returning({ id: projects.id });

  const [greens] = await db
    .insert(projects)
    .values({
      propertyNo: 9,
      slug: "rsp-greens",
      nameEn: "RSP Greens",
      nameKn: "ಆರ್‌ಎಸ್‌ಪಿ ಗ್ರೀನ್ಸ್",
      taglineEn: "Completed layout on Salagame Road, fully sold",
      taglineKn: "ಸಾಲಗಾಮೆ ರಸ್ತೆಯಲ್ಲಿ ಪೂರ್ಣಗೊಂಡ ಲೇಔಟ್, ಸಂಪೂರ್ಣ ಮಾರಾಟ",
      descriptionEn: "RSP Greens was completed and handed over with all sites registered to their buyers. It stays in our register as a reference for how our layouts are delivered.",
      descriptionKn: "ಆರ್‌ಎಸ್‌ಪಿ ಗ್ರೀನ್ಸ್ ಪೂರ್ಣಗೊಂಡು, ಎಲ್ಲಾ ನಿವೇಶನಗಳು ಖರೀದಿದಾರರ ಹೆಸರಿಗೆ ನೋಂದಣಿಯಾಗಿವೆ. ನಮ್ಮ ಲೇಔಟ್‌ಗಳ ಗುಣಮಟ್ಟಕ್ಕೆ ಉದಾಹರಣೆಯಾಗಿ ಇದು ನಮ್ಮ ದಾಖಲೆಯಲ್ಲಿ ಉಳಿದಿದೆ.",
      locationEn: "Salagame Road, Hassan",
      locationKn: "ಸಾಲಗಾಮೆ ರಸ್ತೆ, ಹಾಸನ",
      lat: 12.987,
      lng: 76.085,
      totalAreaAcres: 4.5,
      totalSites: 64,
      status: "sold_out",
      approvals: approvals.slice(0, 2),
      amenities: amenities.slice(0, 5),
      published: true,
      sortOrder: 3,
      isDemo: true,
    })
    .returning({ id: projects.id });

  // Sites of RSP Meadows: six rows of six, in back-to-back pairs with a 30 ft road between pairs.
  const origin = { lat: 13.02575, lng: 76.13135 };
  const bearing = 12;
  const rowOffsets = [0, 40, 110, 150, 220, 260];
  const statuses: ListingStatus[] = ["available", "available", "sold", "available", "reserved", "available", "sold", "available"];
  const rate = 1650;
  const siteRows: NewSite[] = [];
  const siteCorners = new Map<number, SurveyCorner[]>();
  let n = 0;
  for (let r = 0; r < rowOffsets.length; r++) {
    for (let c = 0; c < 6; c++) {
      n += 1;
      const corners = plot(origin, bearing, c * 30, rowOffsets[r], 30, 40);
      const cornerSite = c === 0 || c === 5;
      // Even rows front the road on their near side, odd rows the road on their far side.
      const facing: Facing = r % 2 === 0 ? "W" : "E";
      const status = statuses[(n * 3 + r) % statuses.length];
      const c0 = centre(corners);
      siteCorners.set(n, corners);
      siteRows.push({
        projectId: meadows.id,
        siteNo: n,
        dimension: "30 × 40",
        widthFt: 30,
        depthFt: 40,
        areaSqft: 1200,
        facing,
        roadWidthFt: 30,
        corner: cornerSite,
        status,
        pricePerSqft: rate,
        price: Math.round((1200 * rate * (cornerSite ? 1.06 : 1)) / 1000) * 1000,
        lat: c0.lat,
        lng: c0.lng,
        features: cornerSite ? [{ en: "Corner site with roads on two sides", kn: "ಎರಡು ಬದಿಯಲ್ಲಿ ರಸ್ತೆ ಇರುವ ಮೂಲೆ ನಿವೇಶನ" }] : [],
        descriptionEn: n === 1 ? "The first site at the entrance of the layout, on the corner of the main road." : "",
        descriptionKn: n === 1 ? "ಲೇಔಟ್ ಪ್ರವೇಶದ್ವಾರದಲ್ಲಿರುವ ಮೊದಲ ನಿವೇಶನ, ಮುಖ್ಯ ರಸ್ತೆಯ ಮೂಲೆಯಲ್ಲಿದೆ." : "",
      });
    }
  }
  const insertedSites = await db.insert(sites).values(siteRows).returning({ id: sites.id, siteNo: sites.siteNo });

  const boundary = plot(origin, bearing, -20, -30, 220, 360).map((c) => ({ ...c, lenFt: null }));
  await db.insert(surveys).values([
    survey(boundary, { title: "RSP Meadows boundary", projectId: meadows.id }),
    ...insertedSites.map((s) => survey(siteCorners.get(s.siteNo)!, { title: `RSP Meadows site ${s.siteNo}`, siteId: s.id })),
  ]);

  await db.insert(landmarks).values([
    { projectId: meadows.id, ...hassanLandmarks.highway, driveMinutes: 4, sortOrder: 0 },
    { projectId: meadows.id, ...hassanLandmarks.rail, driveMinutes: 9, sortOrder: 1 },
    { projectId: meadows.id, ...hassanLandmarks.bus, driveMinutes: 13, sortOrder: 2 },
    { projectId: meadows.id, ...hassanLandmarks.college, driveMinutes: 11, sortOrder: 3 },
    { projectId: meadows.id, ...hassanLandmarks.hospital, driveMinutes: 16, sortOrder: 4 },
    { projectId: heights.id, ...hassanLandmarks.centre, driveMinutes: 20, sortOrder: 0 },
    { projectId: heights.id, ...hassanLandmarks.rail, driveMinutes: 25, sortOrder: 1 },
    { projectId: greens.id, ...hassanLandmarks.centre, driveMinutes: 9, sortOrder: 0 },
    { projectId: greens.id, ...hassanLandmarks.hospital, driveMinutes: 7, sortOrder: 1 },
  ]);

  // ------------------------------------------------------------ testimonials and enquiries

  await db.insert(testimonials).values([
    {
      nameEn: "Demo buyer one",
      nameKn: "ಮಾದರಿ ಖರೀದಿದಾರ ಒಂದು",
      locationEn: "Bought a site in RSP Greens",
      locationKn: "ಆರ್‌ಎಸ್‌ಪಿ ಗ್ರೀನ್ಸ್‌ನಲ್ಲಿ ನಿವೇಶನ ಖರೀದಿಸಿದವರು",
      quoteEn: "The site on the ground matched the plan we were shown, to the foot. That is what convinced us.",
      quoteKn: "ನಮಗೆ ತೋರಿಸಿದ ನಕ್ಷೆಗೂ ಸ್ಥಳದಲ್ಲಿರುವ ನಿವೇಶನಕ್ಕೂ ಒಂದು ಅಡಿಯೂ ವ್ಯತ್ಯಾಸವಿರಲಿಲ್ಲ. ಅದೇ ನಮಗೆ ನಂಬಿಕೆ ತಂದಿತು.",
      sortOrder: 1,
      isDemo: true,
    },
    {
      nameEn: "Demo buyer two",
      nameKn: "ಮಾದರಿ ಖರೀದಿದಾರ ಎರಡು",
      locationEn: "Bought a house in Hassan",
      locationKn: "ಹಾಸನದಲ್ಲಿ ಮನೆ ಖರೀದಿಸಿದವರು",
      quoteEn: "We were given copies of every document before paying anything, and our bank's lawyer cleared them in a week.",
      quoteKn: "ಹಣ ಕೊಡುವ ಮೊದಲೇ ಎಲ್ಲಾ ದಾಖಲೆಗಳ ಪ್ರತಿ ಕೊಟ್ಟರು. ನಮ್ಮ ಬ್ಯಾಂಕ್ ವಕೀಲರು ಒಂದು ವಾರದಲ್ಲಿ ಅವುಗಳನ್ನು ಪರಿಶೀಲಿಸಿ ಒಪ್ಪಿಗೆ ನೀಡಿದರು.",
      sortOrder: 2,
      isDemo: true,
    },
    {
      nameEn: "Demo seller",
      nameKn: "ಮಾದರಿ ಮಾರಾಟಗಾರ",
      locationEn: "Sold a site through RSP Ventures",
      locationKn: "ಆರ್‌ಎಸ್‌ಪಿ ವೆಂಚರ್ಸ್ ಮೂಲಕ ನಿವೇಶನ ಮಾರಾಟ ಮಾಡಿದವರು",
      quoteEn: "They measured my site, took the photos and handled every visit. I only had to come for the registration.",
      quoteKn: "ನನ್ನ ನಿವೇಶನವನ್ನು ಅವರೇ ಅಳೆದು, ಚಿತ್ರ ತೆಗೆದು, ಬಂದವರಿಗೆಲ್ಲ ತೋರಿಸಿದರು. ನಾನು ನೋಂದಣಿಗೆ ಮಾತ್ರ ಬಂದರೆ ಸಾಕಾಯಿತು.",
      sortOrder: 3,
      isDemo: true,
    },
  ]);

  await db.insert(leads).values([
    { kind: "buy", name: "Demo enquiry", phone: "9000000003", propertyId: propertyId(2), ref: "HSN-0002", purpose: "self_use", budget: "₹50 lakh to 1 crore", timeline: "1 to 3 months", message: "Is the price negotiable? Would like to visit on Sunday.", locale: "en", source: "/en/properties/hsn-0002", status: "new", isDemo: true },
    { kind: "buy", name: "Demo enquiry two", phone: "9000000004", projectId: meadows.id, siteId: insertedSites[3].id, ref: "HSN-0007(004)", purpose: "investment", budget: "₹15 to 30 lakh", timeline: "Within 1 month", locale: "kn", source: "/kn/properties/hsn-0007-004", status: "contacted", notes: "Called on Monday. Visiting Saturday at 11.", isDemo: true },
    { kind: "sell", name: "Demo owner", phone: "9000000005", purpose: "other", message: "Selling: Residential site\nLocation: Near Dairy Circle\nSize: 30 × 40 ft\nExpected price: 24 lakh", locale: "en", source: "/en/sell", status: "new", isDemo: true },
  ]);

  await db.update(regions).set({ nextNo: 10 }).where(eq(regions.code, "HSN"));
  await db.update(regions).set({ nextNo: 1 }).where(sql`${regions.code} <> 'HSN'`);

  console.log("Seeded demo content: 6 properties, 3 projects, 36 sites, 43 surveys, 19 landmarks, 3 testimonials, 3 enquiries.");
  console.log("The next property number is HSN-0010.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
