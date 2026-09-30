"use server";

import { eq, inArray, or, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { getRegion, getSettings } from "@/lib/db/queries";
import { landmarks, leads, projects, properties, regions, settings, sites, surveys, teamMembers, testimonials } from "@/lib/db/schema";
import { DEMO_SETTINGS, DEMO_SETTINGS_RESET, type DemoSettingKey } from "@/lib/demo";
import { formFile, type ActionState, zodFieldErrors } from "@/lib/forms";
import { deleteStored, saveImage, UploadError } from "@/lib/storage";
import { settingsSchema } from "@/lib/validation";
import { revalidateAll } from "./shared";

export async function updateSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const data: Record<string, FormDataEntryValue | string | boolean> = {};
  for (const key of Object.keys(settingsSchema.shape)) data[key] = formData.get(key) ?? "";
  data.showStats = formData.get("showStats") === "on";
  const parsed = settingsSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Please check the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  if (!(await getRegion(parsed.data.propertyPrefix))) {
    return { error: "Please check the highlighted fields.", fieldErrors: { propertyPrefix: "Add this district below first" } };
  }
  const existing = await getSettings();
  let heroImage: string | undefined;
  try {
    const file = formFile(formData, "heroImage");
    if (file) heroImage = await saveImage(file, "hero");
  } catch (error) {
    return { error: error instanceof UploadError ? error.message : "Hero image upload failed." };
  }
  if (heroImage === undefined && formData.get("removeHero") === "on" && existing.heroImage) heroImage = "";

  const db = await getDb();
  await db
    .update(settings)
    .set({ ...parsed.data, ...(heroImage !== undefined ? { heroImage } : {}), updatedAt: new Date() })
    .where(eq(settings.id, 1));
  if (heroImage !== undefined && existing.heroImage && heroImage !== existing.heroImage) await deleteStored(existing.heroImage);
  revalidateAll();
  return { success: "Settings saved." };
}

/**
 * Removes the rows the seed script inserted, and blanks any placeholder company detail
 * that is still in place. Listings, enquiries and details entered by hand are left alone.
 */
export async function clearDemoContent(): Promise<void> {
  await requireAdmin();
  const current = await getSettings();
  if (!current.demoContent) return;
  const db = await getDb();
  await db.delete(leads).where(eq(leads.isDemo, true));
  await db.delete(surveys).where(eq(surveys.isDemo, true));
  // Children first, so nothing is orphaned even where foreign keys are not enforced.
  const demoProjects = db.select({ id: projects.id }).from(projects).where(eq(projects.isDemo, true));
  const demoProperties = db.select({ id: properties.id }).from(properties).where(eq(properties.isDemo, true));
  await db.delete(sites).where(inArray(sites.projectId, demoProjects));
  await db.delete(landmarks).where(or(inArray(landmarks.projectId, demoProjects), inArray(landmarks.propertyId, demoProperties)));
  await db.delete(projects).where(eq(projects.isDemo, true));
  await db.delete(properties).where(eq(properties.isDemo, true));
  await db.delete(testimonials).where(eq(testimonials.isDemo, true));
  await db.delete(teamMembers).where(eq(teamMembers.isDemo, true));

  const reset: Record<string, string | number | null> = {};
  for (const key of Object.keys(DEMO_SETTINGS) as DemoSettingKey[]) {
    if (DEMO_SETTINGS[key] !== "" && current[key] === DEMO_SETTINGS[key]) reset[key] = DEMO_SETTINGS_RESET[key];
  }

  // With the registers empty again, numbering restarts at 1 in every district.
  const [left] = await db
    .select({ n: sql<number>`(select count(*) from ${projects}) + (select count(*) from ${properties})` })
    .from(settings)
    .where(eq(settings.id, 1));
  if (Number(left?.n ?? 0) === 0) await db.update(regions).set({ nextNo: 1 });
  await db
    .update(settings)
    .set({ ...reset, demoContent: false, updatedAt: new Date() })
    .where(eq(settings.id, 1));
  revalidateAll();
}
