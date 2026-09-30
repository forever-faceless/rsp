/**
 * Builds every brand asset from the supplied logo (public/brand/logo-source.jpg):
 * transparent cut-outs, favicon and app icons, and the link-preview image.
 * The strapline printed under the wordmark in the artwork is left out of all of them.
 * Run with: npm run assets
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const brandDir = path.join(root, "public", "brand");
const appDir = path.join(root, "src", "app");

const PAPER = "#FBFAF6";
const NAVY = "#0B1A33";

type Raw = { data: Buffer; width: number; height: number };

const smooth = (x: number, a: number, b: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));

/**
 * The logo sits on a pale studio backdrop. Gold is saturated and navy is dark, so a pixel
 * belongs to the artwork when it is either colourful or clearly darker than the backdrop.
 */
async function cutOut(src: string): Promise<Raw> {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = (max - min) / 255;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const byColour = smooth(chroma, 0.1, 0.24);
    const byDarkness = smooth(0.8 - lum, 0, 0.22);
    out[i + 3] = Math.round(Math.max(byColour, byDarkness) * 255);
  }
  return { data: out, width: info.width, height: info.height };
}

/** Rows that contain artwork, used to find the gap between the mark and the wordmark. */
function inkByRow({ data, width, height }: Raw): number[] {
  const rows: number[] = [];
  for (let y = 0; y < height; y++) {
    let ink = 0;
    for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 140) ink++;
    rows.push(ink);
  }
  return rows;
}

function bounds({ data, width, height }: Raw, top: number, bottom: number) {
  let left = width;
  let right = 0;
  let first = bottom;
  let last = top;
  for (let y = top; y < bottom; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 140) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < first) first = y;
        if (y > last) last = y;
      }
    }
  }
  const pad = 6;
  left = Math.max(0, left - pad);
  first = Math.max(top, first - pad);
  right = Math.min(width - 1, right + pad);
  last = Math.min(height - 1, last + pad);
  return { left, top: first, width: right - left + 1, height: last - first + 1 };
}

async function onBackground(mark: Buffer, size: number, background: string, scale: number, file: string) {
  const inner = Math.round(size * scale);
  const resized = await sharp(mark).resize(inner, inner, { fit: "inside" }).png().toBuffer();
  const meta = await sharp(resized).metadata();
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: resized, left: Math.round((size - (meta.width ?? inner)) / 2), top: Math.round((size - (meta.height ?? inner)) / 2) }])
    .png()
    .toFile(file);
}

/**
 * Where the letters "RSP" stand inside the cut-out mark, as fractions of its height: the tops
 * of the letters and their feet (the bar beneath them is below this). Measured on the artwork.
 */
const LETTERS = { top: 0.395, feet: 0.862 };

/** How tall "VENTURES" stands beside the mark, as a share of the height of the letters "RSP". */
const WORD_SIZE = 0.84;
/**
 * How much of the word's navy outline is pared away, in artwork pixels. The word is enlarged
 * to sit beside the mark while the mark is reduced, which would leave the word with an
 * outline about twice as heavy as the mark's.
 */
const OUTLINE_TRIM = 2.6;

/**
 * The artwork has pale highlights along the edges of its gold faces, which the cut-out
 * leaves as slivers of see-through inside the lettering. Holes up to twice this many artwork
 * pixels across are taken to be such highlights, not background.
 */
const HIGHLIGHT_REACH = 2.5;

/** Gives every pixel the strongest (or the faintest) value found within `radius` of it. */
function spread(src: Uint8Array, width: number, height: number, radius: number, strongest: boolean): Uint8Array {
  const disk: number[] = [];
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) if (dx * dx + dy * dy <= radius * radius) disk.push(dx, dy);
  const out = new Uint8Array(src.length);
  const settled = strongest ? 255 : 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = src[y * width + x];
      for (let k = 0; k < disk.length && value !== settled; k += 2) {
        const nx = x + disk[k];
        const ny = y + disk[k + 1];
        const a = nx < 0 || ny < 0 || nx >= width || ny >= height ? 0 : src[ny * width + nx];
        if (strongest ? a > value : a < value) value = a;
      }
      out[y * width + x] = value;
    }
  }
  return out;
}

const trimmed = new Map<string, Buffer>();

