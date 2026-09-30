"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { allocatePropertyNo, getProjectById, getPropertyById, getSiteById, getSurveyById, syncListingLocation, type SurveyTarget } from "@/lib/db/queries";
import { properties, PROPERTY_TYPES, sites, surveys, type PropertyType, type Survey, type SurveyGeometry } from "@/lib/db/schema";
import { formFiles, type ActionState } from "@/lib/forms";
import { deleteStored, saveImage, UploadError } from "@/lib/storage";
import { geometryOf, summariseSurvey, surveyCentre } from "@/lib/survey";
import { surveyGeometrySchema, surveyMetaSchema } from "@/lib/validation";
import { resolveRegionCode, revalidateAll } from "./shared";

export type SurveyResult = { ok: true; message?: string } | { ok: false; error: string };

type Target = { projectId: number | null; propertyId: number | null; siteId: number | null };

const NO_TARGET: Target = { projectId: null, propertyId: null, siteId: null };

/** Turns "property:12", "site:5" or "project:3" into foreign keys, checking the row exists. */
async function resolveTarget(key: string): Promise<Target | null> {
  if (!key) return NO_TARGET;
  const [kind, rawId] = key.split(":");
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) return null;
  if (kind === "property") return (await getPropertyById(id)) ? { ...NO_TARGET, propertyId: id } : null;
  if (kind === "site") return (await getSiteById(id)) ? { ...NO_TARGET, siteId: id } : null;
  if (kind === "project") return (await getProjectById(id)) ? { ...NO_TARGET, projectId: id } : null;
  return null;
}

/** The listing a survey is attached to, if any. */
function listingOf(row: Target): SurveyTarget | null {
  if (row.propertyId != null) return { propertyId: row.propertyId };
  if (row.siteId != null) return { siteId: row.siteId };
  if (row.projectId != null) return { projectId: row.projectId };
  return null;
}

/** Starts an empty survey and opens it, so everything captured on site saves against a real record. */
export async function createSurvey(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const meta = surveyMetaSchema.safeParse({ title: formData.get("title") ?? "", notes: formData.get("notes") ?? "" });
  if (!meta.success) return { error: "The name is too long." };
  const target = await resolveTarget(String(formData.get("target") ?? ""));
  if (!target) return { error: "That listing no longer exists." };
  const db = await getDb();
  const [row] = await db
    .insert(surveys)
    .values({ ...meta.data, ...target })
    .returning({ id: surveys.id });
  revalidateAll();
  redirect(`/admin/surveys/${row.id}`);
}

export async function saveSurvey(id: number, input: { title: string; notes: string; geometry: SurveyGeometry }): Promise<SurveyResult> {
  await requireAdmin();
  const existing = await getSurveyById(id);
  if (!existing) return { ok: false, error: "This survey was deleted on another device." };
  const meta = surveyMetaSchema.safeParse({ title: input.title, notes: input.notes });
  const geometry = surveyGeometrySchema.safeParse(input.geometry);
  if (!meta.success || !geometry.success) return { ok: false, error: "The survey data could not be read. Reload the page and try again." };

  const g = geometry.data;
  const summary = summariseSurvey(g.corners);
  const db = await getDb();
  await db
    .update(surveys)
    .set({
      ...meta.data,
      lat: g.pin?.lat ?? null,
      lng: g.pin?.lng ?? null,
      accuracyM: g.pin ? g.accuracyM : null,
      pinLabel: g.pinLabel,
      corners: g.corners,
      measures: g.measures,
      points: g.points,
      areaSqft: summary.areaSqft,
      perimeterFt: summary.perimeterFt,
      updatedAt: new Date(),
    })
    .where(eq(surveys.id, id));
  // The pin is the listing's location: wherever it now stands is where the listing is.
  const listing = listingOf(existing);
  if (listing) await syncListingLocation(listing);
  revalidateAll();
  return { ok: true };
}

export async function attachSurvey(id: number, targetKey: string): Promise<SurveyResult> {
  await requireAdmin();
  const existing = await getSurveyById(id);
  if (!existing) return { ok: false, error: "Survey not found." };
  const target = await resolveTarget(targetKey);
  if (!target) return { ok: false, error: "That listing no longer exists." };
  const db = await getDb();
  await db
    .update(surveys)
    .set({ ...target, updatedAt: new Date() })
    .where(eq(surveys.id, id));
  // The listing it leaves loses this pin, and the listing it joins takes it as its location.
  for (const listing of [listingOf(existing), listingOf(target)]) if (listing) await syncListingLocation(listing);
  revalidateAll();
  return { ok: true, message: targetKey ? "Survey attached. Its pin is now the listing's location." : "Survey detached." };
}

