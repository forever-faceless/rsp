import "server-only";
import { revalidatePath } from "next/cache";
import { allocatePropertyNo, getRegion, getSettings, propertyNoInUse, reservePropertyNo } from "@/lib/db/queries";
import { cleanPrefix, formatPropertyNo, isPrefix, parseRef } from "@/lib/refs";

export function revalidateAll(): void {
  revalidatePath("/", "layout");
}

/**
 * The district a new listing goes into: the code chosen in the form when it names a known
 * district, otherwise the main one from settings.
 */
export async function resolveRegionCode(raw: FormDataEntryValue | null): Promise<string> {
  const code = cleanPrefix(String(raw ?? ""));
  if (raw && isPrefix(code) && (await getRegion(code))) return code;
  return (await getSettings()).propertyPrefix;
}

/**
 * Picks the property number for a new listing. A blank field takes the next number in the
 * chosen district; a typed number is accepted when it is free, which lets existing paperwork
 * keep the numbers it already carries. Typing the letters as well, as in MYS-0012, chooses
 * that district.
 */
export async function resolveNewPropertyNo(formData: FormData): Promise<{ prefix: string; propertyNo: number } | { error: string; field: "prefix" | "propertyNo" }> {
  const chosen = await resolveRegionCode(formData.get("prefix"));
  const text = String(formData.get("propertyNo") ?? "").trim();
  if (!text) return { prefix: chosen, propertyNo: await allocatePropertyNo(chosen) };
  const parsed = parseRef(text);
  if (!parsed || parsed.siteNo != null || parsed.propertyNo > 9999) {
    return { error: "Enter a property number between 1 and 9999, or leave it blank.", field: "propertyNo" };
  }
  let prefix = chosen;
  if (parsed.prefix && parsed.prefix !== chosen) {
    if (!(await getRegion(parsed.prefix))) return { error: `There is no district with the code ${parsed.prefix}. Add it in settings first.`, field: "propertyNo" };
    prefix = parsed.prefix;
  }
  if (await propertyNoInUse(prefix, parsed.propertyNo)) return { error: `${formatPropertyNo(prefix, parsed.propertyNo)} is already in use.`, field: "propertyNo" };
  await reservePropertyNo(prefix, parsed.propertyNo);
  return { prefix, propertyNo: parsed.propertyNo };
}

/** Builds "30 × 40" and the area from width and depth when the form left them blank. */
export function deriveDimension(formData: FormData): { dimension: string; areaSqft: FormDataEntryValue | string } {
  const width = Number(formData.get("widthFt") ?? 0);
  const depth = Number(formData.get("depthFt") ?? 0);
  const both = width > 0 && depth > 0;
  const dimension = String(formData.get("dimension") ?? "").trim() || (both ? `${width} × ${depth}` : "");
  const area = formData.get("areaSqft");
  return { dimension, areaSqft: (area == null || area === "") && both ? String(width * depth) : (area ?? "") };
}
