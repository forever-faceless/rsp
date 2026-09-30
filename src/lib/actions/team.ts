"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { getTeamMember } from "@/lib/db/queries";
import { teamMembers } from "@/lib/db/schema";
import { formFile, type ActionState, zodFieldErrors } from "@/lib/forms";
import { deleteStored, saveImage, UploadError } from "@/lib/storage";
import { teamSchema } from "@/lib/validation";
import { revalidateAll } from "./shared";

function read(formData: FormData) {
  return teamSchema.safeParse({
    nameEn: formData.get("nameEn") ?? "",
    nameKn: formData.get("nameKn") ?? "",
    roleEn: formData.get("roleEn") ?? "",
    roleKn: formData.get("roleKn") ?? "",
    phone: formData.get("phone") ?? "",
    bioEn: formData.get("bioEn") ?? "",
    bioKn: formData.get("bioKn") ?? "",
    published: formData.get("published") === "on",
    sortOrder: formData.get("sortOrder") ?? "0",
  });
}

export async function saveTeamMember(id: number | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = read(formData);
  if (!parsed.success) {
    return { error: "Please check the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  let photo: string | undefined;
  try {
    const file = formFile(formData, "photo");
    if (file) photo = await saveImage(file, "people");
  } catch (error) {
    return { error: error instanceof UploadError ? error.message : "Photo upload failed." };
  }
  const db = await getDb();
  if (id == null) {
    await db.insert(teamMembers).values({ ...parsed.data, photo: photo ?? "" });
    revalidateAll();
    redirect("/admin/team");
  }
  const existing = await getTeamMember(id);
  if (!existing) return { error: "Team member not found." };
  const removePhoto = photo === undefined && formData.get("removePhoto") === "on";
  await db
    .update(teamMembers)
    .set({ ...parsed.data, ...(photo !== undefined ? { photo } : removePhoto ? { photo: "" } : {}) })
    .where(eq(teamMembers.id, id));
  if ((photo !== undefined || removePhoto) && existing.photo) await deleteStored(existing.photo);
  revalidateAll();
  return { success: "Team member saved." };
}

export async function deleteTeamMember(id: number): Promise<void> {
  await requireAdmin();
  const existing = await getTeamMember(id);
  if (!existing) return;
  const db = await getDb();
  await db.delete(teamMembers).where(eq(teamMembers.id, id));
  if (existing.photo) await deleteStored(existing.photo);
  revalidateAll();
  redirect("/admin/team");
}
