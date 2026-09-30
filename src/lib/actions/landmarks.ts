"use server";

import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { getLandmarkById, getProjectById, getPropertyById } from "@/lib/db/queries";
import { landmarks } from "@/lib/db/schema";
import { type ActionState, zodFieldErrors } from "@/lib/forms";
import { landmarkSchema } from "@/lib/validation";
import { revalidateAll } from "./shared";

export type LandmarkOwner = { kind: "project" | "property"; id: number };

/** Adds a landmark, or updates one when the form carries its id. */
export async function saveLandmark(owner: LandmarkOwner, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parent = owner.kind === "project" ? await getProjectById(owner.id) : await getPropertyById(owner.id);
  if (!parent) return { error: "Listing not found." };

  const parsed = landmarkSchema.safeParse({
    nameEn: formData.get("nameEn") ?? "",
    nameKn: formData.get("nameKn") ?? "",
    category: formData.get("category") ?? "other",
    lat: formData.get("lat"),
    lng: formData.get("lng"),
    driveMinutes: formData.get("driveMinutes") ?? "",
  });
  if (!parsed.success) {
    return { error: "Please check the landmark name and coordinates.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }

  const db = await getDb();
  const id = Number(formData.get("id") ?? 0);
  if (id > 0) {
    const existing = await getLandmarkById(id);
    const sameOwner = existing && (owner.kind === "project" ? existing.projectId === owner.id : existing.propertyId === owner.id);
    if (!sameOwner) return { error: "Landmark not found." };
    await db.update(landmarks).set(parsed.data).where(eq(landmarks.id, id));
    revalidateAll();
    return { success: "Landmark saved." };
  }

  await db.insert(landmarks).values({
    ...parsed.data,
    projectId: owner.kind === "project" ? owner.id : null,
    propertyId: owner.kind === "property" ? owner.id : null,
  });
  revalidateAll();
  return { success: "Landmark added." };
}

export async function deleteLandmark(id: number): Promise<void> {
  await requireAdmin();
  const db = await getDb();
  await db.delete(landmarks).where(eq(landmarks.id, id));
  revalidateAll();
}
