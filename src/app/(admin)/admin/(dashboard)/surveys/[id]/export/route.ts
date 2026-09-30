import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getProjectById, getPropertyById, getSiteById, getSurveyById } from "@/lib/db/queries";
import { buildGeoJson, buildKml } from "@/lib/kml";
import { formatRef } from "@/lib/refs";
import { geometryOf } from "@/lib/survey";
import { slugify } from "@/lib/utils";

/** Downloads a survey as KML (for Google Earth) or GeoJSON. */
export async function GET(request: NextRequest, ctx: RouteContext<"/admin/surveys/[id]/export">) {
  if (!(await getSession())) return new Response("Not signed in", { status: 401 });
  const { id } = await ctx.params;
  const survey = await getSurveyById(Number(id));
  if (!survey) return new Response("Not found", { status: 404 });

  let ref = "";
  if (survey.propertyId != null) {
    const p = await getPropertyById(survey.propertyId);
    if (p) ref = formatRef(p.prefix, p.propertyNo);
  } else if (survey.siteId != null) {
    const s = await getSiteById(survey.siteId);
    const project = s ? await getProjectById(s.projectId) : null;
    if (s && project) ref = formatRef(project.prefix, project.propertyNo, s.siteNo);
  } else if (survey.projectId != null) {
    const project = await getProjectById(survey.projectId);
    if (project) ref = formatRef(project.prefix, project.propertyNo);
  }

  const name = [ref, survey.title].filter(Boolean).join(" · ") || `Survey ${survey.id}`;
  const file = slugify(ref || survey.title || `survey-${survey.id}`).toUpperCase() || `SURVEY-${survey.id}`;
  const input = { name, description: survey.notes, geometry: geometryOf(survey) };

  if (request.nextUrl.searchParams.get("format") === "geojson") {
    return new Response(buildGeoJson(input), {
      headers: { "Content-Type": "application/geo+json; charset=utf-8", "Content-Disposition": `attachment; filename="${file}.geojson"`, "Cache-Control": "no-store" },
    });
  }
  return new Response(buildKml(input), {
    headers: { "Content-Type": "application/vnd.google-earth.kml+xml; charset=utf-8", "Content-Disposition": `attachment; filename="${file}.kml"`, "Cache-Control": "no-store" },
  });
}
