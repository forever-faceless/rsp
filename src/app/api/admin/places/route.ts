import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { parseCoordinates } from "@/lib/coords";
import { siteUrl } from "@/lib/site-url";

type Place = { name: string; lat: number; lng: number };

/** When the last search went out. OpenStreetMap's search asks for no more than one a second. */
let lastSearch = 0;

/**
 * Finds a place by name for the survey map, so the map can be taken to a village, a road or
 * a landmark without dragging it there. Pasted coordinates are answered directly. Names are
 * looked up with OpenStreetMap's search, from the server, for signed-in staff only.
 */
export async function GET(request: NextRequest) {
  if (!(await getSession())) return Response.json({ error: "Not signed in." }, { status: 401 });
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 3) return Response.json({ places: [] });

  const point = parseCoordinates(q);
  if (point) return Response.json({ exact: true, places: [{ name: q, ...point }] satisfies Place[] });

  const wait = lastSearch + 1100 - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastSearch = Date.now();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q, format: "jsonv2", limit: "6", countrycodes: "in", "accept-language": "en" }).toString();
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": `RSP Ventures property register (${siteUrl()})`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`search answered ${response.status}`);
    const rows = (await response.json()) as { display_name?: string; lat?: string; lon?: string }[];
    const places: Place[] = rows
      .map((r) => ({ name: String(r.display_name ?? ""), lat: Number(r.lat), lng: Number(r.lon) }))
      .filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng));
    return Response.json({ places });
  } catch (error) {
    console.error("place search failed", error);
    return Response.json({ error: "The place search is not answering just now. Paste the coordinates instead, or move the map by hand." }, { status: 502 });
  }
}
