/**
 * Map imagery. Street tiles come from OpenStreetMap. Satellite tiles default to Esri World
 * Imagery and can be pointed at another provider through environment variables.
 */
export type TileSource = { url: string; attribution: string; maxNativeZoom: number; subdomains?: string };

export const STREET_TILES: TileSource = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
  maxNativeZoom: 19,
  subdomains: "abc",
};

export const SATELLITE_TILES: TileSource = {
  url: process.env.NEXT_PUBLIC_SATELLITE_TILES?.trim() || "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  attribution: process.env.NEXT_PUBLIC_SATELLITE_ATTRIBUTION?.trim() || "Imagery &copy; Esri, Maxar, Earthstar Geographics",
  // Beyond this zoom the imagery is enlarged rather than refetched, which keeps the view
  // usable in rural areas where the provider has no closer photographs.
  maxNativeZoom: Number(process.env.NEXT_PUBLIC_SATELLITE_MAX_ZOOM) || 18,
};

/** How far the map lets you zoom in. Past the native zoom the tiles are simply enlarged. */
export const MAX_ZOOM = 22;

export function tileUrl(source: TileSource, z: number, x: number, y: number): string {
  const sub = source.subdomains ? source.subdomains[(x + y) % source.subdomains.length] : "";
  return source.url.replace("{s}", sub).replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}
