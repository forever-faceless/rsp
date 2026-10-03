import type { MetadataRoute } from "next";
import { listPublishedProjects, searchListings } from "@/lib/db/queries";
import { locales } from "@/lib/i18n/config";
import { refSlug } from "@/lib/refs";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const entries: MetadataRoute.Sitemap = [];
  const staticPaths = ["", "/properties", "/projects", "/sell", "/about", "/contact", "/enquire", "/privacy"];
  for (const locale of locales) {
    for (const p of staticPaths) {
      entries.push({ url: `${base}/${locale}${p}`, changeFrequency: "weekly", priority: p === "" ? 1 : 0.7 });
    }
  }
  const [projects, listings] = await Promise.all([listPublishedProjects(), searchListings()]);
  for (const locale of locales) {
    for (const project of projects) {
      entries.push({ url: `${base}/${locale}/projects/${project.slug}`, lastModified: project.updatedAt, changeFrequency: "weekly", priority: 0.8 });
    }
    for (const l of listings) {
      entries.push({
        url: `${base}/${locale}/properties/${refSlug(l.prefix, l.propertyNo, l.siteNo)}`,
        changeFrequency: "weekly",
        priority: l.kind === "property" ? 0.7 : 0.5,
      });
    }
  }
  return entries;
}
