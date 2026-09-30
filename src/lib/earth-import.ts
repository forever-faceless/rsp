import type { LatLng, SurveyGeometry } from "@/lib/db/enums";
import { haversineM, polygonAreaSqm } from "@/lib/geo";
import { shortId } from "@/lib/survey";

/**
 * Reading a plot drawn in Google Earth back into a survey.
 *
 * Google Earth saves its drawings as KML, or as KMZ, which is the same KML inside a zip.
 * Both are read here, in the browser, so a file never has to be uploaded to be understood.
 *
 *   Polygon            becomes the boundary (the largest one, when a file holds several)
 *   Path of two points becomes a measurement
 *   Longer path        becomes the boundary when the file has no polygon, otherwise a run of measurements
 *   Placemark (pin)    becomes a named point
 */

export class EarthFileError extends Error {}

export type EarthImport = {
  boundary: LatLng[];
  lines: { a: LatLng; b: LatLng; label: string }[];
  points: (LatLng & { label: string })[];
};

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_CORNERS = 200;
const MAX_LINES = 100;
const MAX_POINTS = 100;

const round7 = (n: number) => Number(n.toFixed(7));

/** "76.1042,13.0181,0 76.1043,13.0181,0" as written in a KML file: longitude first, then latitude. */
function parseCoordinates(text: string | null | undefined): LatLng[] {
  const out: LatLng[] = [];
  for (const tuple of (text ?? "").trim().split(/\s+/)) {
    if (!tuple) continue;
    const [lng, lat] = tuple.split(",").map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const point = { lat: round7(lat), lng: round7(lng) };
    const previous = out[out.length - 1];
    if (previous && previous.lat === point.lat && previous.lng === point.lng) continue;
    out.push(point);
  }
  return out;
}

/** A ring repeats its first point at the end; a survey boundary does not. */
function openRing(points: LatLng[]): LatLng[] {
  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (haversineM(first, last) < 0.05) return points.slice(0, -1);
  }
  return points;
}

const within = (el: Element, name: string) => Array.from(el.getElementsByTagName("*")).filter((e) => e.localName === name);
const childText = (el: Element, name: string) => Array.from(el.children).find((e) => e.localName === name)?.textContent?.trim() ?? "";

/** Drops a length that an earlier export wrote into a name, as in "To main road: 210 ft". */
function cleanLabel(name: string): string {
  return name
    .replace(/[:,]?\s*[\d,.]+\s*(ft|feet|m|km|metres|meters)\.?\s*$/i, "")
    .trim()
    .slice(0, 80);
}

/** Reads the drawings out of KML text. */
export function parseKml(text: string): EarthImport {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length || !within(doc.documentElement, "Placemark").length) {
    if (!/<kml[\s>]/i.test(text) && !/<Placemark[\s>]/i.test(text)) throw new EarthFileError("That does not look like a Google Earth file. Save the drawing as KML or KMZ and try again.");
    if (doc.getElementsByTagName("parsererror").length) throw new EarthFileError("The file is damaged and could not be read. Save it again from Google Earth.");
    throw new EarthFileError("The file has no drawings in it. Draw a polygon around the plot in Google Earth, then save it.");
  }

  const polygons: LatLng[][] = [];
  const paths: { points: LatLng[]; label: string }[] = [];
  const result: EarthImport = { boundary: [], lines: [], points: [] };

  for (const placemark of within(doc.documentElement, "Placemark")) {
    const name = childText(placemark, "name");
    const style = childText(placemark, "styleUrl");
    for (const polygon of within(placemark, "Polygon")) {
      const outer = within(polygon, "outerBoundaryIs")[0] ?? polygon;
      const ring = openRing(parseCoordinates(within(outer, "coordinates")[0]?.textContent));
      if (ring.length >= 3) polygons.push(ring);
    }
    for (const line of within(placemark, "LineString")) {
      const points = parseCoordinates(within(line, "coordinates")[0]?.textContent);
      if (points.length >= 2) paths.push({ points, label: cleanLabel(name) });
    }
    // Labels that one of our own exports placed on the sides of a plot are not points of interest.
    if (style === "#label") continue;
    for (const point of within(placemark, "Point")) {
      const [at] = parseCoordinates(within(point, "coordinates")[0]?.textContent);
      if (at) result.points.push({ ...at, label: cleanLabel(name) });
    }
  }

  if (polygons.length) {
    result.boundary = polygons.reduce((best, ring) => (polygonAreaSqm(ring) > polygonAreaSqm(best) ? ring : best));
  } else {
    // No polygon: a path drawn around the plot stands in for one.
    const around = paths.findIndex((p) => p.points.length >= 3);
    if (around >= 0) result.boundary = openRing(paths.splice(around, 1)[0].points);
  }
  for (const path of paths) {
    for (let i = 0; i < path.points.length - 1; i++) {
      const label = path.points.length > 2 && path.label ? `${path.label} ${i + 1}` : path.label;
      result.lines.push({ a: path.points[i], b: path.points[i + 1], label: label.slice(0, 80) });
    }
  }

  if (result.boundary.length > MAX_CORNERS) {
    throw new EarthFileError(`The outline has ${result.boundary.length} points, which is more than a plot needs. Redraw it in Google Earth with a point at each corner only.`);
  }
  if (!result.boundary.length && !result.lines.length && !result.points.length) {
    throw new EarthFileError("The file has no drawings in it. Draw a polygon around the plot in Google Earth, then save it.");
  }
  result.lines = result.lines.slice(0, MAX_LINES);
  result.points = result.points.slice(0, MAX_POINTS);
  return result;
}

