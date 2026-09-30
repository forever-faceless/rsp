import type { LatLng } from "@/lib/db/enums";
import { tileUrl, type TileSource } from "@/lib/tiles";

/**
 * Draws the frames of a short property video onto a canvas: the map closes in on the plot
 * from above the town, the boundary draws itself, each side is labelled with its length,
 * and a panel with the property number and particulars rises from the bottom.
 * Everything runs in the browser; nothing is sent to a video service.
 */

export type ReelSpec = {
  width: number;
  height: number;
  /** Seconds. */
  duration: number;
  corners: LatLng[];
  sideLabels: string[];
  /** Extra distances: `label` is written on the line, `endLabel` names the place it runs to. */
  measures: { a: LatLng; b: LatLng; label: string; endLabel?: string }[];
  refText: string;
  title: string;
  location: string;
  facts: { label: string; value: string }[];
  price: string;
  phone: string;
  company: string;
  tagline: string;
  show: { price: boolean; phone: boolean; sides: boolean; measures: boolean };
  tiles: TileSource;
  fonts: { display: string; sans: string; mono: string };
  /** The wide logo, drawn in the header of every frame. */
  logoUrl: string;
  /** The stacked logo, drawn on the opening card. */
  logoFullUrl?: string;
};

export type ReelScene = {
  spec: ReelSpec;
  tiles: Map<string, HTMLImageElement>;
  logo: HTMLImageElement | null;
  logoFull: HTMLImageElement | null;
  centre: LatLng;
  zoomStart: number;
  zoomEnd: number;
  /** Where on the frame the middle of the plot sits. */
  anchor: { x: number; y: number };
  panelHeight: number;
  missing: number;
};

const TILE = 256;
const NAVY = "#0d1a2d";
const NAVY_DEEP = "#08111f";
const GOLD = "#d7b56d";
const GOLD_LIGHT = "#efdda0";
const PAPER = "#fbfaf6";
const MUTED = "#a2b2c9";

function project(p: LatLng, zoom: number): { x: number; y: number } {
  const size = TILE * 2 ** zoom;
  const sin = Math.min(0.9999, Math.max(-0.9999, Math.sin((p.lat * Math.PI) / 180)));
  return { x: ((p.lng + 180) / 360) * size, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
/** Progress of a stretch of the timeline, from 0 before it starts to 1 after it ends. */
const span = (t: number, from: number, to: number) => clamp((t - from) / (to - from), 0, 1);

function loadImage(url: string, crossOrigin: boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // Without this the canvas becomes "tainted" and the browser refuses to record it.
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Tiles of one level that cover the frame when the map is drawn at `zoom`. */
function tilesFor(scene: Pick<ReelScene, "centre" | "anchor" | "spec">, level: number, zoom: number): { x: number; y: number }[] {
  const { width, height } = scene.spec;
  const scale = 2 ** (zoom - level);
  const c = project(scene.centre, level);
  const left = c.x - scene.anchor.x / scale;
  const top = c.y - scene.anchor.y / scale;
  const max = 2 ** level - 1;
  const out: { x: number; y: number }[] = [];
  for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height / scale) / TILE); ty++) {
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + width / scale) / TILE); tx++) {
      if (tx >= 0 && ty >= 0 && tx <= max && ty <= max) out.push({ x: tx, y: ty });
    }
  }
  return out;
}

const levelFor = (zoom: number, spec: ReelSpec) => clamp(Math.floor(zoom), 0, spec.tiles.maxNativeZoom);

