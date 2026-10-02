"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { getBroker, getPropertyById } from "@/lib/db/queries";
import { brokers, landmarks, LISTING_STATUSES, properties, type ListingStatus } from "@/lib/db/schema";
import { formFiles, parseApprovalLines, parseBilingualLines, type ActionState, zodFieldErrors } from "@/lib/forms";
import { deleteStored, saveImage, UploadError } from "@/lib/storage";
import { normalisePhone } from "@/lib/utils";
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
    priceDisplay: formData.get("priceDisplay") ?? "both",
    featured: formData.get("featured") === "on",
    published: formData.get("published") === "on",
    sortOrder: formData.get("sortOrder") ?? "0",
    ownerName: formData.get("ownerName") ?? "",
    ownerPhone: formData.get("ownerPhone") ?? "",
    privateNotes: formData.get("privateNotes") ?? "",
    source: formData.get("source") ?? "seller",
    dealTerms: formData.get("dealTerms") ?? "",
  });
}

/**
 * The broker a listing came through: one picked from the list, or a new one typed in, which is
 * added to the list. A new broker whose number is already on the list is taken to be that broker.
 */
async function resolveBroker(formData: FormData, source: "seller" | "broker"): Promise<{ brokerId: number | null } | { error: string }> {
  if (source !== "broker") return { brokerId: null };
  const picked = Number(formData.get("brokerId"));
  if (Number.isInteger(picked) && picked > 0 && (await getBroker(picked))) return { brokerId: picked };
  const name = String(formData.get("newBrokerName") ?? "").trim().slice(0, 120);
  const phone = normalisePhone(String(formData.get("newBrokerPhone") ?? "")).slice(0, 20);
  const firm = String(formData.get("newBrokerFirm") ?? "").trim().slice(0, 120);
  if (name.length < 2) return { error: "Choose the broker from the list, or add a new one with a name." };
  const db = await getDb();
  if (phone) {
    const same = (await db.query.brokers.findMany()).find((b) => normalisePhone(b.phone) === phone);
    if (same) return { brokerId: same.id };
  }
  const [row] = await db.insert(brokers).values({ name, phone, firm }).returning({ id: brokers.id });
  return { brokerId: row.id };
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
  const broker = await resolveBroker(formData, parsed.data.source);
  if ("error" in broker) return { error: broker.error, fieldErrors: { brokerId: broker.error } };
  const number = await resolveNewPropertyNo(formData);
  if ("error" in number) return { error: number.error, fieldErrors: { [number.field]: number.error } };

  const db = await getDb();
  const [row] = await db
    .insert(properties)
    .values({ ...parsed.data, ...broker, facing: parsed.data.facing || null, prefix: number.prefix, propertyNo: number.propertyNo, ...lists(formData) })
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
  const broker = await resolveBroker(formData, parsed.data.source);
  if ("error" in broker) return { error: broker.error, fieldErrors: { brokerId: broker.error } };
  const db = await getDb();
  await db
    .update(properties)
    .set({ ...parsed.data, ...broker, facing: parsed.data.facing || null, ...lists(formData), updatedAt: new Date() })
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
