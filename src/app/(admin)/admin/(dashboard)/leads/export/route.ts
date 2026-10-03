import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { listLeads } from "@/lib/db/queries";
import { LEAD_KINDS, LEAD_STATUSES, type LeadKind, type LeadStatus } from "@/lib/db/schema";
import { replayUrl } from "@/lib/analytics-config";
import { leadSourceLabel } from "@/lib/lead-sources";
import { formatDateTime } from "@/lib/utils";

/**
 * Quotes a value for CSV. A leading apostrophe defuses anything a spreadsheet would
 * otherwise run as a formula, since these fields were typed by members of the public.
 */
function cell(value: string | number | null | undefined): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  if (!(await getSession())) return new Response("Not signed in", { status: 401 });
  const params = request.nextUrl.searchParams;
  const rawStatus = params.get("status") ?? "";
  const rawKind = params.get("kind") ?? "";
  const status = (LEAD_STATUSES as readonly string[]).includes(rawStatus) ? (rawStatus as LeadStatus) : undefined;
  const kind = (LEAD_KINDS as readonly string[]).includes(rawKind) ? (rawKind as LeadKind) : undefined;
  const leads = await listLeads({ status, kind });

  const header = ["Received", "Kind", "Status", "Sent", "Name", "Phone", "Email", "Property number", "About", "Purpose", "Budget", "Timeline", "Message", "Notes", "Language", "Came through", "Page", "Visit recording"];
  const rows = leads.map((l) =>
    [formatDateTime(l.createdAt), l.kind === "sell" ? "Seller" : "Buyer", l.status, l.sent ? "Yes" : "No, number typed only", l.name, l.phone, l.email, l.ref, l.subject, l.purpose, l.budget, l.timeline, l.message, l.notes, l.locale, leadSourceLabel(l.source) || "Website form", l.source.startsWith("office:") ? "" : l.source, l.sessionId ? replayUrl(l.sessionId) : ""].map(cell).join(","),
  );
  // The byte order mark makes Excel read the file as UTF-8, which the rupee sign and Kannada need.
  const csv = `﻿${header.map(cell).join(",")}\r\n${rows.join("\r\n")}\r\n`;
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="rsp-leads-${stamp}.csv"`, "Cache-Control": "no-store" },
  });
}
