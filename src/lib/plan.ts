import type { Facing, SurveyCorner } from "@/lib/db/enums";
import { cornerLabel, formatFeet, FT_PER_M, toLocalMetres } from "@/lib/geo";
import { surveySides } from "@/lib/survey";

/** A plot outline on a flat plane, in metres, with x running east and y running north. */
export type PlanShape = {
  points: { x: number; y: number }[];
  /** Length of each side in feet; side i runs from point i to point i + 1. */
  sidesFt: number[];
  /** True when north is known, which is the case for plots drawn from coordinates or a facing. */
  oriented: boolean;
  /** Index of the side that faces the road, when it is known. */
  frontSide: number | null;
  /** Where the figures come from, which decides the note printed under the drawing. */
  source: "measured" | "gps" | "stated";
};

const FACING_DEG: Record<Facing, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

export function planFromCorners(corners: SurveyCorner[]): PlanShape | null {
  if (corners.length < 3) return null;
  const sides = surveySides(corners);
  const allMeasured = sides.every((s) => s.measuredFt != null);
  const drawn = corners.every((c) => c.src === "map");
  return {
    points: toLocalMetres(corners),
    sidesFt: sides.map((s) => s.ft),
    oriented: true,
    frontSide: null,
    source: allMeasured || drawn ? "measured" : "gps",
  };
}

/**
 * A plain rectangle from the stated width and depth. When the facing is known the plot is
 * turned so that its frontage looks in that direction, which puts the road on the right side.
 */
export function planFromDimensions(widthFt: number | null, depthFt: number | null, facing?: Facing | null): PlanShape | null {
  if (!widthFt || !depthFt || widthFt <= 0 || depthFt <= 0) return null;
  const w = widthFt / FT_PER_M;
  const d = depthFt / FT_PER_M;
  // Frontage along the top edge, plot extending behind it.
  const base = [
    { x: -w / 2, y: 0 },
    { x: w / 2, y: 0 },
    { x: w / 2, y: -d },
    { x: -w / 2, y: -d },
  ];
  const angle = facing ? (FACING_DEG[facing] * Math.PI) / 180 : 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // Clockwise rotation, because compass bearings run clockwise from north.
  const points = base.map((p) => ({ x: p.x * cos + p.y * sin, y: -p.x * sin + p.y * cos }));
  return { points, sidesFt: [widthFt, depthFt, widthFt, depthFt], oriented: Boolean(facing), frontSide: 0, source: "stated" };
}

export type PlanSide = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Dimension line, drawn parallel to the side and just outside it. */
  dim: { x1: number; y1: number; x2: number; y2: number; ticks: [number, number, number, number][] };
  label: string;
  lx: number;
  ly: number;
  /** Rotation that lays the label along the side while keeping it the right way up. */
  angle: number;
  showLabel: boolean;
  front: boolean;
};

export type PlanLayout = {
  width: number;
  height: number;
  path: string;
  corners: { x: number; y: number; label: string; lx: number; ly: number }[];
  sides: PlanSide[];
  centre: { x: number; y: number };
  /** Inner width available at the centre, used to decide whether the area label fits. */
  innerSpan: number;
  scaleBar: { x: number; y: number; length: number; label: string } | null;
  road: { path: string; lx: number; ly: number; angle: number } | null;
};

const NICE_FEET = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];

export function layoutPlan(shape: PlanShape, opts: { width: number; height: number; padding?: number }): PlanLayout {
  const { width, height } = opts;
  const pad = opts.padding ?? 58;
  const pts = shape.points;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 0.001);
  const spanY = Math.max(maxY - minY, 0.001);
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  // Screen y grows downward, so north (positive y) has to be flipped to point up.
  const P = pts.map((p) => ({ x: offX + (p.x - minX) * scale, y: offY + (maxY - p.y) * scale }));

  const cx = P.reduce((s, p) => s + p.x, 0) / P.length;
  const cy = P.reduce((s, p) => s + p.y, 0) / P.length;
  const r = (n: number) => Math.round(n * 10) / 10;

  const path = P.map((p, i) => `${i ? "L" : "M"}${r(p.x)} ${r(p.y)}`).join(" ") + " Z";
  const crowded = P.length > 8;

  const sides: PlanSide[] = P.map((a, i) => {
    const b = P[(i + 1) % P.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = dy / len;
    let ny = -dx / len;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    // Point the normal away from the middle of the plot.
    if ((mx - cx) * nx + (my - cy) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const off = 13;
    const tick = 4;
    const d1 = { x: a.x + nx * off, y: a.y + ny * off };
    const d2 = { x: b.x + nx * off, y: b.y + ny * off };
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;
    return {
      x1: r(a.x),
      y1: r(a.y),
      x2: r(b.x),
      y2: r(b.y),
      dim: {
        x1: r(d1.x),
        y1: r(d1.y),
        x2: r(d2.x),
        y2: r(d2.y),
        ticks: [
          [r(d1.x - nx * tick), r(d1.y - ny * tick), r(d1.x + nx * tick), r(d1.y + ny * tick)],
          [r(d2.x - nx * tick), r(d2.y - ny * tick), r(d2.x + nx * tick), r(d2.y + ny * tick)],
        ],
      },
      label: formatFeet(shape.sidesFt[i] ?? 0),
      lx: r(mx + nx * 27),
      ly: r(my + ny * 27),
      angle: r(angle),
      showLabel: !crowded && len > 38,
      front: shape.frontSide === i,
    };
  });

  const corners = P.map((p, i) => {
    const vx = p.x - cx;
    const vy = p.y - cy;
    const vl = Math.hypot(vx, vy) || 1;
    return { x: r(p.x), y: r(p.y), label: cornerLabel(i), lx: r(p.x + (vx / vl) * 17), ly: r(p.y + (vy / vl) * 17) };
  });

  // Scale bar: the longest round number of feet that stays a comfortable length on screen.
  const pxPerFt = scale / FT_PER_M;
  let scaleBar: PlanLayout["scaleBar"] = null;
  for (const ft of NICE_FEET) {
    const length = ft * pxPerFt;
    if (length >= 36 && length <= 96) scaleBar = { x: 18, y: height - 18, length: r(length), label: `${ft} ft` };
  }

  let road: PlanLayout["road"] = null;
  if (shape.frontSide != null) {
    const s = sides[shape.frontSide];
    const a = P[shape.frontSide];
    const b = P[(shape.frontSide + 1) % P.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = (s.dim.x1 - s.x1) / 13;
    const ny = (s.dim.y1 - s.y1) / 13;
    const near = 40;
    const far = 40 + 15;
    const ext = 26;
    const q = (t: number, o: number) => `${r(a.x + ux * t + nx * o)} ${r(a.y + uy * t + ny * o)}`;
    road = {
      path: `M${q(-ext, near)} L${q(len + ext, near)} M${q(-ext, far)} L${q(len + ext, far)}`,
      lx: r((a.x + b.x) / 2 + nx * (near + 7.5)),
      ly: r((a.y + b.y) / 2 + ny * (near + 7.5)),
      angle: s.angle,
    };
  }

  // Rough width of the plot at its centre, along the horizontal.
  const innerSpan = Math.min(spanX * scale, spanY * scale * 2.4);

  return { width, height, path, corners, sides, centre: { x: r(cx), y: r(cy) }, innerSpan, scaleBar, road };
}
