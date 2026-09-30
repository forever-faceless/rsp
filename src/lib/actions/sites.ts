"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { getProjectById, getSiteById, siteNoExists } from "@/lib/db/queries";
import { FACINGS, LISTING_STATUSES, sites, type ListingStatus } from "@/lib/db/schema";
import { formFiles, parseBilingualLines, type ActionState, zodFieldErrors } from "@/lib/forms";
import { formatSiteNo } from "@/lib/refs";
import { deleteStored, saveImage, UploadError } from "@/lib/storage";
import { siteSchema } from "@/lib/validation";
import { deriveDimension, revalidateAll } from "./shared";

function readSiteForm(formData: FormData) {
  const { dimension, areaSqft } = deriveDimension(formData);
  return siteSchema.safeParse({
    siteNo: formData.get("siteNo") ?? "",
    dimension,
    widthFt: formData.get("widthFt") ?? "",
    depthFt: formData.get("depthFt") ?? "",
    areaSqft,
    facing: formData.get("facing") ?? "",
    roadWidthFt: formData.get("roadWidthFt") ?? "",
    corner: formData.get("corner") === "on",
    status: formData.get("status") ?? "available",
    price: formData.get("price") ?? "",
    pricePerSqft: formData.get("pricePerSqft") ?? "",
    callForPrice: formData.get("callForPrice") === "on",
    descriptionEn: formData.get("descriptionEn") ?? "",
    descriptionKn: formData.get("descriptionKn") ?? "",
  });
}

export async function createSite(projectId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!(await getProjectById(projectId))) return { error: "Project not found." };
  const parsed = readSiteForm(formData);
  if (!parsed.success) {
    return { error: "Please check the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  if (await siteNoExists(projectId, parsed.data.siteNo)) {
    return { error: `Site ${formatSiteNo(parsed.data.siteNo)} already exists in this project.`, fieldErrors: { siteNo: "Already in use" } };
  }
  const db = await getDb();
  const [row] = await db
    .insert(sites)
    .values({
      ...parsed.data,
      facing: parsed.data.facing || null,
      projectId,
      features: parseBilingualLines(String(formData.get("features") ?? "")),
    })
    .returning({ id: sites.id });
  revalidateAll();
  redirect(`/admin/projects/${projectId}/sites/${row.id}?created=1`);
}

