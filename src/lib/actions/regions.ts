"use server";

import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { countRegionUse, getRegion, getSettings } from "@/lib/db/queries";
import { regions } from "@/lib/db/schema";
import { type ActionState, zodFieldErrors } from "@/lib/forms";
import { regionSchema } from "@/lib/validation";
import { revalidateAll } from "./shared";

function read(formData: FormData, code?: string) {
  return regionSchema.safeParse({
    code: code ?? formData.get("code") ?? "",
    nameEn: formData.get("nameEn") ?? "",
    nameKn: formData.get("nameKn") ?? "",
  });
}

/** Opens a new district register, such as MYS for Mysuru. Its numbers start at 1. */
export async function addRegion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = read(formData);
  if (!parsed.success) return { error: "Please check the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  if (await getRegion(parsed.data.code)) return { error: `${parsed.data.code} is already in use.`, fieldErrors: { code: "Already in use" } };
  const db = await getDb();
  const [last] = await db.select({ n: regions.sortOrder }).from(regions).orderBy(regions.sortOrder).limit(1);
  await db.insert(regions).values({ ...parsed.data, sortOrder: Number(last?.n ?? 0) + 1 });
  revalidateAll();
  return { success: `${parsed.data.code} added. Its first listing will be ${parsed.data.code}-0001.` };
}

/** Renames a district. The code itself never changes, because listings already carry it. */
export async function updateRegion(code: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const existing = await getRegion(code);
  if (!existing) return { error: "District not found." };
  const parsed = read(formData, existing.code);
  if (!parsed.success) return { error: "Please check the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const db = await getDb();
  await db.update(regions).set({ nameEn: parsed.data.nameEn, nameKn: parsed.data.nameKn }).where(eq(regions.code, existing.code));
  revalidateAll();
  return { success: "Saved." };
}

/** Closes a district register. Refused while any listing carries its code, or while it is the main one. */
export async function deleteRegion(code: string): Promise<void> {
  await requireAdmin();
  const existing = await getRegion(code);
  if (!existing) return;
  const [settings, use] = await Promise.all([getSettings(), countRegionUse()]);
  if (existing.code === settings.propertyPrefix || (use.get(existing.code) ?? 0) > 0) return;
  const db = await getDb();
  await db.delete(regions).where(eq(regions.code, existing.code));
  revalidateAll();
}
