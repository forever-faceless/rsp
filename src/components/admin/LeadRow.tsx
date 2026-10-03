import { Mail, Phone } from "lucide-react";
import { WhatsAppIcon } from "@/components/site/PhoneLinks";
import { deleteLead, updateLeadNotes } from "@/lib/actions/leads";
import type { LeadWithRefs } from "@/lib/db/queries";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/db/schema";
import { leadSourceLabel } from "@/lib/lead-sources";
import { cn, formatDateTime, formatPhoneDisplay, telHref, whatsappHref } from "@/lib/utils";
import { ConfirmButton, SubmitButton } from "./ui";

const statusTone: Record<LeadStatus, string> = {
  new: "bg-gold-100 text-gold-800",
  contacted: "bg-navy-100 text-navy-700",
  qualified: "bg-success-100 text-success-700",
  closed: "bg-muted-100 text-muted-600",
};

const statusLabel: Record<LeadStatus, string> = { new: "New", contacted: "Contacted", qualified: "Qualified", closed: "Closed" };
const purposeLabel = { self_use: "Own use", investment: "Investment", other: "Other" } as const;

export function LeadRow({ lead, compact = false, company }: { lead: LeadWithRefs; compact?: boolean; company: string }) {
  const selling = lead.kind === "sell";
  const subject = [lead.ref, lead.subject].filter(Boolean).join(" · ");
  const hello = lead.name ? `Namaskara ${lead.name}` : "Namaskara";
  const waText = selling
    ? `${hello}, this is ${company}. Thank you for telling us about your property. When would be a good time to visit it?`
    : `${hello}, this is ${company}. Thank you for your enquiry${lead.ref ? ` about ${lead.ref}` : ""}. When would be a good time to talk?`;
  return (
    <article className="card p-4 sm:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn("text-[1.05rem] leading-snug", !lead.name && "italic text-ink-500")}>{lead.name || "No name given"}</h3>
            <span className={cn("badge", statusTone[lead.status])}>{statusLabel[lead.status]}</span>
            {!lead.sent ? (
              <span className="badge bg-danger-100 text-danger-700" data-unsent>
                Not sent
              </span>
            ) : null}
            <span className={cn("badge", selling ? "bg-navy-900 text-gold-200" : "bg-paper-200 text-ink-700")}>{selling ? "Wants to sell" : "Wants to buy"}</span>
            {lead.locale === "kn" ? <span className="badge bg-paper-200 text-ink-700">ಕನ್ನಡ</span> : null}
            <span className="num text-xs text-ink-400">{formatDateTime(lead.createdAt)}</span>
          </div>
          <p className="mt-1.5 text-[14px] text-ink-700">
            {lead.ref ? <span className="num mr-2 font-semibold text-navy-900">{lead.ref}</span> : null}
            {lead.subject ?? (subject ? "" : selling ? "Property for sale" : "General enquiry")}
            {!selling && lead.purpose ? ` · ${purposeLabel[lead.purpose]}` : ""}
            {lead.budget ? ` · ${lead.budget}` : ""}
            {lead.timeline ? ` · ${lead.timeline}` : ""}
          </p>
          {!lead.sent ? (
            <p className="mt-1 text-[12.5px] font-medium text-danger-700">They typed their number on the quick enquiry card but did not press send. Worth a call.</p>
          ) : null}
          {leadSourceLabel(lead.source) ? <p className="mt-1 text-[12.5px] text-ink-500">{leadSourceLabel(lead.source)}</p> : null}
          {lead.message ? <p className="mt-2 whitespace-pre-line rounded-[3px] bg-paper-100 px-3 py-2 text-[14px] text-ink-700">{lead.message}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={telHref(lead.phone)} className="btn-primary btn-sm">
              <Phone className="h-3.5 w-3.5" aria-hidden="true" /> <span className="num">{formatPhoneDisplay(lead.phone)}</span>
            </a>
            <a href={whatsappHref(lead.phone, waText)} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
              <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp
            </a>
            {lead.email ? (
              <a href={`mailto:${lead.email}`} className="btn-ghost btn-sm">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" /> {lead.email}
              </a>
            ) : null}
          </div>
        </div>
        {!compact ? (
          <form action={updateLeadNotes.bind(null, lead.id)} className="w-full space-y-2 md:w-80">
            <select name="status" defaultValue={lead.status} className="field !py-2 text-[14px]" aria-label="Status">
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel[s]}
                </option>
              ))}
            </select>
            <textarea name="notes" defaultValue={lead.notes} rows={2} placeholder="Follow-up notes" className="field text-[14px]" aria-label="Notes" />
            <div className="flex items-center justify-between gap-2">
              <SubmitButton className="btn-sm">Save</SubmitButton>
              <ConfirmButton action={deleteLead.bind(null, lead.id)} />
            </div>
          </form>
        ) : null}
      </div>
      {compact && lead.notes ? <p className="mt-3 text-xs text-ink-500">Notes: {lead.notes}</p> : null}
    </article>
  );
}
