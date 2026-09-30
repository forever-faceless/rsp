import type { LatLng, SurveyGeometry } from "@/lib/db/enums";
import { formatFeet, midpoint } from "@/lib/geo";
import { formatNumber } from "@/lib/utils";
import { measureDistance, measureFt, measureLabel, summariseSurvey, surveyCentre } from "@/lib/survey";
import { M_PER_FT } from "@/lib/units";

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const coord = (p: LatLng) => `${p.lng.toFixed(7)},${p.lat.toFixed(7)},0`;

export type KmlInput = {
  /** Shown as the document name in Google Earth, for example "HSN-0034(012) · Corner site". */
  name: string;
  description?: string;
  geometry: Pick<SurveyGeometry, "pin" | "corners" | "measures" | "points"> & { pinLabel?: string };
};

/**
 * Builds a KML file that Google Earth (web, desktop and mobile) opens directly: the plot
 * outline, a label on every side with its length, the extra measurement lines and the pin.
 * KML colours are written aabbggrr, so brand gold #C9A246 becomes ff46a2c9.
 */
export function buildKml({ name, description, geometry }: KmlInput): string {
  const { corners, measures, points, pin } = geometry;
  const summary = summariseSurvey(corners);
  const centre = surveyCentre(geometry);
  const parts: string[] = [];

  if (corners.length >= 3) {
    const ring = [...corners, corners[0]].map(coord).join(" ");
    const area = summary.areaSqft ? `${formatNumber(Math.round(summary.areaSqft))} sq ft` : "";
    parts.push(
      `<Placemark><name>${esc(name)}</name>${area ? `<description>${esc(`Area ${area}`)}</description>` : ""}<styleUrl>#plot</styleUrl>` +
        `<Polygon><tessellate>1</tessellate><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`,
    );
    const sideMarks = summary.sides
      .map((s) => {
        const mid = midpoint(corners[s.index], corners[(s.index + 1) % corners.length]);
        return `<Placemark><name>${esc(formatFeet(s.ft))}</name><description>${esc(`Side ${s.from} to ${s.to}`)}</description><styleUrl>#label</styleUrl><Point><coordinates>${coord(mid)}</coordinates></Point></Placemark>`;
      })
      .join("");
    parts.push(`<Folder><name>Side lengths</name>${sideMarks}</Folder>`);
  } else if (corners.length === 2) {
    parts.push(
      `<Placemark><name>${esc(name)}</name><styleUrl>#plot</styleUrl><LineString><tessellate>1</tessellate><coordinates>${corners.map(coord).join(" ")}</coordinates></LineString></Placemark>`,
    );
  }

  if (measures.length) {
    const lines = measures
      .map((m) => {
        const label = measureLabel(m, ": ");
        return (
          `<Placemark><name>${esc(label)}</name><styleUrl>#measure</styleUrl><LineString><tessellate>1</tessellate><coordinates>${coord(m.a)} ${coord(m.b)}</coordinates></LineString></Placemark>` +
          `<Placemark><name>${esc(measureDistance(m))}</name><styleUrl>#label</styleUrl><Point><coordinates>${coord(midpoint(m.a, m.b))}</coordinates></Point></Placemark>` +
          // The place the line runs to is named on that end.
          (m.label ? `<Placemark><name>${esc(m.label)}</name><styleUrl>#label</styleUrl><Point><coordinates>${coord(m.b)}</coordinates></Point></Placemark>` : "")
        );
      })
      .join("");
    parts.push(`<Folder><name>Measurements</name>${lines}</Folder>`);
  }

  if (points.length) {
    const marks = points
      .map((p) => `<Placemark><name>${esc(p.label || "Point")}</name><styleUrl>#pin</styleUrl><Point><coordinates>${coord(p)}</coordinates></Point></Placemark>`)
      .join("");
    parts.push(`<Folder><name>Points</name>${marks}</Folder>`);
  }

  if (pin) {
    parts.push(`<Placemark><name>${esc(geometry.pinLabel || name)}</name><styleUrl>#pin</styleUrl><Point><coordinates>${coord(pin)}</coordinates></Point></Placemark>`);
  }

  const lookAt = centre
    ? `<LookAt><longitude>${centre.lng.toFixed(7)}</longitude><latitude>${centre.lat.toFixed(7)}</latitude><altitude>0</altitude><heading>0</heading><tilt>0</tilt><range>320</range></LookAt>`
    : "";

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<kml xmlns="http://www.opengis.net/kml/2.2"><Document>` +
    `<name>${esc(name)}</name>` +
    (description ? `<description>${esc(description)}</description>` : "") +
    lookAt +
    `<Style id="plot"><LineStyle><color>ff46a2c9</color><width>3</width></LineStyle><PolyStyle><color>4046a2c9</color></PolyStyle></Style>` +
    `<Style id="measure"><LineStyle><color>ffffffff</color><width>2</width></LineStyle></Style>` +
    `<Style id="label"><IconStyle><scale>0</scale></IconStyle><LabelStyle><scale>0.9</scale></LabelStyle></Style>` +
    `<Style id="pin"><IconStyle><scale>1.1</scale></IconStyle><LabelStyle><scale>0.9</scale></LabelStyle></Style>` +
    parts.join("") +
    `</Document></kml>\n`
  );
}

/** The same geometry as GeoJSON, for anyone who wants to open the plot in a GIS tool. */
export function buildGeoJson({ name, geometry }: KmlInput): string {
  const { corners, measures, points, pin } = geometry;
  const summary = summariseSurvey(corners);
  const xy = (p: LatLng) => [Number(p.lng.toFixed(7)), Number(p.lat.toFixed(7))];
  const features: unknown[] = [];
  if (corners.length >= 3) {
    features.push({
      type: "Feature",
      properties: { name, areaSqft: summary.areaSqft, perimeterFt: summary.perimeterFt, sidesFt: summary.sides.map((s) => Number(s.ft.toFixed(1))) },
      geometry: { type: "Polygon", coordinates: [[...corners, corners[0]].map(xy)] },
    });
  }
  for (const m of measures) {
    features.push({ type: "Feature", properties: { name: m.label, lengthM: Number((measureFt(m) * M_PER_FT).toFixed(2)), lengthFt: Number(measureFt(m).toFixed(1)) }, geometry: { type: "LineString", coordinates: [xy(m.a), xy(m.b)] } });
  }
  for (const p of points) features.push({ type: "Feature", properties: { name: p.label }, geometry: { type: "Point", coordinates: xy(p) } });
  if (pin) features.push({ type: "Feature", properties: { name: geometry.pinLabel || name, role: "location" }, geometry: { type: "Point", coordinates: xy(pin) } });
  return JSON.stringify({ type: "FeatureCollection", features }, null, 2);
}
