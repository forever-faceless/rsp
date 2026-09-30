import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getSettings } from "@/lib/db/queries";
import { en } from "@/lib/i18n/dictionaries/en";
import { formatFeet } from "@/lib/geo";
import { lookupListing } from "@/lib/listing-detail";
import { planFromCorners, planFromDimensions, type PlanShape } from "@/lib/plan";
import { priceLine } from "@/lib/pricing";
import { formatSiteNo } from "@/lib/refs";
import { siteUrl } from "@/lib/site-url";
import { resolveUploadPath, UPLOAD_ROUTE_PREFIX } from "@/lib/storage";
import { formatArea, formatPhoneDisplay } from "@/lib/utils";

/**
 * The picture a chat app or social network shows when a listing's link is shared: the
 * property number, what it is, where it is, its size and its price, beside a photo of it or,
 * failing that, its plan. It is drawn on request from the register, so it is always current.
 * The wording is English in both languages, because the lettering is set in Latin type.
 */
export const alt = "RSP Ventures property: number, location, size and price";
export const size = { width: 1200, height: 630 };
export const contentType = "image/jpeg";

const NAVY = "#0B1A33";
const GOLD = "#D7B56D";
const PAPER = "#FBFAF6";
const INK = "#4B5568";

/** The type the website is set in, and the logo, read once per server instance. */
let kit: Promise<{ fonts: { name: string; data: Buffer; weight: 500 | 600; style: "normal" }[]; logo: string; logoWidth: number }> | null = null;
function loadKit() {
  kit ??= (async () => {
    const [display, sans, mono, logoFile] = await Promise.all([
      readFile(path.join(process.cwd(), "src/assets/fonts/Archivo-SemiBold.ttf")),
      readFile(path.join(process.cwd(), "src/assets/fonts/HankenGrotesk-Medium.ttf")),
      readFile(path.join(process.cwd(), "src/assets/fonts/IBMPlexMono-Medium.ttf")),
      readFile(path.join(process.cwd(), "public/brand/logo-wide.png")),
    ]);
    const logo = await sharp(logoFile).resize({ height: 132 }).png().toBuffer({ resolveWithObject: true });
    return {
      fonts: [
        { name: "Display", data: display, weight: 600 as const, style: "normal" as const },
        { name: "Sans", data: sans, weight: 500 as const, style: "normal" as const },
        { name: "Mono", data: mono, weight: 500 as const, style: "normal" as const },
      ],
      logo: `data:image/png;base64,${logo.data.toString("base64")}`,
      logoWidth: Math.round((logo.info.width / logo.info.height) * 66),
    };
  })();
  return kit;
}