export async function prepareReel(spec: ReelSpec, onProgress?: (done: number, total: number) => void): Promise<ReelScene> {
  const { width, height, corners } = spec;
  const portrait = height > width;
  // The square frame is shorter, so the particulars need a larger share of it.
  const panelHeight = Math.round(height * (portrait ? 0.33 : 0.45));
  const anchor = { x: width / 2, y: Math.round((height - panelHeight) * (portrait ? 0.56 : 0.58)) };

  const lat = corners.reduce((s, p) => s + p.lat, 0) / corners.length;
  const lng = corners.reduce((s, p) => s + p.lng, 0) / corners.length;
  const centre = { lat, lng };

  // The closest zoom at which the whole plot, with its labels, still fits above the panel.
  const pts = corners.map((p) => project(p, 0));
  const spanX = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x)) || 1e-9;
  const spanY = Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y)) || 1e-9;
  const roomX = width * 0.56;
  const roomY = (height - panelHeight) * 0.46;
  const zoomEnd = clamp(Math.log2(Math.min(roomX / spanX, roomY / spanY)), 14, 21);
  const zoomStart = Math.max(11, zoomEnd - 5);

  const base = { spec, centre, anchor };
  const wanted = new Map<string, { level: number; x: number; y: number }>();
  for (let level = levelFor(zoomStart, spec); level <= levelFor(zoomEnd, spec); level++) {
    // A level is on screen from the moment the zoom reaches it, which is when it covers the most ground.
    for (const t of tilesFor(base, level, Math.max(level, zoomStart))) wanted.set(`${level}/${t.x}/${t.y}`, { level, ...t });
  }

  const tiles = new Map<string, HTMLImageElement>();
  const list = [...wanted.entries()];
  let done = 0;
  let missing = 0;
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const [key, t] = list[next++];
      const img = await loadImage(tileUrl(spec.tiles, t.level, t.x, t.y), true);
      if (img) tiles.set(key, img);
      else missing++;
      onProgress?.(++done, list.length);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));

  const logo = await loadImage(spec.logoUrl, false);
  const logoFull = spec.logoFullUrl ? await loadImage(spec.logoFullUrl, false) : null;
  try {
    await Promise.all([document.fonts.load(`600 48px ${spec.fonts.display}`), document.fonts.load(`500 28px ${spec.fonts.mono}`), document.fonts.load(`400 28px ${spec.fonts.sans}`)]);
  } catch {
    // The fallback fonts are used.
  }
  return { spec, tiles, logo, logoFull, centre, zoomStart, zoomEnd, anchor, panelHeight, missing };
}

// ---------------------------------------------------------------- drawing helpers

type Ctx = CanvasRenderingContext2D;

function spaced(ctx: Ctx, px: number) {
  // Letter spacing on canvas text is recent; older browsers simply draw without it.
  (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
}

function wrap(ctx: Ctx, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth || !line) line = trial;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}...`).width > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}...`;
    return kept;
  }
  return lines;
}

function tag(ctx: Ctx, text: string, x: number, y: number, size: number, font: string, colours: { bg: string; fg: string }, align: "left" | "center" | "right" = "left") {
  ctx.save();
  ctx.font = `500 ${size}px ${font}`;
  spaced(ctx, size * 0.06);
  const w = ctx.measureText(text).width + size * 0.9;
  const h = size * 1.7;
  const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  ctx.fillStyle = colours.bg;
  ctx.beginPath();
  ctx.roundRect(left, y - h / 2, w, h, size * 0.12);
  ctx.fill();
  ctx.fillStyle = colours.fg;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, left + size * 0.45, y + size * 0.04);
  ctx.restore();
  return { width: w, height: h };
}

function drawMap(ctx: Ctx, scene: ReelScene, zoom: number) {
  const { spec, tiles, centre, anchor } = scene;
  ctx.fillStyle = NAVY_DEEP;
  ctx.fillRect(0, 0, spec.width, spec.height);
  const top = levelFor(zoom, spec);
  // Coarser levels first, so a tile that failed to load shows the blurrier one beneath it.
  for (const level of [top - 2, top - 1, top]) {
    if (level < 0) continue;
    const scale = 2 ** (zoom - level);
    const c = project(centre, level);
    const left = c.x - anchor.x / scale;
    const upper = c.y - anchor.y / scale;
    for (const t of tilesFor(scene, level, zoom)) {
      const img = tiles.get(`${level}/${t.x}/${t.y}`);
      if (!img) continue;
      // Half a pixel of overlap hides the seams between tiles.
      ctx.drawImage(img, (t.x * TILE - left) * scale - 0.5, (t.y * TILE - upper) * scale - 0.5, TILE * scale + 1, TILE * scale + 1);
    }
  }
}

function toScreen(scene: ReelScene, p: LatLng, zoom: number) {
  const c = project(scene.centre, zoom);
  const q = project(p, zoom);
  return { x: q.x - c.x + scene.anchor.x, y: q.y - c.y + scene.anchor.y };
}

