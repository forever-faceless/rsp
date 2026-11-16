"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { parseIstInput } from "@/lib/utils";
import { getDb } from "@/lib/db/client";
import {
  CONTACT_OUTCOMES,
  LEAD_KINDS,
  LEAD_PURPOSE_ANSWERS,
  LEAD_STATUSES,
  LEAD_TEMPERATURES,
  LOST_REASONS,
  NEXT_KINDS,
  OPEN_LEAD_STATUSES,
  leadEvents,
  leads,
  projects,
  properties,
  sites,
  type ContactOutcome,
  type LeadKind,
  type LeadPurposeAnswer,
  type LeadStatus,
  type LeadTemperature,
  type LostReason,
  type NextKind,
} from "@/lib/db/schema";
import { stageLabel } from "@/lib/leads/labels";
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
      // What the office writes about a lead is one note, kept where it can be changed later.
      notes: get("notes").slice(0, 2000),
      status: LEAD_STATUSES.includes(status as LeadStatus) ? (status as LeadStatus) : "new",
      locale: get("locale") === "kn" ? "kn" : "en",
      source: `office:${isLeadChannel(channel) ? channel : "other"}`,
    })
    .returning({ id: leads.id });
  revalidatePath("/admin", "layout");
  redirect(`/admin/leads/${row.id}?added=1`);
}

const oneOf = <T extends string>(list: readonly T[], value: string, fallback: T): T => (list.includes(value as T) ? (value as T) : fallback);

/**
 * What the office fills in after a call, a visit or a message: how it went, where the lead now
 * stands, and the one thing to do next. A lead that is still open cannot be saved without a
 * next step, which is what keeps it from being forgotten.
 */
export async function logContact(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdmin();
  const get = (key: string) => String(formData.get(key) ?? "").trim();
  const db = await getDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, id));
  if (!lead) return { error: "That lead no longer exists." };

  const kind = oneOf(["call", "visit", "whatsapp", "note"] as const, get("kind"), "note");
  const outcome = kind === "call" || kind === "visit" ? oneOf(["", ...CONTACT_OUTCOMES] as const, get("outcome"), "") : "";
  const text = get("text").slice(0, 2000);
  const nextKind = oneOf(NEXT_KINDS, get("nextKind"), "") as NextKind;
  const nextAt = parseIstInput(get("nextAt"));
  let status = oneOf(LEAD_STATUSES, get("status"), lead.status) as LeadStatus;
  const fieldErrors: Record<string, string> = {};
  if ((kind === "call" || kind === "visit") && !outcome) fieldErrors.outcome = "Choose how it went.";
  if (kind === "note" && !text) fieldErrors.text = "Write the note.";

  // The stage follows what happened, and only ever forwards.
  const order = (v: LeadStatus) => LEAD_STATUSES.indexOf(v);
  const atLeast = (v: LeadStatus) => {
    if (status !== "lost" && order(status) < order(v)) status = v;
  };
  if (outcome === "talked" || kind === "whatsapp") atLeast("contacted");
  if (nextKind === "visit" && outcome !== "came") atLeast("visit_booked");
  if (outcome === "came") atLeast("visited");

  const open = (OPEN_LEAD_STATUSES as readonly string[]).includes(status);
  const lostReason = status === "lost" ? (oneOf(["", ...LOST_REASONS] as const, get("lostReason"), "") as LostReason | "") : "";
  if (status === "lost" && !lostReason) fieldErrors.lostReason = "Choose why.";
  if (open && (!nextKind || !nextAt)) fieldErrors.nextAt = "Choose what happens next and when.";
  if (Object.keys(fieldErrors).length) return { error: Object.values(fieldErrors)[0], fieldErrors };

  const now = new Date();
  const moved = status !== lead.status ? `${stageLabel(lead.status, lead.kind)} to ${stageLabel(status, lead.kind)}` : "";
  await db.insert(leadEvents).values({
    leadId: id,
    kind,
    direction: kind === "call" ? oneOf(["in", "out"] as const, get("direction"), "out") : "",
    outcome: outcome as ContactOutcome | "",
    text: [text, moved ? `Stage: ${moved}.` : ""].filter(Boolean).join("\n"),
    by: session.user,
    at: now,
  });
  await db
    .update(leads)
    .set({
      status,
      temperature: oneOf(LEAD_TEMPERATURES, get("temperature"), lead.temperature) as LeadTemperature,
      nextKind: open ? nextKind : "",
      nextNote: open ? get("nextNote").slice(0, 200) : "",
      nextAt: open ? nextAt : null,
      lostReason,
      ...(kind === "note" ? {} : { lastContactAt: now }),
    })
    .where(eq(leads.id, id));
  revalidatePath("/admin", "layout");
  return { success: open ? "Saved. The next step is on your list." : "Saved." };
}

/** The facts about the person, changed from the lead's own page. */
export async function updateLeadDetails(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const get = (key: string) => String(formData.get(key) ?? "").trim();
  const purpose = get("purpose");
  const db = await getDb();
  await db
    .update(leads)
    .set({
      name: get("name").slice(0, 80),
      kind: oneOf(LEAD_KINDS, get("kind"), "buy") as LeadKind,
      purpose: (LEAD_PURPOSE_ANSWERS as readonly string[]).includes(purpose) ? (purpose as LeadPurposeAnswer) : "",
      budget: get("budget").slice(0, 60),
      timeline: get("timeline").slice(0, 60),
      notes: get("notes").slice(0, 2000),
      // An older lead added by the office kept its first note apart; the page shows the two as
      // one, so once saved they are one.
      message: sql`case when ${leads.source} like 'office:%' then '' else ${leads.message} end`,
    })
    .where(eq(leads.id, id));
  revalidatePath("/admin", "layout");
  return { success: "Saved." };
}

export async function deleteLead(id: number): Promise<void> {
  await requireAdmin();
  const db = await getDb();
  await db.delete(leads).where(eq(leads.id, id));
  revalidatePath("/admin", "layout");
  redirect("/admin/leads");
}