/** The listing's first photo, cropped to the panel. Any trouble fetching it just means the plan is drawn instead. */
async function photoPanel(url: string, width: number, height: number): Promise<string | null> {
  try {
    let bytes: Buffer;
    if (/^https?:\/\//.test(url)) {
      const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) return null;
      bytes = Buffer.from(await response.arrayBuffer());
    } else if (url.startsWith(UPLOAD_ROUTE_PREFIX)) {
      const file = resolveUploadPath(url.slice(UPLOAD_ROUTE_PREFIX.length).split("/"));
      if (!file) return null;
      bytes = await readFile(file);
    } else {
      return null;
    }
    const jpeg = await sharp(bytes).rotate().resize(width, height, { fit: "cover" }).jpeg({ quality: 84 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

/** The plot outline fitted into a box, with its length written on every side, as on the website's map. */
function PlanDrawing({ shape, width, height }: { shape: PlanShape; width: number; height: number }) {
  const xs = shape.points.map((p) => p.x);
  // North is up on paper, and down the page in screen coordinates.
  const ys = shape.points.map((p) => -p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1;
  const spanY = Math.max(...ys) - minY || 1;
  const room = 70;
  const scale = Math.min((width - 2 * room) / spanX, (height - 2 * room) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  const pts = shape.points.map((_, i) => ({ x: offX + (xs[i] - minX) * scale, y: offY + (ys[i] - minY) * scale }));
  const labels =
    pts.length <= 6
      ? pts.map((p, i) => {
          const q = pts[(i + 1) % pts.length];
          const text = formatFeet(shape.sidesFt[i]);
          const w = text.length * 13.4 + 20;
          return { text, left: (p.x + q.x) / 2 - w / 2, top: (p.y + q.y) / 2 - 18, w };
        })
      : [];
  return (
    <div style={{ display: "flex", position: "relative", width, height }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <polygon points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="rgba(215,181,109,0.2)" stroke={GOLD} strokeWidth="4" strokeLinejoin="miter" />
      </svg>
      {labels.map((l, i) => (
        <div
          key={i}
          style={{ position: "absolute", left: l.left, top: l.top, width: l.w, height: 36, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: PAPER, color: NAVY, fontFamily: "Mono", fontSize: 22 }}
        >
          {l.text}
        </div>
      ))}
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ locale: string; ref: string }> }) {
  const { ref } = await params;
  const found = await lookupListing(ref);
  if (found.type !== "listing") return new Response("Not found", { status: 404 });
  const d = found.detail;
  const [settings, { fonts, logo, logoWidth }] = await Promise.all([getSettings(), loadKit()]);

  const title = d.kind === "site" ? `Site ${formatSiteNo(d.siteNo ?? 0)}, ${d.titleEn}` : d.titleEn;
  const shortTitle = title.length > 58 ? `${title.slice(0, 56).trimEnd()}…` : title;
  const facts = [
    { label: "Dimension", value: d.dimension ? `${d.dimension} ft` : "" },
    { label: "Area", value: d.areaSqft ? formatArea(d.areaSqft, d.areaUnit, "en") : "" },
    { label: "Facing", value: d.facing ? en.facing[d.facing] : "" },
  ].filter((f) => f.value);
  const price = priceLine(d.price, d.pricePerSqft, en.common.perSqft) || en.common.onRequest;
  const sold = d.status === "sold";

  const panel = { width: 452, height: 630 };
  const corners = d.geometry?.corners ?? [];
  const photo = d.images[0] ? await photoPanel(d.images[0], panel.width, panel.height) : null;
  const shape = photo ? null : ((corners.length >= 3 ? planFromCorners(corners) : null) ?? planFromDimensions(d.widthFt, d.depthFt, d.facing));

  const picture = new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", backgroundColor: PAPER, fontFamily: "Sans", color: NAVY }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 1200 - panel.width, height: "100%", padding: "48px 52px 44px 60px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- drawn into a picture, not a page */}
          <img src={logo} width={logoWidth} height={66} alt="" />

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex", backgroundColor: NAVY, color: "#EFDDA0", fontFamily: "Mono", fontSize: 28, letterSpacing: 1.5, padding: "6px 16px" }}>{d.ref}</div>
              <div
                style={{
                  display: "flex",
                  fontFamily: "Mono",
                  fontSize: 20,
                  letterSpacing: 2,
                  padding: "8px 14px",
                  color: sold ? "#9B1C1C" : d.status === "reserved" ? "#8A5A00" : "#176640",
                  backgroundColor: sold ? "#FBE9E7" : d.status === "reserved" ? "#FBF0D9" : "#E3F3EA",
                }}
              >
                {en.status.listing[d.status].toUpperCase()}
              </div>
            </div>
            <div style={{ display: "flex", marginTop: 20, fontFamily: "Display", fontSize: shortTitle.length > 34 ? 46 : 54, lineHeight: 1.1, letterSpacing: -0.5 }}>{shortTitle}</div>
            {d.locationEn ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, fontSize: 28, color: INK }}>
                <div style={{ display: "flex", width: 12, height: 12, borderRadius: 12, backgroundColor: GOLD }} />
                {d.locationEn.length > 46 ? `${d.locationEn.slice(0, 44).trimEnd()}…` : d.locationEn}
              </div>
            ) : null}
            {facts.length ? (
              <div style={{ display: "flex", marginTop: 28, borderTop: `2px solid ${NAVY}22`, borderBottom: `2px solid ${NAVY}22` }}>
                {facts.map((f, i) => (
                  <div key={f.label} style={{ display: "flex", flexDirection: "column", padding: "14px 22px 14px 0", marginRight: 22, borderRight: i < facts.length - 1 ? `2px solid ${NAVY}22` : "none" }}>
                    <div style={{ display: "flex", fontFamily: "Mono", fontSize: 16, letterSpacing: 2.5, color: "#6B7385" }}>{f.label.toUpperCase()}</div>
                    <div style={{ display: "flex", marginTop: 6, fontFamily: "Mono", fontSize: 27 }}>{f.value}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "baseline", fontFamily: "Display", fontSize: 40 }}>{sold ? en.status.listing.sold : price}</div>
              {d.negotiable && !sold ? <div style={{ display: "flex", marginTop: 4, fontSize: 20, color: INK }}>{en.common.negotiable}</div> : null}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", fontFamily: "Mono", fontSize: 20, color: INK }}>
              {settings.phonePrimary ? <div style={{ display: "flex", color: NAVY, fontSize: 24 }}>{formatPhoneDisplay(settings.phonePrimary)}</div> : null}
              <div style={{ display: "flex", marginTop: 4 }}>{new URL(siteUrl()).host}</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: panel.width, height: "100%", backgroundColor: NAVY }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- drawn into a picture, not a page
            <img src={photo} width={panel.width} height={panel.height} alt="" />
          ) : shape ? (
            <PlanDrawing shape={shape} width={panel.width} height={panel.height - 60} />
          ) : (
            <div style={{ display: "flex", fontFamily: "Mono", fontSize: 44, letterSpacing: 3, color: "#EFDDA0" }}>{d.ref}</div>
          )}
        </div>
      </div>
    ),
    { ...size, fonts },
  );

  // Chat apps skip previews that are heavy, so the picture goes out as a compact JPEG.
  const jpeg = await sharp(Buffer.from(await picture.arrayBuffer())).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" },
  });
}
