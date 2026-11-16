import "server-only";
import { createHmac } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { getProjectById, getPropertyById, getSiteById, listLandmarks, listLeads, type LeadWithRefs } from "@/lib/db/queries";
import { leadAudio, leadEvents, OPEN_LEAD_STATUSES, type Landmark, type Lead, type LeadEvent } from "@/lib/db/schema";
import { startOfIstDay } from "./labels";

export function isOpen(lead: Pick<Lead, "status">): boolean {
  return (OPEN_LEAD_STATUSES as readonly string[]).includes(lead.status);
}

export async function getLead(id: number): Promise<LeadWithRefs | null> {
  return (await listLeads({ id }))[0] ?? null;
}

export type LeadEventRow = LeadEvent & { audioId: number | null };

export async function listLeadEvents(leadId: number): Promise<LeadEventRow[]> {
  const db = await getDb();
  const rows = await db
    .select({ event: leadEvents, audioId: leadAudio.id })
    .from(leadEvents)
    .leftJoin(leadAudio, eq(leadAudio.eventId, leadEvents.id))
    .where(eq(leadEvents.leadId, leadId))
    .orderBy(desc(leadEvents.at), desc(leadEvents.id));
  return rows.map((r) => ({ ...r.event, audioId: r.audioId }));
}

export type Desk = {
  /** Next step was due before now. */
  overdue: LeadWithRefs[];
  /** Next step falls later today. */
  today: LeadWithRefs[];
  /** Nobody has spoken to them yet and nothing is planned. */
  fresh: LeadWithRefs[];
  /** Spoken to, still open, and nothing planned: the ones that go cold. */
  drifting: LeadWithRefs[];
  /** Planned for the coming week. */
  upcoming: LeadWithRefs[];
};

/** Everything the office has to do, sorted into what is late, what is today and what has no plan. */
export async function getDesk(now: Date = new Date()): Promise<Desk> {
  const all = (await listLeads()).filter((l) => isOpen(l) && l.sent);
  const endOfDay = startOfIstDay(now).getTime() + 24 * 60 * 60 * 1000;
  const week = endOfDay + 7 * 24 * 60 * 60 * 1000;
  const byWhen = (a: LeadWithRefs, b: LeadWithRefs) => (a.nextAt?.getTime() ?? 0) - (b.nextAt?.getTime() ?? 0);
  const planned = all.filter((l) => l.nextAt);
  return {
    overdue: planned.filter((l) => l.nextAt!.getTime() < now.getTime()).sort(byWhen),
    today: planned.filter((l) => l.nextAt!.getTime() >= now.getTime() && l.nextAt!.getTime() < endOfDay).sort(byWhen),
    upcoming: planned.filter((l) => l.nextAt!.getTime() >= endOfDay && l.nextAt!.getTime() < week).sort(byWhen),
    fresh: all.filter((l) => !l.nextAt && l.status === "new"),
    drifting: all.filter((l) => !l.nextAt && l.status !== "new").sort((a, b) => (b.lastContactAt ?? b.createdAt).getTime() - (a.lastContactAt ?? a.createdAt).getTime()),
  };
}

export type CallSheet = {
  ref: string;
  title: string;
  location: string;
  /** Label and value pairs, in the order someone on a call asks for them. */
  facts: [string, string][];
  price: string;
  landmarks: Landmark[];
  documents: string[];
  /** Office only: who owns it and what was agreed. */
  privateNotes: string;
  status: string;
  editHref: string;
  publicHref: string;
};

