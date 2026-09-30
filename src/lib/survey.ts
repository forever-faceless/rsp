import type { LatLng, SurveyCorner, SurveyGeometry, SurveyMeasure, SurveyPoint } from "@/lib/db/enums";
import { centroid, cornerLabel, distanceFt, polygonAreaSqft, roundTo, sideLengthsFt } from "@/lib/geo";
import { formatMetres } from "@/lib/units";

export type SurveySide = {
  index: number;
  from: string;
  to: string;
  /** Length worked out from the corner coordinates. */
  gpsFt: number;
  /** Length entered from a tape or the title deed, when there is one. */
  measuredFt: number | null;
  /** The figure to show: the measured length when present, otherwise the GPS one. */
  ft: number;
};

export function surveySides(corners: SurveyCorner[]): SurveySide[] {
  const lengths = sideLengthsFt(corners);
  return lengths.map((gpsFt, i) => {
    const measured = corners[i].lenFt;
    const measuredFt = typeof measured === "number" && measured > 0 ? measured : null;
    return {
      index: i,
      from: cornerLabel(i),
      to: cornerLabel((i + 1) % corners.length),
      gpsFt,
      measuredFt,
      ft: measuredFt ?? gpsFt,
    };
  });
}

export type SurveySummary = {
  sides: SurveySide[];
  areaSqft: number | null;
  perimeterFt: number | null;
  /** "30 × 40" for a four-sided plot whose opposite sides roughly match, otherwise "". */
  dimension: string;
  widthFt: number | null;
  depthFt: number | null;
};

export function summariseSurvey(corners: SurveyCorner[]): SurveySummary {
  const sides = surveySides(corners);
  const closed = corners.length >= 3;
  const areaSqft = closed ? polygonAreaSqft(corners) : null;
  const perimeterFt = closed ? sides.reduce((sum, s) => sum + s.ft, 0) : null;

  let dimension = "";
  let widthFt: number | null = null;
  let depthFt: number | null = null;
  let area = areaSqft;
  if (corners.length === 4) {
    const [a, b, c, d] = sides.map((s) => s.ft);
    const matches = (x: number, y: number) => Math.abs(x - y) <= Math.max(1.5, 0.06 * Math.max(x, y));
    if (matches(a, c) && matches(b, d)) {
      const half = (n: number) => Math.round(n * 2) / 2;
      widthFt = half((a + c) / 2);
      depthFt = half((b + d) / 2);
      dimension = `${widthFt} × ${depthFt}`;
      // With every side taped and the corners close to square, width times depth is the
      // truer figure: it is free of the rounding in the stored coordinates.
      const taped = sides.every((s) => s.measuredFt != null);
      if (taped && area != null && Math.abs(area - widthFt * depthFt) <= 0.03 * area) area = widthFt * depthFt;
    }
  }
  return { sides, areaSqft: area == null ? null : roundTo(area, 1), perimeterFt: perimeterFt == null ? null : roundTo(perimeterFt, 1), dimension, widthFt, depthFt };
}

/**
 * Where the surveyed property is: the pin, which is the location the listing is saved and
 * shown with. A survey with a boundary and no pin yet counts as the middle of its plot.
 */
export function surveyCentre(geometry: Pick<SurveyGeometry, "pin" | "corners">): LatLng | null {
  if (geometry.pin) return geometry.pin;
  if (geometry.corners.length) return centroid(geometry.corners);
  return null;
}

/** Reads the geometry out of a stored survey row. The pin lives in the row's lat / lng columns. */
export function geometryOf(row: {
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  pinLabel?: string | null;
  corners: SurveyCorner[];
  measures: SurveyMeasure[];
  points: SurveyPoint[];
}): SurveyGeometry {
  return {
    pin: row.lat != null && row.lng != null ? { lat: row.lat, lng: row.lng } : null,
    pinLabel: row.pinLabel ?? "",
    accuracyM: row.accuracyM ?? null,
    corners: row.corners ?? [],
    measures: row.measures ?? [],
    points: row.points ?? [],
  };
}

/** The length of a measurement line as it is written on the line itself, in metres. */
export function measureDistance(m: SurveyMeasure): string {
  return formatMetres(measureFt(m));
}

/** A measurement line in a list, where there is no far end to tag: its name, then its length. */
export function measureLabel(m: SurveyMeasure, separator = " "): string {
  return `${m.label ? `${m.label}${separator}` : ""}${measureDistance(m)}`;
}

/** The length of a measurement line in feet, which is how every length is stored. */
export function measureFt(m: SurveyMeasure): number {
  return typeof m.lenFt === "number" && m.lenFt > 0 ? m.lenFt : distanceFt(m.a, m.b);
}

export function emptyGeometry(): SurveyGeometry {
  return { pin: null, pinLabel: "", accuracyM: null, corners: [], measures: [], points: [] };
}

export function hasGeometry(g: Pick<SurveyGeometry, "pin" | "corners" | "measures" | "points">): boolean {
  return Boolean(g.pin) || g.corners.length > 0 || g.measures.length > 0 || g.points.length > 0;
}

/** Every coordinate in a survey, for fitting a map view around it. */
export function surveyExtent(g: Pick<SurveyGeometry, "pin" | "corners" | "measures" | "points">): LatLng[] {
  const out: LatLng[] = [...g.corners, ...(g.points as SurveyPoint[])];
  if (g.pin) out.push(g.pin);
  for (const m of g.measures) out.push(m.a, m.b);
  return out;
}

export function shortId(): string {
  return Math.random().toString(36).slice(2, 10);
}
