"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { getTestimonial } from "@/lib/db/queries";
import { testimonials } from "@/lib/db/schema";
import { formFile, type ActionState, zodFieldErrors } from "@/lib/forms";
import { deleteStored, saveImage, UploadError } from "@/lib/storage";
import { testimonialSchema } from "@/lib/validation";
import { revalidateAll } from "./shared";

function read(formData: FormData) {
  return testimonialSchema.safeParse({
    nameEn: formData.get("nameEn") ?? "",
    nameKn: formData.get("nameKn") ?? "",
    locationEn: formData.get("locationEn") ?? "",
    locationKn: formData.get("locationKn") ?? "",
    quoteEn: formData.get("quoteEn") ?? "",
    quoteKn: formData.get("quoteKn") ?? "",
    published: formData.get("published") === "on",
    sortOrder: formData.get("sortOrder") ?? "0",
  });
}

async function photoFrom(formData: FormData): Promise<string | undefined> {
  const file = formFile(formData, "photo");
  return file ? saveImage(file, "people") : undefined;
}

export async function saveTestimonial(id: number | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = read(formData);
  if (!parsed.success) {
    return { error: "Please check the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  let photo: string | undefined;
  try {
    photo = await photoFrom(formData);
  } catch (error) {
    return { error: error instanceof UploadError ? error.message : "Photo upload failed." };
  }
  const db = await getDb();
  if (id == null) {
    await db.insert(testimonials).values({ ...parsed.data, photo: photo ?? "" });
    revalidateAll();
    redirect("/admin/testimonials");
  }
  const existing = await getTestimonial(id);
  if (!existing) return { error: "Testimonial not found." };
  const removePhoto = photo === undefined && formData.get("removePhoto") === "on";
  await db
    .update(testimonials)
    .set({ ...parsed.data, ...(photo !== undefined ? { photo } : removePhoto ? { photo: "" } : {}) })
    .where(eq(testimonials.id, id));
  if ((photo !== undefined || removePhoto) && existing.photo) await deleteStored(existing.photo);
  revalidateAll();
  return { success: "Testimonial saved." };
}

export async function deleteTestimonial(id: number): Promise<void> {
  await requireAdmin();
  const existing = await getTestimonial(id);
  if (!existing) return;
  const db = await getDb();
  await db.delete(testimonials).where(eq(testimonials.id, id));
  if (existing.photo) await deleteStored(existing.photo);
  revalidateAll();
  redirect("/admin/testimonials");
}