// ---------------------------------------------------------------- the film

/** Draws the frame at `t` seconds. */
export function drawReel(ctx: Ctx, scene: ReelScene, t: number): void {
  const { spec, panelHeight } = scene;
  const { width: W, height: H, fonts } = spec;
  const u = W / 1080;
  const D = spec.duration;

  // Timeline, in seconds. The zoom takes whatever the fixed parts leave over.
  const tIntro = 1.4;
  const tZoomEnd = Math.max(tIntro + 2.6, D - 6.4);
  const tDrawEnd = tZoomEnd + 1.5;
  const tLabelsEnd = tDrawEnd + 1.2;
  const tPanel = tDrawEnd + 0.5;

  const zoom = scene.zoomStart + (scene.zoomEnd - scene.zoomStart) * easeInOut(span(t, tIntro * 0.7, tZoomEnd));
  // A slow drift closer during the hold keeps the picture alive.
  const drift = 0.06 * span(t, tZoomEnd, D);
  const z = zoom + drift;

  ctx.save();
  ctx.clearRect(0, 0, W, H);
  drawMap(ctx, scene, z);

  // Shade top and bottom so text reads on any imagery.
  const shadeTop = ctx.createLinearGradient(0, 0, 0, H * 0.24);
  shadeTop.addColorStop(0, "rgba(8,17,31,0.82)");
  shadeTop.addColorStop(1, "rgba(8,17,31,0)");
  ctx.fillStyle = shadeTop;
  ctx.fillRect(0, 0, W, H * 0.24);

  // ----- boundary
  const pts = spec.corners.map((p) => toScreen(scene, p, z));
  const drawn = easeInOut(span(t, tZoomEnd - 0.2, tDrawEnd));
  if (drawn > 0 && pts.length >= 3) {
    let perimeter = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      perimeter += Math.hypot(b.x - a.x, b.y - a.y);
    }
    const outline = new Path2D();
    pts.forEach((p, i) => (i ? outline.lineTo(p.x, p.y) : outline.moveTo(p.x, p.y)));
    outline.closePath();

    ctx.fillStyle = `rgba(215,181,109,${0.26 * span(t, tDrawEnd - 0.5, tDrawEnd + 0.4)})`;
    ctx.fill(outline);

    ctx.lineJoin = "miter";
    ctx.lineWidth = 9 * u;
    ctx.strokeStyle = "rgba(8,17,31,0.55)";
    ctx.setLineDash([perimeter * drawn, perimeter]);
    ctx.stroke(outline);
    ctx.lineWidth = 5 * u;
    ctx.strokeStyle = GOLD;
    ctx.stroke(outline);
    ctx.setLineDash([]);

    const cornersIn = span(t, tDrawEnd - 0.3, tDrawEnd + 0.3);
    if (cornersIn > 0) {
      const r = 9 * u * easeOut(cornersIn);
      for (const p of pts) {
        ctx.fillStyle = PAPER;
        ctx.strokeStyle = NAVY;
        ctx.lineWidth = 3 * u;
        ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
        ctx.strokeRect(p.x - r, p.y - r, r * 2, r * 2);
      }
    }

    // ----- side lengths
    if (spec.show.sides) {
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      pts.forEach((a, i) => {
        const text = spec.sideLabels[i];
        if (!text) return;
        const b = pts[(i + 1) % pts.length];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len < 120 * u) return;
        const appear = easeOut(span(t, tDrawEnd + (i / pts.length) * (tLabelsEnd - tDrawEnd), tDrawEnd + (i / pts.length) * (tLabelsEnd - tDrawEnd) + 0.45));
        if (appear <= 0) return;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        let nx = (b.y - a.y) / len;
        let ny = -(b.x - a.x) / len;
        if ((mx - cx) * nx + (my - cy) * ny < 0) {
          nx = -nx;
          ny = -ny;
        }
        ctx.globalAlpha = appear;
        tag(ctx, text, mx + nx * 46 * u, my + ny * 46 * u + (1 - appear) * 14 * u, 30 * u, fonts.mono, { bg: "rgba(13,26,45,0.92)", fg: GOLD_LIGHT }, "center");
        ctx.globalAlpha = 1;
      });
    }
  }

  // ----- extra measurements
  if (spec.show.measures) {
    spec.measures.forEach((m, i) => {
      const p = easeInOut(span(t, tDrawEnd + 0.4 + i * 0.3, tDrawEnd + 1.3 + i * 0.3));
      if (p <= 0) return;
      const a = toScreen(scene, m.a, z);
      const b = toScreen(scene, m.b, z);
      const end = { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
      ctx.lineWidth = 4 * u;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.setLineDash([4 * u, 12 * u]);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineCap = "butt";
      if (p > 0.85 && m.label) {
        ctx.globalAlpha = span(p, 0.85, 1);
        tag(ctx, m.label, (a.x + b.x) / 2, (a.y + b.y) / 2, 26 * u, fonts.mono, { bg: "rgba(255,255,255,0.94)", fg: NAVY }, "center");
        ctx.globalAlpha = 1;
      }
      if (p > 0.85 && m.endLabel) {
        ctx.globalAlpha = span(p, 0.85, 1);
        tag(ctx, m.endLabel, b.x, b.y - 34 * u, 24 * u, fonts.sans, { bg: NAVY, fg: PAPER }, "center");
        ctx.globalAlpha = 1;
      }
    });
  }

  // ----- header: mark and name on the left, property number on the right
  const head = easeOut(span(t, tIntro * 0.8, tIntro + 0.8));
  if (head > 0) {
    ctx.globalAlpha = head;
    const pad = 54 * u;
    const top = 70 * u;
    let x = pad;
    if (scene.logo) {
      const h = 84 * u;
      const w = (scene.logo.width / scene.logo.height) * h;
      ctx.drawImage(scene.logo, x, top - h / 2, w, h);
      x += w + 22 * u;
    }
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = PAPER;
    ctx.font = `700 ${30 * u}px ${fonts.display}`;
    spaced(ctx, 5 * u);
    // The wide logo already carries the name; it is typeset only when the logo could not be loaded.
    if (!scene.logo) ctx.fillText(spec.company.toUpperCase(), x, top - 12 * u);
    if (spec.tagline) {
      ctx.fillStyle = MUTED;
      ctx.font = `500 ${17 * u}px ${fonts.mono}`;
      spaced(ctx, 4.5 * u);
      ctx.fillText(spec.tagline.toUpperCase(), x, top + 24 * u);
    }
    spaced(ctx, 0);
    tag(ctx, spec.refText, W - pad, top, 30 * u, fonts.mono, { bg: GOLD, fg: NAVY_DEEP }, "right");
    ctx.globalAlpha = 1;
  }

  // ----- particulars
  const rise = easeOut(span(t, tPanel, tPanel + 0.9));
  if (rise > 0) {
    const y0 = H - panelHeight * rise;
    ctx.fillStyle = NAVY;
    ctx.fillRect(0, y0, W, panelHeight + 2);
    ctx.fillStyle = GOLD;
    ctx.fillRect(0, y0, W, 6 * u);

    const pad = 58 * u;
    let y = y0 + 74 * u;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = PAPER;
    ctx.font = `600 ${54 * u}px ${fonts.display}`;
    spaced(ctx, -0.6 * u);
    for (const line of wrap(ctx, spec.title, W - pad * 2, 2)) {
      ctx.fillText(line, pad, y + 22 * u);
      y += 64 * u;
    }
    spaced(ctx, 0);
    if (spec.location) {
      ctx.fillStyle = MUTED;
      ctx.font = `400 ${30 * u}px ${fonts.sans}`;
      ctx.fillText(wrap(ctx, spec.location, W - pad * 2, 1)[0] ?? "", pad, y + 12 * u);
      y += 48 * u;
    }

    const facts = spec.facts.filter((f) => f.value).slice(0, 3);
    if (facts.length) {
      y += 26 * u;
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.fillRect(pad, y - 22 * u, W - pad * 2, 2 * u);
      const col = (W - pad * 2) / facts.length;
      facts.forEach((f, i) => {
        const x = pad + col * i;
        ctx.fillStyle = MUTED;
        ctx.font = `500 ${18 * u}px ${fonts.mono}`;
        spaced(ctx, 3.4 * u);
        ctx.fillText(f.label.toUpperCase(), x, y + 22 * u);
        ctx.fillStyle = PAPER;
        ctx.font = `600 ${34 * u}px ${fonts.mono}`;
        spaced(ctx, 0);
        ctx.fillText(f.value, x, y + 68 * u);
      });
      y += 100 * u;
    }

    const bottom = H - 62 * u + (1 - rise) * panelHeight;
    if (spec.show.price && spec.price) {
      ctx.fillStyle = GOLD;
      ctx.font = `600 ${64 * u}px ${fonts.display}`;
      spaced(ctx, -0.6 * u);
      ctx.textBaseline = "alphabetic";
      ctx.fillText(spec.price, pad, bottom);
      spaced(ctx, 0);
    }
    if (spec.show.phone && spec.phone) {
      ctx.textAlign = "right";
      ctx.fillStyle = MUTED;
      ctx.font = `500 ${18 * u}px ${fonts.mono}`;
      spaced(ctx, 3.4 * u);
      ctx.fillText("CALL", W - pad, bottom - 46 * u);
      ctx.fillStyle = PAPER;
      ctx.font = `500 ${36 * u}px ${fonts.mono}`;
      spaced(ctx, 0);
      ctx.fillText(spec.phone, W - pad, bottom);
      ctx.textAlign = "left";
    }
  }

  // The imagery provider asks for a credit wherever its pictures are shown.
  ctx.globalAlpha = 0.85;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.font = `400 ${15 * u}px ${fonts.sans}`;
  spaced(ctx, 0);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 4 * u;
  ctx.fillText(spec.tiles.attribution.replace(/<[^>]+>/g, "").replace(/&copy;/g, "©"), W - 18 * u, H - panelHeight * rise - 14 * u);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // ----- opening card
  const intro = 1 - easeInOut(span(t, tIntro * 0.6, tIntro));
  if (intro > 0) {
    ctx.globalAlpha = intro;
    ctx.fillStyle = NAVY;
    ctx.fillRect(0, 0, W, H);
    const appear = easeOut(span(t, 0.05, 0.7));
    ctx.globalAlpha = intro * appear;
    const cy = H * 0.44;
    // The stacked logo carries the name, so it sits a little lower and the typeset name is left out.
    const opener = scene.logoFull ?? scene.logo;
    if (opener) {
      const w = (scene.logoFull ? 400 : 300) * u;
      const h = (opener.height / opener.width) * w;
      ctx.drawImage(opener, W / 2 - w / 2, cy - h + (scene.logoFull ? 74 * u : 0) + (1 - appear) * 24 * u, w, h);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = PAPER;
    ctx.font = `700 ${44 * u}px ${fonts.display}`;
    spaced(ctx, 9 * u);
    if (!scene.logoFull) ctx.fillText(spec.company.toUpperCase(), W / 2 + 4.5 * u, cy + 84 * u);
    ctx.fillStyle = GOLD;
    ctx.fillRect(W / 2 - 60 * u * appear, cy + 118 * u, 120 * u * appear, 4 * u);
    ctx.fillStyle = GOLD_LIGHT;
    ctx.font = `500 ${34 * u}px ${fonts.mono}`;
    spaced(ctx, 4 * u);
    ctx.fillText(spec.refText, W / 2 + 2 * u, cy + 186 * u);
    spaced(ctx, 0);
    ctx.globalAlpha = 1;
  }

  // ----- a brief fade at the very end, so a looping reel does not cut hard
  const out = span(t, D - 0.35, D);
  if (out > 0) {
    ctx.fillStyle = `rgba(13,26,45,${out})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

/** The first recording format this browser can produce, preferring MP4 because social apps expect it. */
export function pickVideoType(): { mime: string; extension: "mp4" | "webm" } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const options: [string, "mp4" | "webm"][] = [
    ["video/mp4;codecs=avc1.640028", "mp4"],
    ["video/mp4;codecs=avc1.42E01E", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9", "webm"],
    ["video/webm;codecs=vp8", "webm"],
    ["video/webm", "webm"],
  ];
  for (const [mime, extension] of options) if (MediaRecorder.isTypeSupported(mime)) return { mime, extension };
  return null;
}