/** Pulls the KML out of a KMZ, which is an ordinary zip archive. */
async function kmlFromKmz(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new EarthFileError("The KMZ file is damaged and could not be opened. Save it again from Google Earth.");

  const decoder = new TextDecoder();
  const entries: { name: string; method: number; size: number; offset: number }[] = [];
  let at = view.getUint32(end + 16, true);
  for (let n = view.getUint16(end + 10, true); n > 0 && at + 46 <= bytes.length; n--) {
    if (view.getUint32(at, true) !== 0x02014b50) break;
    const nameLength = view.getUint16(at + 28, true);
    entries.push({
      name: decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength)),
      method: view.getUint16(at + 10, true),
      size: view.getUint32(at + 20, true),
      offset: view.getUint32(at + 42, true),
    });
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  const entry = entries.find((e) => /(^|\/)doc\.kml$/i.test(e.name)) ?? entries.find((e) => /\.kml$/i.test(e.name));
  if (!entry) throw new EarthFileError("There is no drawing inside that KMZ file.");

  const start = entry.offset + 30 + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true);
  const data = bytes.slice(start, start + entry.size);
  if (entry.method === 0) return decoder.decode(data);
  if (entry.method !== 8 || typeof DecompressionStream === "undefined") {
    throw new EarthFileError("This browser cannot open KMZ files. In Google Earth, save the drawing as KML instead and import that.");
  }
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

/** Reads a .kml or .kmz file chosen by the user. */
export async function readEarthFile(file: File): Promise<EarthImport> {
  if (file.size > MAX_FILE_BYTES) throw new EarthFileError("That file is too large. Save only the plot itself from Google Earth, not a whole folder of places.");
  const buffer = await file.arrayBuffer();
  const head = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
  const zipped = head[0] === 0x50 && head[1] === 0x4b;
  return parseKml(zipped ? await kmlFromKmz(buffer) : new TextDecoder().decode(buffer));
}

/**
 * Puts what a file holds into a survey. Each kind of drawing the file contains replaces what
 * the survey had of that kind; anything the file does not contain is left as it was.
 */
export function mergeImport(geometry: SurveyGeometry, found: EarthImport): SurveyGeometry {
  const pin = geometry.pin;
  // A pin that an earlier export wrote at the survey's own location is not a new point.
  const points = found.points.filter((p) => !pin || haversineM(p, pin) > 0.5);
  return {
    ...geometry,
    corners: found.boundary.length >= 3 ? found.boundary.map((p) => ({ lat: p.lat, lng: p.lng, src: "map" as const })) : geometry.corners,
    measures: found.lines.length ? found.lines.map((l) => ({ id: shortId(), a: l.a, b: l.b, label: l.label })) : geometry.measures,
    points: points.length ? points.map((p) => ({ id: shortId(), lat: p.lat, lng: p.lng, label: p.label })) : geometry.points,
  };
}

/** One line saying what came in, for the message shown after an import. */
export function describeImport(found: EarthImport): string {
  const parts: string[] = [];
  if (found.boundary.length >= 3) parts.push(`a boundary with ${found.boundary.length} corners`);
  if (found.lines.length) parts.push(found.lines.length === 1 ? "1 measurement" : `${found.lines.length} measurements`);
  if (found.points.length) parts.push(found.points.length === 1 ? "1 point" : `${found.points.length} points`);
  return parts.join(", ");
}