function sizePatch(survey: Survey) {
  const summary = summariseSurvey(survey.corners);
  const patch: { areaSqft?: number; dimension?: string; widthFt?: number; depthFt?: number } = {};
  if (summary.areaSqft) patch.areaSqft = Math.round(summary.areaSqft);
  if (summary.dimension && summary.widthFt && summary.depthFt) {
    patch.dimension = summary.dimension;
    patch.widthFt = summary.widthFt;
    patch.depthFt = summary.depthFt;
    // A regular plot is quoted as width x depth, so keep the area consistent with it.
    patch.areaSqft = Math.round(summary.widthFt * summary.depthFt);
  }
  return patch;
}

/**
 * Copies the surveyed area and dimension onto the listing the survey is attached to. The
 * location needs no copying: the listing follows the pin every time the survey is saved.
 */
export async function copySurveySizeToListing(id: number): Promise<SurveyResult> {
  await requireAdmin();
  const survey = await getSurveyById(id);
  if (!survey) return { ok: false, error: "Survey not found." };
  if (survey.propertyId == null && survey.siteId == null) return { ok: false, error: "Attach this survey to a property or a site first." };
  const patch = sizePatch(survey);
  if (!Object.keys(patch).length) return { ok: false, error: "Mark the boundary first." };
  const db = await getDb();
  if (survey.propertyId != null) {
    await db
      .update(properties)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(properties.id, survey.propertyId));
  } else if (survey.siteId != null) {
    await db
      .update(sites)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(sites.id, survey.siteId));
  }
  revalidateAll();
  return { ok: true, message: "Area and dimension copied to the listing." };
}

/** Turns a loose survey into a draft property, carrying over its location, size and photos. */
export async function createPropertyFromSurvey(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const survey = await getSurveyById(id);
  if (!survey) return { error: "Survey not found." };
  const title = String(formData.get("title") ?? "").trim() || survey.title.trim();
  if (title.length < 2) return { error: "Give the property a title.", fieldErrors: { title: "Required" } };
  const typeRaw = String(formData.get("type") ?? "residential_site");
  const type = (PROPERTY_TYPES as readonly string[]).includes(typeRaw) ? (typeRaw as PropertyType) : "residential_site";

  const prefix = await resolveRegionCode(formData.get("prefix"));
  const propertyNo = await allocatePropertyNo(prefix);
  const at = surveyCentre(geometryOf(survey));
  const db = await getDb();
  const [row] = await db
    .insert(properties)
    .values({
      prefix,
      propertyNo,
      type,
      titleEn: title.slice(0, 140),
      locationEn: String(formData.get("location") ?? "").trim().slice(0, 200),
      privateNotes: survey.notes,
      ...sizePatch(survey),
      lat: at ? Number(at.lat.toFixed(7)) : null,
      lng: at ? Number(at.lng.toFixed(7)) : null,
      // Survey photos become the listing's photos; the survey keeps its geometry only.
      images: survey.photos,
      published: false,
    })
    .returning({ id: properties.id });
  await db
    .update(surveys)
    .set({ ...NO_TARGET, propertyId: row.id, photos: [], updatedAt: new Date() })
    .where(eq(surveys.id, id));
  revalidateAll();
  redirect(`/admin/properties/${row.id}?created=1`);
}

export async function uploadSurveyPhotos(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const survey = await getSurveyById(id);
  if (!survey) return { error: "Survey not found." };
  const files = formFiles(formData, "photos");
  if (!files.length) return { error: "Choose at least one photo." };
  const urls: string[] = [];
  try {
    for (const file of files.slice(0, 12)) urls.push(await saveImage(file, "surveys"));
  } catch (error) {
    for (const url of urls) await deleteStored(url);
    if (error instanceof UploadError) return { error: error.message };
    console.error(error);
    return { error: "Upload failed. Please try fewer photos at a time." };
  }
  const db = await getDb();
  await db
    .update(surveys)
    .set({ photos: [...survey.photos, ...urls], updatedAt: new Date() })
    .where(eq(surveys.id, id));
  revalidateAll();
  return { success: `${urls.length} photo${urls.length === 1 ? "" : "s"} saved.` };
}

export async function removeSurveyPhoto(id: number, url: string): Promise<void> {
  await requireAdmin();
  const survey = await getSurveyById(id);
  if (!survey || !survey.photos.includes(url)) return;
  const db = await getDb();
  await db
    .update(surveys)
    .set({ photos: survey.photos.filter((u) => u !== url), updatedAt: new Date() })
    .where(eq(surveys.id, id));
  await deleteStored(url);
  revalidateAll();
}

export async function deleteSurvey(id: number): Promise<void> {
  await requireAdmin();
  const survey = await getSurveyById(id);
  if (!survey) return;
  const db = await getDb();
  await db.delete(surveys).where(eq(surveys.id, id));
  for (const url of survey.photos) await deleteStored(url);
  // With its survey gone the listing has no pin, unless an older survey of it still has one.
  const listing = listingOf(survey);
  if (listing) await syncListingLocation(listing);
  revalidateAll();
  redirect("/admin/surveys");
}
