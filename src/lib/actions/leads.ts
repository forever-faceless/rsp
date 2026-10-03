"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { LEAD_PURPOSE_ANSWERS, LEAD_STATUSES, leads, projects, properties, sites, type LeadPurposeAnswer, type LeadStatus } from "@/lib/db/schema";
import type { ActionState } from "@/lib/forms";
import { isLeadChannel } from "@/lib/lead-sources";
import { formatRef } from "@/lib/refs";
import { isIndianMobile, normalisePhone } from "@/lib/utils";

/** The property number and links for what a lead is about, from the picker's "property:12" style key. */
async function resolveSubject(key: string) {
  const none = { ref: "", propertyId: null, siteId: null, projectId: null };
  const [type, rawId] = key.split(":");
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return none;
  const db = await getDb();
  if (type === "property") {
    const [p] = await db.select({ prefix: properties.prefix, no: properties.propertyNo }).from(properties).where(eq(properties.id, id));
    return p ? { ...none, ref: formatRef(p.prefix, p.no), propertyId: id } : none;
  }
  if (type === "project") {
    const [p] = await db.select({ prefix: projects.prefix, no: projects.propertyNo }).from(projects).where(eq(projects.id, id));
    return p ? { ...none, ref: formatRef(p.prefix, p.no), projectId: id } : none;
  }
  if (type === "site") {
    const [s] = await db
      .select({ projectId: sites.projectId, siteNo: sites.siteNo, prefix: projects.prefix, no: projects.propertyNo })
      .from(sites)
      .innerJoin(projects, eq(sites.projectId, projects.id))
      .where(eq(sites.id, id));
    return s ? { ...none, ref: formatRef(s.prefix, s.no, s.siteNo), siteId: id, projectId: s.projectId } : none;
  }
  return none;
}

/**
 * Adds a lead that reached the office some other way: a DM, a call, a walk-in, through the
 * advocate. It joins the website's enquiries on the Leads page, marked with how it came in.
 */
export async function addLead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const get = (key: string) => String(formData.get(key) ?? "").trim();
  const kind = get("kind") === "sell" ? "sell" : "buy";
  const rawPhone = get("phone");
  const international = rawPhone.replace(/[\s()-]/g, "");
  const fieldErrors: Record<string, string> = {};

  let phone = "";
  if (isIndianMobile(rawPhone)) phone = normalisePhone(rawPhone);
  else if (/^\+\d{8,15}$/.test(international)) phone = international;
  else fieldErrors.phone = "Enter a 10-digit mobile number, or a number from abroad starting with +.";
  const email = get("email").slice(0, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "That email address does not look right.";
  if (Object.keys(fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors };

  const channel = get("channel");
  const purpose = get("purpose");
  const status = get("status");
  const subject = await resolveSubject(get("about"));
  const db = await getDb();
  const [row] = await db
    .insert(leads)
    .values({
      kind,
      name: get("name").slice(0, 80),
      phone,
      email,
      ...subject,
      purpose: kind === "buy" && (LEAD_PURPOSE_ANSWERS as readonly string[]).includes(purpose) ? (purpose as LeadPurposeAnswer) : "",
      budget: kind === "buy" ? get("budget").slice(0, 60) : "",
      timeline: kind === "buy" ? get("timeline").slice(0, 60) : "",
      message: get("message").slice(0, 1500),
      notes: get("notes").slice(0, 2000),
      status: LEAD_STATUSES.includes(status as LeadStatus) ? (status as LeadStatus) : "new",
      locale: get("locale") === "kn" ? "kn" : "en",
      source: `office:${isLeadChannel(channel) ? channel : "other"}`,
    })
    .returning({ id: leads.id });
  revalidatePath("/admin", "layout");
  redirect(`/admin/leads?added=${row.id}`);
}

export async function updateLeadNotes(id: number, formData: FormData): Promise<void> {
  await requireAdmin();
  const notes = String(formData.get("notes") ?? "").slice(0, 2000);
  const statusRaw = String(formData.get("status") ?? "");
  const db = await getDb();
  await db
    .update(leads)
    .set({
      notes,
      ...(LEAD_STATUSES.includes(statusRaw as LeadStatus) ? { status: statusRaw as LeadStatus } : {}),
    })
    .where(eq(leads.id, id));
  revalidatePath("/admin", "layout");
}

export async function deleteLead(id: number): Promise<void> {
  await requireAdmin();
  const db = await getDb();
  await db.delete(leads).where(eq(leads.id, id));
  revalidatePath("/admin", "layout");
}