export async function updateSite(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const existing = await getSiteById(id);
  if (!existing) return { error: "Site not found." };
  const parsed = readSiteForm(formData);
  if (!parsed.success) {
    return { error: "Please check the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  if (await siteNoExists(existing.projectId, parsed.data.siteNo, id)) {
    return { error: `Site ${formatSiteNo(parsed.data.siteNo)} already exists in this project.`, fieldErrors: { siteNo: "Already in use" } };
  }
  const db = await getDb();
  await db
    .update(sites)
    .set({
      ...parsed.data,
      facing: parsed.data.facing || null,
      features: parseBilingualLines(String(formData.get("features") ?? "")),
      updatedAt: new Date(),
    })
    .where(eq(sites.id, id));
  revalidateAll();
  return { success: "Site saved." };
}

export async function uploadSiteImages(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const existing = await getSiteById(id);
  if (!existing) return { error: "Site not found." };
  const files = formFiles(formData, "images");
  if (!files.length) return { error: "Choose at least one photo." };
  const urls: string[] = [];
  try {
    for (const file of files.slice(0, 12)) urls.push(await saveImage(file, "sites"));
  } catch (error) {
    for (const url of urls) await deleteStored(url);
    if (error instanceof UploadError) return { error: error.message };
    console.error(error);
    return { error: "Upload failed. Please try fewer photos at a time." };
  }
  const db = await getDb();
  await db
    .update(sites)
    .set({ images: [...existing.images, ...urls], updatedAt: new Date() })
    .where(eq(sites.id, id));
  revalidateAll();
  return { success: `${urls.length} photo${urls.length === 1 ? "" : "s"} uploaded.` };
}

export async function removeSiteImage(id: number, url: string): Promise<void> {
  await requireAdmin();
  const existing = await getSiteById(id);
  if (!existing || !existing.images.includes(url)) return;
  const db = await getDb();
  await db
    .update(sites)
    .set({ images: existing.images.filter((u) => u !== url), updatedAt: new Date() })
    .where(eq(sites.id, id));
  await deleteStored(url);
  revalidateAll();
}

export async function setSiteCover(id: number, url: string): Promise<void> {
  await requireAdmin();
  const existing = await getSiteById(id);
  if (!existing || !existing.images.includes(url)) return;
  const db = await getDb();
  await db
    .update(sites)
    .set({ images: [url, ...existing.images.filter((u) => u !== url)], updatedAt: new Date() })
    .where(eq(sites.id, id));
  revalidateAll();
}

export async function setSiteStatus(id: number, status: ListingStatus): Promise<void> {
  await requireAdmin();
  if (!LISTING_STATUSES.includes(status)) return;
  const db = await getDb();
  await db.update(sites).set({ status, updatedAt: new Date() }).where(eq(sites.id, id));
  revalidateAll();
}

export async function deleteSite(id: number): Promise<void> {
  await requireAdmin();
  const existing = await getSiteById(id);
  if (!existing) return;
  const db = await getDb();
  await db.delete(sites).where(eq(sites.id, id));
  for (const url of [...existing.images, ...existing.videos.filter((v) => v.kind === "file").map((v) => v.url)]) await deleteStored(url);
  revalidateAll();
  redirect(`/admin/projects/${existing.projectId}/sites`);
}

/**
 * Creates a numbered run of sites with shared parameters, skipping numbers that already exist.
 * Example: sites 1 to 40, 30 × 40, east facing, ₹1,450 per sq ft.
 */
export async function bulkCreateSites(projectId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!(await getProjectById(projectId))) return { error: "Project not found." };
  const from = Number(formData.get("from") ?? 1);
  const to = Number(formData.get("to") ?? 0);
  const positive = (key: string) => {
    const n = Number(formData.get(key) ?? 0);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const width = positive("widthFt");
  const depth = positive("depthFt");
  const area = positive("areaSqft") ?? (width && depth ? width * depth : null);
  const dimension = String(formData.get("dimension") ?? "").trim().slice(0, 40) || (width && depth ? `${width} × ${depth}` : "");
  const facingRaw = String(formData.get("facing") ?? "");
  const facing = (FACINGS as readonly string[]).includes(facingRaw) ? (facingRaw as (typeof FACINGS)[number]) : null;
  const roadWidth = positive("roadWidthFt");
  const pricePerSqft = positive("pricePerSqft");
  const priceInput = positive("price");
  const statusRaw = String(formData.get("status") ?? "available");
  const status = (LISTING_STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as ListingStatus) : "available";

  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > 9999 || to - from > 499) {
    return { error: "Enter a valid number range, at most 500 sites at a time." };
  }

  const db = await getDb();
  const existing = await db.query.sites.findMany({ where: eq(sites.projectId, projectId), columns: { siteNo: true } });
  const taken = new Set(existing.map((s) => s.siteNo));
  const rows = [];
  for (let n = from; n <= to; n++) {
    if (taken.has(n)) continue;
    rows.push({
      projectId,
      siteNo: n,
      dimension,
      widthFt: width,
      depthFt: depth,
      areaSqft: area,
      facing,
      roadWidthFt: roadWidth,
      status,
      pricePerSqft: pricePerSqft ? Math.round(pricePerSqft) : null,
      price: priceInput ? Math.round(priceInput) : pricePerSqft && area ? Math.round(pricePerSqft * area) : null,
      callForPrice: formData.get("callForPrice") === "on",
    });
  }
  if (!rows.length) return { error: "All site numbers in that range already exist." };
  for (let i = 0; i < rows.length; i += 100) {
    await db.insert(sites).values(rows.slice(i, i + 100));
  }
  revalidateAll();
  return { success: `${rows.length} site${rows.length === 1 ? "" : "s"} created.` };
}

export async function bulkSetStatus(projectId: number, formData: FormData): Promise<void> {
  await requireAdmin();
  const statusRaw = String(formData.get("status") ?? "");
  if (!(LISTING_STATUSES as readonly string[]).includes(statusRaw)) return;
  const ids = formData
    .getAll("siteId")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) return;
  const db = await getDb();
  for (const id of ids) {
    await db
      .update(sites)
      .set({ status: statusRaw as ListingStatus, updatedAt: new Date() })
      .where(and(eq(sites.id, id), eq(sites.projectId, projectId)));
  }
  revalidateAll();
}
