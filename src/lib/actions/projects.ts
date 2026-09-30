"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { getProjectById, listSites, slugExists } from "@/lib/db/queries";
import { landmarks, projects, sites } from "@/lib/db/schema";
import { formFile, formFiles, parseApprovalLines, parseBilingualLines, type ActionState, zodFieldErrors } from "@/lib/forms";
import { deleteStored, isStoredUrl, saveDocument, saveImage, UploadError } from "@/lib/storage";
import { slugify } from "@/lib/utils";
import { projectSchema } from "@/lib/validation";
import { resolveNewPropertyNo, revalidateAll } from "./shared";

function readProjectForm(formData: FormData) {
  const nameEn = String(formData.get("nameEn") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  return projectSchema.safeParse({
    nameEn,
    nameKn: formData.get("nameKn") ?? "",
    slug: slugify(rawSlug || nameEn),
    taglineEn: formData.get("taglineEn") ?? "",
    taglineKn: formData.get("taglineKn") ?? "",
    descriptionEn: formData.get("descriptionEn") ?? "",
    descriptionKn: formData.get("descriptionKn") ?? "",
    locationEn: formData.get("locationEn") ?? "",
    locationKn: formData.get("locationKn") ?? "",
    totalAreaAcres: formData.get("totalAreaAcres") ?? "",
    totalSites: formData.get("totalSites") ?? "",
    status: formData.get("status") ?? "ongoing",
    priceFrom: formData.get("priceFrom") ?? "",
    pricePerSqft: formData.get("pricePerSqft") ?? "",
    callForPrice: formData.get("callForPrice") === "on",
    brochureUrl: formData.get("brochureUrl") ?? "",
    featured: formData.get("featured") === "on",
    published: formData.get("published") === "on",
    sortOrder: formData.get("sortOrder") ?? "0",
  });
}

export async function createProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = readProjectForm(formData);
  if (!parsed.success) {
    return { error: "Please check the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  if (await slugExists(parsed.data.slug)) {
    return { error: "A project with this web address already exists.", fieldErrors: { slug: "Already in use" } };
  }
  const number = await resolveNewPropertyNo(formData);
  if ("error" in number) return { error: number.error, fieldErrors: { [number.field]: number.error } };

  const db = await getDb();
  const [row] = await db
    .insert(projects)
    .values({
      ...parsed.data,
      prefix: number.prefix,
      propertyNo: number.propertyNo,
      amenities: parseBilingualLines(String(formData.get("amenities") ?? "")),
      approvals: parseApprovalLines(String(formData.get("approvals") ?? "")),
    })
    .returning({ id: projects.id });
  revalidateAll();
  redirect(`/admin/projects/${row.id}?created=1`);
}

export async function updateProject(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const existing = await getProjectById(id);
  if (!existing) return { error: "Project not found." };
  const parsed = readProjectForm(formData);
  if (!parsed.success) {
    return { error: "Please check the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  if (await slugExists(parsed.data.slug, id)) {
    return { error: "A project with this web address already exists.", fieldErrors: { slug: "Already in use" } };
  }
  const db = await getDb();
  await db
    .update(projects)
    .set({
      ...parsed.data,
      amenities: parseBilingualLines(String(formData.get("amenities") ?? "")),
      approvals: parseApprovalLines(String(formData.get("approvals") ?? "")),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id));
  revalidateAll();
  return { success: "Project saved." };
}

export async function uploadProjectMedia(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const existing = await getProjectById(id);
  if (!existing) return { error: "Project not found." };
  const db = await getDb();
  const patch: Partial<typeof projects.$inferInsert> = {};
  try {
    const cover = formFile(formData, "coverImage");
    if (cover) {
      patch.coverImage = await saveImage(cover, "projects");
      if (existing.coverImage) await deleteStored(existing.coverImage);
    }
    const plan = formFile(formData, "layoutPlanImage");
    if (plan) {
      patch.layoutPlanImage = await saveImage(plan, "plans");
      if (existing.layoutPlanImage) await deleteStored(existing.layoutPlanImage);
    }
    const brochure = formFile(formData, "brochure");
    if (brochure) {
      patch.brochureUrl = await saveDocument(brochure, "brochures");
      if (isStoredUrl(existing.brochureUrl)) await deleteStored(existing.brochureUrl);
    }
    const gallery = formFiles(formData, "gallery");
    if (gallery.length) {
      const urls: string[] = [];
      for (const file of gallery.slice(0, 20)) urls.push(await saveImage(file, "gallery"));
      patch.gallery = [...existing.gallery, ...urls];
    }
  } catch (error) {
    if (error instanceof UploadError) return { error: error.message };
    console.error(error);
    return { error: "Upload failed. Please try smaller images." };
  }
  if (Object.keys(patch).length === 0) return { error: "Choose at least one file to upload." };
  await db
    .update(projects)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(projects.id, id));
  revalidateAll();
  return { success: "Media uploaded." };
}

export async function removeProjectImage(id: number, url: string, kind: "gallery" | "cover" | "plan"): Promise<void> {
  await requireAdmin();
  const existing = await getProjectById(id);
  if (!existing) return;
  // Only remove files this project actually references.
  const owned = kind === "gallery" ? existing.gallery.includes(url) : kind === "cover" ? existing.coverImage === url : existing.layoutPlanImage === url;
  if (!owned) return;
  const db = await getDb();
  const patch =
    kind === "gallery" ? { gallery: existing.gallery.filter((g) => g !== url) } : kind === "cover" ? { coverImage: "" } : { layoutPlanImage: "" };
  await db
    .update(projects)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(projects.id, id));
  // A gallery photo promoted to cover shares its file with the gallery entry.
  const stillUsed = kind === "cover" ? existing.gallery.includes(url) : kind === "gallery" ? existing.coverImage === url : false;
  if (!stillUsed) await deleteStored(url);
  revalidateAll();
}

export async function setProjectCover(id: number, url: string): Promise<void> {
  await requireAdmin();
  const existing = await getProjectById(id);
  if (!existing || !existing.gallery.includes(url)) return;
  const db = await getDb();
  await db.update(projects).set({ coverImage: url, updatedAt: new Date() }).where(eq(projects.id, id));
  if (existing.coverImage && existing.coverImage !== url && !existing.gallery.includes(existing.coverImage)) {
    await deleteStored(existing.coverImage);
  }
  revalidateAll();
}

export async function deleteProject(id: number): Promise<void> {
  await requireAdmin();
  const existing = await getProjectById(id);
  if (!existing) return;
  const siteRows = await listSites(id);
  const db = await getDb();
  // Children first, so nothing is orphaned even where foreign keys are not enforced.
  await db.delete(sites).where(eq(sites.projectId, id));
  await db.delete(landmarks).where(eq(landmarks.projectId, id));
  await db.delete(projects).where(eq(projects.id, id));
  const files = [
    existing.coverImage,
    existing.layoutPlanImage,
    ...existing.gallery,
    ...existing.videos.filter((v) => v.kind === "file").map((v) => v.url),
    ...siteRows.flatMap((s) => [...s.images, ...s.videos.filter((v) => v.kind === "file").map((v) => v.url)]),
  ];
  if (isStoredUrl(existing.brochureUrl)) files.push(existing.brochureUrl);
  for (const url of new Set(files)) await deleteStored(url);
  revalidateAll();
  redirect("/admin/projects");
}
