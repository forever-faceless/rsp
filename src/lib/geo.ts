import type { AreaUnit, LandmarkCategory, LatLng } from "@/lib/db/enums";

const EARTH_RADIUS_M = 6_371_008.8;
export const FT_PER_M = 3.280839895;
export const SQFT_PER_SQM = 10.7639104;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

// ---------------------------------------------------------------- distances

export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return haversineM({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 }) / 1000;
}

export function distanceFt(a: LatLng, b: LatLng): number {
  return haversineM(a, b) * FT_PER_M;
}

/** Compass bearing from a to b in degrees, 0 = north, 90 = east. */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** The point reached by travelling `metres` from `origin` along `bearing`. */
export function destination(origin: LatLng, bearing: number, metres: number): LatLng {
  const δ = metres / EARTH_RADIUS_M;
  const θ = toRad(bearing);
  const φ1 = toRad(origin.lat);
  const λ1 = toRad(origin.lng);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: toDeg(φ2), lng: ((toDeg(λ2) + 540) % 360) - 180 };
}

export function midpoint(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

// ---------------------------------------------------------------- plots

/**
 * Projects coordinates onto a flat plane in metres around their centre (x east, y north).
 * A plot is a few hundred metres across at most, so the error is far below GPS accuracy.
 */
export function toLocalMetres(points: LatLng[], origin?: LatLng): { x: number; y: number }[] {
  if (!points.length) return [];
  const o = origin ?? centroid(points);
  const cos = Math.cos(toRad(o.lat));
  return points.map((p) => ({
    x: toRad(p.lng - o.lng) * EARTH_RADIUS_M * cos,
    y: toRad(p.lat - o.lat) * EARTH_RADIUS_M,
  }));
}

export function fromLocalMetres(points: { x: number; y: number }[], origin: LatLng): LatLng[] {
  const cos = Math.cos(toRad(origin.lat));
  return points.map((p) => ({
    lat: origin.lat + toDeg(p.y / EARTH_RADIUS_M),
    lng: origin.lng + toDeg(p.x / (EARTH_RADIUS_M * cos)),
  }));
}

/** Plain average of the corners. Good enough to centre a map or drop a pin on a plot. */
export function centroid(points: LatLng[]): LatLng {
  if (!points.length) return { lat: 0, lng: 0 };
  let lat = 0;
  let lng = 0;
  for (const p of points) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / points.length, lng: lng / points.length };
}

/** Enclosed area in square metres (shoelace formula on the local plane). */
export function polygonAreaSqm(points: LatLng[]): number {
  if (points.length < 3) return 0;
  const p = toLocalMetres(points);
  let sum = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function polygonAreaSqft(points: LatLng[]): number {
  return polygonAreaSqm(points) * SQFT_PER_SQM;
}

/** Length of every side in feet; side i runs from corner i to corner i + 1. */
export function sideLengthsFt(points: LatLng[]): number[] {
  if (points.length < 2) return [];
  const count = points.length === 2 ? 1 : points.length;
  return Array.from({ length: count }, (_, i) => distanceFt(points[i], points[(i + 1) % points.length]));
}

export function perimeterFt(points: LatLng[]): number {
  return sideLengthsFt(points).reduce((a, b) => a + b, 0);
}

/**
 * Corners of a width x depth rectangle. `anchor` is the front-left corner, the frontage
 * runs along `bearing`, and the depth extends 90 degrees clockwise from it.
 */
export function rectangleCorners(anchor: LatLng, widthFt: number, depthFt: number, bearing: number): LatLng[] {
  const w = widthFt / FT_PER_M;
  const d = depthFt / FT_PER_M;
  const b = destination(anchor, bearing, w);
  const c = destination(b, bearing + 90, d);
  const e = destination(anchor, bearing + 90, d);
  return [anchor, b, c, e];
}

/** A, B, C ... Z, AA, AB for corner labels. */
export function cornerLabel(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

// ---------------------------------------------------------------- units

export const SQFT_PER_UNIT: Record<AreaUnit, number> = {
  sqft: 1,
  cents: 435.6,
  guntas: 1089,
  acres: 43_560,
};

export function convertArea(sqft: number, unit: AreaUnit): number {
  return sqft / SQFT_PER_UNIT[unit];
}

export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** "40 ft" or "40.5 ft": half-foot precision is as fine as a tape on open ground allows. */
export function formatFeet(ft: number): string {
  const v = Math.round(ft * 2) / 2;
  return `${Number.isInteger(v) ? v : v.toFixed(1)} ft`;
}

// ---------------------------------------------------------------- landmarks and links

/** Rough drive-time estimate for small-town roads when no manual value is entered. */
export function estimateDriveMinutes(km: number): number {
  const avgSpeedKmh = km < 3 ? 22 : km < 15 ? 32 : 45;
  return Math.max(1, Math.round((km / avgSpeedKmh) * 60));
}

export function formatDistance(km: number, locale: "en" | "kn"): string {
  if (km < 1) {
    const m = Math.max(50, Math.round(km * 20) * 50);
    return locale === "kn" ? `${m} ಮೀ` : `${m} m`;
  }
  const value = km < 10 ? km.toFixed(1) : Math.round(km).toString();
  return locale === "kn" ? `${value} ಕಿ.ಮೀ` : `${value} km`;
}

export function formatMinutes(min: number, locale: "en" | "kn"): string {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (locale === "kn") return m ? `${h} ಗಂ ${m} ನಿ` : `${h} ಗಂ`;
    return m ? `${h} hr ${m} min` : `${h} hr`;
  }
  return locale === "kn" ? `${min} ನಿಮಿಷ` : `${min} min`;
}

export function googleMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function googleDirectionsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** Opens Google Earth on the web, looking straight down at the spot from `rangeM` metres. */
export function googleEarthLink(lat: number, lng: number, rangeM = 350): string {
  return `https://earth.google.com/web/@${lat.toFixed(7)},${lng.toFixed(7)},0a,${Math.round(rangeM)}d,35y,0h,0t,0r`;
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/** 13.00330° N, 76.10040° E */
export function formatCoords(lat: number, lng: number, decimals = 5): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(decimals)}° ${ns}, ${Math.abs(lng).toFixed(decimals)}° ${ew}`;
}

/** Hassan town centre; the default map centre until a location is set. */
export const DEFAULT_CENTRE: LatLng = { lat: 13.0033, lng: 76.1004 };

export const LANDMARK_CATEGORY_ORDER: LandmarkCategory[] = [
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
];
