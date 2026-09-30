"use server";

import { headers } from "next/headers";
import { getDb } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";
import { normalisePhone } from "@/lib/utils";
import { leadSchema } from "@/lib/validation";

export type EnquiryState =
  | { status: "idle" }
  | { status: "success"; leadId: number }
  | { status: "error"; code: "invalid_phone" | "invalid_name" | "consent_required" | "too_many" | "generic" };

const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 6;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

const sellTypeLabels: Record<string, string> = {
  residential_site: "Residential site",
  commercial_site: "Commercial site",
  house: "House",
  farm_land: "Farm land",
  commercial_building: "Commercial building",
};

/** Folds the answers from the "sell with us" form into one note the office can read at a glance. */
function sellerNote(formData: FormData): string {
  const get = (key: string) => String(formData.get(key) ?? "").trim();
  const type = get("sellType");
  return [
    type && `Selling: ${sellTypeLabels[type] ?? type}`,
    get("sellLocation") && `Location: ${get("sellLocation")}`,
    get("sellSize") && `Size: ${get("sellSize")}`,
    get("sellPrice") && `Expected price: ${get("sellPrice")}`,
    get("sellDetails") && `Notes: ${get("sellDetails")}`,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1500);
}

/** Handles both the buyer enquiry form and the "sell with us" form; `kind` tells them apart. */
export async function submitEnquiry(_prev: EnquiryState, formData: FormData): Promise<EnquiryState> {
  if (formData.get("kind") === "sell") formData.set("message", sellerNote(formData));
  const parsed = leadSchema.safeParse({
    kind: formData.get("kind") ?? "buy",
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email") ?? "",
    projectId: formData.get("projectId") ?? "",
    siteId: formData.get("siteId") ?? "",
    propertyId: formData.get("propertyId") ?? "",
    ref: formData.get("ref") ?? "",
    purpose: formData.get("purpose") ?? "self_use",
    budget: formData.get("budget") ?? "",
    timeline: formData.get("timeline") ?? "",
    message: formData.get("message") ?? "",
    locale: formData.get("locale") ?? "en",
    source: formData.get("source") ?? "",
    consent: formData.get("consent") === "on",
    website: formData.get("website") ?? "",
  });

  if (!parsed.success) {
    const paths = parsed.error.issues.map((i) => String(i.path[0]));
    if (paths.includes("website")) return { status: "success", leadId: 0 }; // bot: pretend success
    if (paths.includes("phone")) return { status: "error", code: "invalid_phone" };
    if (paths.includes("name")) return { status: "error", code: "invalid_name" };
    if (paths.includes("consent")) return { status: "error", code: "consent_required" };
    return { status: "error", code: "generic" };
  }

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "local").split(",")[0].trim();
  const phone = normalisePhone(parsed.data.phone);
  if (rateLimited(ip) || rateLimited(`phone:${phone}`)) {
    return { status: "error", code: "too_many" };
  }

  const d = parsed.data;
  const base = {
    kind: d.kind,
    name: d.name,
    phone,
    email: d.email,
    ref: d.ref,
    purpose: d.purpose,
    budget: d.budget,
    timeline: d.timeline,
    message: d.message,
    locale: d.locale,
    source: d.source,
  };
  const db = await getDb();
  try {
    const [row] = await db
      .insert(leads)
      .values({ ...base, projectId: d.projectId, siteId: d.siteId, propertyId: d.propertyId })
      .returning({ id: leads.id });
    return { status: "success", leadId: row.id };
  } catch (error) {
    // A stale form can point at a listing that has since been deleted. The property number
    // in `ref` still says what the visitor was looking at, so keep the lead without the links.
    try {
      const [row] = await db.insert(leads).values(base).returning({ id: leads.id });
      return { status: "success", leadId: row.id };
    } catch {
      console.error("enquiry insert failed", error);
      return { status: "error", code: "generic" };
    }
  }
}
