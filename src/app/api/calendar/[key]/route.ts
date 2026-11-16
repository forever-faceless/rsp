import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { calendarKey, getDesk } from "@/lib/leads/desk";
import { NEXT_LABEL } from "@/lib/leads/labels";
import { siteUrl } from "@/lib/site-url";
import { formatPhoneDisplay } from "@/lib/utils";

export const dynamic = "force-dynamic";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** Text as a calendar file wants it: commas, semicolons and line breaks escaped. */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");

/**
 * The follow-ups as a calendar a phone can subscribe to: every planned call and site visit,
 * with a reminder half an hour before. The address carries a long key; without it there is nothing here.
 */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/calendar/[key]">) {
  const given = Buffer.from((await params).key.replace(/\.ics$/, ""));
  const key = Buffer.from(calendarKey());
  if (given.length !== key.length || !timingSafeEqual(given, key)) return new Response("Not found", { status: 404 });

  const desk = await getDesk();
  const base = siteUrl();
  const now = new Date();
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RSP Ventures//Follow-ups//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:RSP follow-ups", "REFRESH-INTERVAL;VALUE=DURATION:PT15M", "X-PUBLISHED-TTL:PT15M"];
  for (const lead of [...desk.overdue, ...desk.today, ...desk.upcoming]) {
    const start = lead.nextAt!;
    const end = new Date(start.getTime() + (lead.nextKind === "visit" ? 60 : 15) * 60 * 1000);
    const title = `${NEXT_LABEL[lead.nextKind]}: ${lead.name || formatPhoneDisplay(lead.phone)}${lead.ref ? ` (${lead.ref})` : ""}`;
    const body = [lead.nextNote, lead.subject ?? "", formatPhoneDisplay(lead.phone), `${base}/admin/leads/${lead.id}`].filter(Boolean).join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:lead-${lead.id}@rspventures`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(title)}`,
      `DESCRIPTION:${esc(body)}`,
      `URL:${base}/admin/leads/${lead.id}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(title)}`,
      "TRIGGER:-PT30M",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n"), { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-store" } });
}
