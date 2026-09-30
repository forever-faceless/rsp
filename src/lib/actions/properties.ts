"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { getPropertyById } from "@/lib/db/queries";
import { landmarks, LISTING_STATUSES, properties, type ListingStatus } from "@/lib/db/schema";
import { formFiles, parseApprovalLines, parseBilingualLines, type ActionState, zodFieldErrors } from "@/lib/forms";
import { deleteStored, saveImage, UploadError } from "@/lib/storage";
import { propertySchema } from "@/lib/validation";
import { deriveDimension, resolveNewPropertyNo, revalidateAll } from "./shared";

function readPropertyForm(formData: FormData) {
  const { dimension, areaSqft } = deriveDimension(formData);
  return propertySchema.safeParse({
    type: formData.get("type") ?? "residential_site",
    titleEn: formData.get("titleEn") ?? "",
    titleKn: formData.get("titleKn") ?? "",
    locationEn: formData.get("locationEn") ?? "",
    locationKn: formData.get("locationKn") ?? "",
    descriptionEn: formData.get("descriptionEn") ?? "",
    descriptionKn: formData.get("descriptionKn") ?? "",
    dimension,
    widthFt: formData.get("widthFt") ?? "",
    depthFt: formData.get("depthFt") ?? "",
    areaSqft,
    areaUnit: formData.get("areaUnit") ?? "sqft",
    builtUpSqft: formData.get("builtUpSqft") ?? "",
    bedrooms: formData.get("bedrooms") ?? "",
    floors: formData.get("floors") ?? "",
    facing: formData.get("facing") ?? "",
    roadWidthFt: formData.get("roadWidthFt") ?? "",
    corner: formData.get("corner") === "on",
    status: formData.get("status") ?? "available",
    price: formData.get("price") ?? "",
    pricePerSqft: formData.get("pricePerSqft") ?? "",
    negotiable: formData.get("negotiable") === "on",
    callForPrice: formData.get("callForPrice") === "on",
    featured: formData.get("featured") === "on",
    published: formData.get("published") === "on",
    sortOrder: formData.get("sortOrder") ?? "0",
    ownerName: formData.get("ownerName") ?? "",
    ownerPhone: formData.get("ownerPhone") ?? "",
    privateNotes: formData.get("privateNotes") ?? "",
  });
}

function lists(formData: FormData) {
  return {
    features: parseBilingualLines(String(formData.get("features") ?? "")),
    documents: parseApprovalLines(String(formData.get("documents") ?? "")),
  };
}

export async function createProperty(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = readPropertyForm(formData);
  if (!parsed.success) {
    return { error: "Please check the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const number = await resolveNewPropertyNo(formData);
  if ("error" in number) return { error: number.error, fieldErrors: { [number.field]: number.error } };

  const db = await getDb();
  const [row] = await db
    .insert(properties)
    .values({ ...parsed.data, facing: parsed.data.facing || null, prefix: number.prefix, propertyNo: number.propertyNo, ...lists(formData) })
    .returning({ id: properties.id });
  revalidateAll();
  redirect(`/admin/properties/${row.id}?created=1`);
}

export async function updateProperty(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const existing = await getPropertyById(id);
  if (!existing) return { error: "Property not found." };
  const parsed = readPropertyForm(formData);
  if (!parsed.success) {
    return { error: "Please check the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const db = await getDb();
  await db
    .update(properties)
    .set({ ...parsed.data, facing: parsed.data.facing || null, ...lists(formData), updatedAt: new Date() })
    .where(eq(properties.id, id));
  revalidateAll();
  return { success: "Property saved." };
}

export async function uploadPropertyImages(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const existing = await getPropertyById(id);
  if (!existing) return { error: "Property not found." };
  const files = formFiles(formData, "images");
  if (!files.length) return { error: "Choose at least one photo." };
  const urls: string[] = [];
  try {
    for (const file of files.slice(0, 12)) urls.push(await saveImage(file, "properties"));
  } catch (error) {
    for (const url of urls) await deleteStored(url);
    if (error instanceof UploadError) return { error: error.message };
    console.error(error);
    return { error: "Upload failed. Please try fewer photos at a time." };
  }
  const db = await getDb();
  await db
    .update(properties)
    .set({ images: [...existing.images, ...urls], updatedAt: new Date() })
    .where(eq(properties.id, id));
  revalidateAll();
  return { success: `${urls.length} photo${urls.length === 1 ? "" : "s"} uploaded.` };
}

export async function removePropertyImage(id: number, url: string): Promise<void> {
  await requireAdmin();
  const existing = await getPropertyById(id);
  if (!existing || !existing.images.includes(url)) return;
  const db = await getDb();
  await db
    .update(properties)
    .set({ images: existing.images.filter((u) => u !== url), updatedAt: new Date() })
    .where(eq(properties.id, id));
  await deleteStored(url);
  revalidateAll();
}

/** The first photo is the cover, so promoting a photo simply moves it to the front. */
export async function setPropertyCover(id: number, url: string): Promise<void> {
  await requireAdmin();
  const existing = await getPropertyById(id);
  if (!existing || !existing.images.includes(url)) return;
  const db = await getDb();
  await db
    .update(properties)
    .set({ images: [url, ...existing.images.filter((u) => u !== url)], updatedAt: new Date() })
    .where(eq(properties.id, id));
  revalidateAll();
}

export async function setPropertyStatus(id: number, status: ListingStatus): Promise<void> {
  await requireAdmin();
  if (!LISTING_STATUSES.includes(status)) return;
  const db = await getDb();
  await db.update(properties).set({ status, updatedAt: new Date() }).where(eq(properties.id, id));
  revalidateAll();
}

export async function setPropertyPublished(id: number, published: boolean): Promise<void> {
  await requireAdmin();
  const db = await getDb();
  await db.update(properties).set({ published, updatedAt: new Date() }).where(eq(properties.id, id));
  revalidateAll();
}

export async function deleteProperty(id: number): Promise<void> {
  await requireAdmin();
  const existing = await getPropertyById(id);
  if (!existing) return;
  const db = await getDb();
  await db.delete(landmarks).where(eq(landmarks.propertyId, id));
  await db.delete(properties).where(eq(properties.id, id));
  for (const url of [...existing.images, ...existing.videos.filter((v) => v.kind === "file").map((v) => v.url)]) await deleteStored(url);
  revalidateAll();
  redirect("/admin/properties");
}