const FACING = { N: "North", S: "South", E: "East", W: "West", NE: "North-east", NW: "North-west", SE: "South-east", SW: "South-west" } as const;
const rupees = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(n)}`;

function priceText(price: number | null, perSqft: number | null, negotiable = false): string {
  const parts = [price ? rupees(price) : "", perSqft ? `${rupees(perSqft)} per sq ft` : ""].filter(Boolean);
  return parts.length ? `${parts.join(" · ")}${negotiable ? " · slightly negotiable" : ""}` : "";
}

/** What the office needs in front of it while talking about the property a lead asked for. */
export async function getCallSheet(lead: Pick<Lead, "propertyId" | "siteId" | "projectId" | "ref">): Promise<CallSheet | null> {
  if (lead.propertyId) {
    const p = await getPropertyById(lead.propertyId);
    if (!p) return null;
    return {
      ref: lead.ref,
      title: p.titleEn,
      location: p.locationEn,
      facts: (
        [
          ["Facing", p.facing ? FACING[p.facing] : ""],
          ["Size", p.dimension || (p.widthFt && p.depthFt ? `${p.widthFt} × ${p.depthFt} ft` : "")],
          ["Area", p.areaSqft ? `${new Intl.NumberFormat("en-IN").format(p.areaSqft)} sq ft` : ""],
          ["Road", p.roadWidthFt ? `${p.roadWidthFt} ft` : ""],
          ["Corner", p.corner ? "Yes" : ""],
          ["Built-up", p.builtUpSqft ? `${p.builtUpSqft} sq ft` : ""],
          ["Bedrooms", p.bedrooms ? String(p.bedrooms) : ""],
        ] as [string, string][]
      ).filter(([, v]) => v),
      price: priceText(p.price, p.pricePerSqft, p.negotiable),
      landmarks: await listLandmarks({ propertyId: p.id }),
      documents: (p.documents ?? []).map((d) => d.en),
      privateNotes: p.privateNotes,
      status: p.status,
      editHref: `/admin/properties/${p.id}`,
      publicHref: `/en/properties/${lead.ref.toLowerCase()}`,
    };
  }
  if (lead.siteId) {
    const s = await getSiteById(lead.siteId);
    const project = s ? await getProjectById(s.projectId) : null;
    if (!s || !project) return null;
    return {
      ref: lead.ref,
      title: `Site ${s.siteNo}, ${project.nameEn}`,
      location: project.locationEn,
      facts: (
        [
          ["Facing", s.facing ? FACING[s.facing] : ""],
          ["Size", s.dimension || (s.widthFt && s.depthFt ? `${s.widthFt} × ${s.depthFt} ft` : "")],
          ["Area", s.areaSqft ? `${new Intl.NumberFormat("en-IN").format(s.areaSqft)} sq ft` : ""],
          ["Road", s.roadWidthFt ? `${s.roadWidthFt} ft` : ""],
          ["Corner", s.corner ? "Yes" : ""],
        ] as [string, string][]
      ).filter(([, v]) => v),
      price: priceText(s.price, s.pricePerSqft),
      landmarks: await listLandmarks({ projectId: project.id }),
      documents: (project.approvals ?? []).map((a) => a.en),
      privateNotes: "",
      status: s.status,
      editHref: `/admin/projects/${project.id}/sites/${s.id}`,
      publicHref: `/en/projects/${project.slug}`,
    };
  }
  if (lead.projectId) {
    const project = await getProjectById(lead.projectId);
    if (!project) return null;
    return {
      ref: lead.ref,
      title: project.nameEn,
      location: project.locationEn,
      facts: ([["Sites", project.totalSites ? String(project.totalSites) : ""]] as [string, string][]).filter(([, v]) => v),
      price: priceText(project.priceFrom, project.pricePerSqft),
      landmarks: await listLandmarks({ projectId: project.id }),
      documents: (project.approvals ?? []).map((a) => a.en),
      privateNotes: "",
      status: project.status,
      editHref: `/admin/projects/${project.id}`,
      publicHref: `/en/projects/${project.slug}`,
    };
  }
  return null;
}

/** The key in the address of the calendar feed. Anyone holding it can read the follow-ups, so it is long and unguessable. */
export function calendarKey(): string {
  const secret = process.env.AUTH_SECRET?.trim() || "development-only-secret";
  return createHmac("sha256", secret).update("rsp-calendar-feed").digest("hex").slice(0, 40);
}
