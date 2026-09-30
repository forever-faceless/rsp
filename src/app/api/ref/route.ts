import type { NextRequest } from "next/server";
import { findByNo, getSite } from "@/lib/db/queries";
import { formatRef, parseRef, refSlug } from "@/lib/refs";

/**
 * Looks up a property number typed into the search box and says where it lives.
 * Only published listings are found, so unpublished drafts stay private. A number typed
 * without its district letters is looked for in the main district first.
 */
export async function GET(request: NextRequest) {
  const parsed = parseRef(request.nextUrl.searchParams.get("q"));
  if (!parsed) return Response.json({ ok: false, reason: "invalid" }, { status: 400 });

  const found = await findByNo(parsed.prefix, parsed.propertyNo);
  if (!found) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });

  if (parsed.siteNo != null) {
    if (found.kind !== "project") return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
    const { project } = found;
    const site = await getSite(project.id, parsed.siteNo);
    if (!site) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
    return Response.json({
      ok: true,
      ref: formatRef(project.prefix, project.propertyNo, site.siteNo),
      path: `/properties/${refSlug(project.prefix, project.propertyNo, site.siteNo)}`,
    });
  }

  if (found.kind === "project") {
    const { project } = found;
    return Response.json({ ok: true, ref: formatRef(project.prefix, project.propertyNo), path: `/projects/${project.slug}` });
  }
  const { property } = found;
  return Response.json({ ok: true, ref: formatRef(property.prefix, property.propertyNo), path: `/properties/${refSlug(property.prefix, property.propertyNo)}` });
}