/**
 * Pares the outer edge of a cut-out piece back by `by` artwork pixels, which thins its
 * outline without touching the lettering inside. Only the true background eats into the
 * piece: the highlight slivers inside the lettering are closed over first, so the outline
 * beside them is left whole. Returned tightly cropped, four times the artwork's size, so the
 * new edge stays smooth when it is scaled to its final size.
 */
async function trimOutline(piece: Buffer, by: number): Promise<Buffer> {
  const key = `${piece.length}:${by}`;
  const done = trimmed.get(key);
  if (done) return done;
  const UP = 4;
  const meta = await sharp(piece).metadata();
  const { data, info } = await sharp(piece)
    .resize({ width: (meta.width ?? 0) * UP, kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
  /** Softens a one-channel picture, which smooths the line a later cut-off draws through it. */
  const soften = async (plane: Uint8Array, sigma: number) => {
    const { data: soft, info: softInfo } = await sharp(Buffer.from(plane), { raw: { width, height, channels: 1 } }).blur(sigma).raw().toBuffer({ resolveWithObject: true });
    const out = new Uint8Array(width * height);
    for (let i = 0; i < out.length; i++) out[i] = soft[i * softInfo.channels];
    return out;
  };

  // The shape is worked on as plain in or out, along a smoothed line: the artwork's outline
  // fades at its outer edge, and cutting through that fade directly leaves the edge ragged.
  const shape = await soften(alpha, UP * 1.1);
  for (let i = 0; i < shape.length; i++) shape[i] = shape[i] > 120 ? 255 : 0;

  // Swell the piece to close the highlights, then shrink it by the same amount and by the trim.
  const reach = Math.round(HIGHLIGHT_REACH * UP);
  const pared = await soften(spread(spread(shape, width, height, reach, true), width, height, reach + Math.max(1, Math.round(by * UP)), false), UP * 0.4);

  let top = height;
  let bottom = -1;
  let left = width;
  let right = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const value = Math.min(alpha[i], pared[i]);
      data[i * 4 + 3] = value;
      if (value > 140) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  const out = await sharp(data, { raw: { width, height, channels: 4 } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .png()
    .toBuffer();
  trimmed.set(key, out);
  return out;
}

/**
 * The horizontal logo for headers: the mark on the left with "VENTURES" beside it. The word
 * stands on the line the letters "RSP" stand on, a little shorter than they are and with its
 * outline pared to the weight of the mark's, so the mark leads and the word follows.
 */
async function wideLogo(mark: Buffer, word: Buffer, height: number): Promise<Buffer> {
  const m = await sharp(mark).resize({ height }).png().toBuffer();
  const mm = await sharp(m).metadata();
  const wordHeight = Math.round((LETTERS.feet - LETTERS.top) * height * WORD_SIZE);
  const w = await sharp(await trimOutline(word, OUTLINE_TRIM))
    .resize({ height: wordHeight })
    .png()
    .toBuffer();
  const wm = await sharp(w).metadata();
  const gap = Math.round(height * 0.085);
  const width = (mm.width ?? 0) + gap + (wm.width ?? 0);
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: m, left: 0, top: 0 },
      { input: w, left: (mm.width ?? 0) + gap, top: Math.round(LETTERS.feet * height) - wordHeight },
    ])
    .png()
    .toBuffer();
}

async function main() {
  // The artwork as supplied: PNG preferred, JPEG accepted.
  let source = path.join(brandDir, "logo-source.png");
  try {
    await fs.access(source);
  } catch {
    source = path.join(brandDir, "logo-source.jpg");
    await fs.access(source);
  }
  const raw = await cutOut(source);
  const image = () => sharp(raw.data, { raw: { width: raw.width, height: raw.height, channels: 4 } });

  // Find the artwork, then the first empty band inside it: that separates the mark from "VENTURES".
  const rows = inkByRow(raw);
  const firstRow = rows.findIndex((n) => n > 0);
  const lastRow = rows.length - 1 - [...rows].reverse().findIndex((n) => n > 0);
  let gap = -1;
  for (let y = firstRow + Math.round((lastRow - firstRow) * 0.4); y < lastRow; y++) {
    if (rows[y] === 0) {
      gap = y;
      break;
    }
  }
  if (gap < 0) throw new Error("Could not find the gap between the mark and the wordmark.");

  // Below the mark comes "VENTURES". If the artwork carries a strapline under that, it sits
  // after another empty band and is left out of every asset.
  let wordStart = gap;
  while (wordStart < lastRow && rows[wordStart] === 0) wordStart++;
  let wordEnd = wordStart;
  while (wordEnd <= lastRow && rows[wordEnd] > 0) wordEnd++;

  const lockupBox = bounds(raw, firstRow, wordEnd);
  const markBox = bounds(raw, firstRow, gap);
  const wordBox = bounds(raw, wordStart, wordEnd);
  await image().extract(lockupBox).png().toFile(path.join(brandDir, "logo-full.png"));
  await image().extract(markBox).png().toFile(path.join(brandDir, "logo-mark.png"));
  const mark = await fs.readFile(path.join(brandDir, "logo-mark.png"));
  const lockup = await fs.readFile(path.join(brandDir, "logo-full.png"));
  const word = await image().extract(wordBox).png().toBuffer();

  // Three forms of the one logo: stacked (mark over the name), wide (mark beside the name,
  // for headers) and the mark alone (icons, tight spaces).
  await fs.writeFile(path.join(brandDir, "logo-wide.png"), await wideLogo(mark, word, 300));

  // Small copies for the page chrome, served exactly as they are. The logo is on every page,
  // so it must never depend on the image optimiser, which can stall a size that a visitor
  // abandons while it is first being made.
  await sharp(mark).resize({ width: 320 }).webp({ quality: 92 }).toFile(path.join(brandDir, "logo-mark-sm.webp"));
  await sharp(lockup).resize({ width: 360 }).webp({ quality: 92 }).toFile(path.join(brandDir, "logo-full-sm.webp"));
  await sharp(await wideLogo(mark, word, 160)).webp({ quality: 92 }).toFile(path.join(brandDir, "logo-wide-sm.webp"));

  // Browser tab and home-screen icons. The mark keeps its own colours on a paper tile.
  await onBackground(mark, 512, PAPER, 0.78, path.join(appDir, "icon.png"));
  await onBackground(mark, 180, PAPER, 0.76, path.join(appDir, "apple-icon.png"));
  await onBackground(mark, 192, PAPER, 0.78, path.join(brandDir, "icon-192.png"));
  await onBackground(mark, 512, PAPER, 0.78, path.join(brandDir, "icon-512.png"));
  // Maskable icons are cropped to a circle by Android, so the mark sits well inside the safe zone.
  await onBackground(mark, 512, PAPER, 0.56, path.join(brandDir, "icon-maskable.png"));

  // Link preview (WhatsApp, Facebook): the full logo centred on paper, with a gold rule beneath.
  const og = { width: 1200, height: 630 };
  const ogLockup = await sharp(lockup).resize({ height: 400, fit: "inside" }).png().toBuffer();
  const ogMeta = await sharp(ogLockup).metadata();
  const frame = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${og.width}" height="${og.height}">
      <rect width="100%" height="100%" fill="${PAPER}"/>
      <rect x="28" y="28" width="${og.width - 56}" height="${og.height - 56}" fill="none" stroke="${NAVY}" stroke-opacity="0.16" stroke-width="2"/>
      <rect x="${og.width / 2 - 60}" y="${og.height - 92}" width="120" height="3" fill="#BD9337"/>
    </svg>`,
  );
  await sharp(frame)
    .composite([{ input: ogLockup, left: Math.round((og.width - (ogMeta.width ?? 0)) / 2), top: Math.round((og.height - (ogMeta.height ?? 0)) / 2) - 24 }])
    .png()
    .toFile(path.join(brandDir, "og.png"));

  const markMeta = await sharp(mark).metadata();
  const lockupMeta = await sharp(lockup).metadata();
  const wideMeta = await sharp(path.join(brandDir, "logo-wide-sm.webp")).metadata();
  const fullSmMeta = await sharp(path.join(brandDir, "logo-full-sm.webp")).metadata();
  const markSmMeta = await sharp(path.join(brandDir, "logo-mark-sm.webp")).metadata();
  console.log(`logo-mark.png      ${markMeta.width} x ${markMeta.height}`);
  console.log(`logo-full.png      ${lockupMeta.width} x ${lockupMeta.height}`);
  console.log(`logo-mark-sm.webp  ${markSmMeta.width} x ${markSmMeta.height}`);
  console.log(`logo-full-sm.webp  ${fullSmMeta.width} x ${fullSmMeta.height}`);
  console.log(`logo-wide-sm.webp  ${wideMeta.width} x ${wideMeta.height}`);
  console.log("Icons written to src/app and public/brand.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
