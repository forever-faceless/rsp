import { CalendarClock, ChevronRight, Phone } from "lucide-react";
import Link from "next/link";
import { WhatsAppIcon } from "@/components/site/PhoneLinks";
import type { LeadWithRefs } from "@/lib/db/queries";
import { OPEN_LEAD_STATUSES } from "@/lib/db/schema";
import { leadSourceLabel } from "@/lib/lead-sources";
import { daysAgo, formatWhen, NEXT_LABEL, STAGE_TONE, stageLabel, TEMPERATURE_LABEL, TEMPERATURE_TONE } from "@/lib/leads/labels";
import { cn, formatPhoneDisplay, telHref, whatsappHref } from "@/lib/utils";

/**
 * One lead in a list: who, about what, where it stands and what is due. The whole row opens
 * the lead's own page, where its history and the after-call form are; the two buttons are
 * for calling or writing without opening it.
 */
export function LeadRow({ lead, company, now = new Date() }: { lead: LeadWithRefs; company: string; now?: Date }) {
  const selling = lead.kind === "sell";
  const open = (OPEN_LEAD_STATUSES as readonly string[]).includes(lead.status);
  const late = open && lead.nextAt && lead.nextAt.getTime() < now.getTime();
  const hello = lead.name && !lead.name.startsWith("@") ? `Namaskara ${lead.name}` : "Namaskara";
  const waText = selling
    ? `${hello}, this is ${company}. Thank you for telling us about your property. When would be a good time to visit it?`
    : `${hello}, this is ${company}. Thank you for your enquiry${lead.ref ? ` about ${lead.ref}` : ""}. When would be a good time to talk?`;
  const about = [lead.subject ?? (lead.ref ? "" : selling ? "Property for sale" : "General enquiry"), lead.budget, lead.timeline].filter(Boolean).join(" · ");
  return (
    <article className="card card-hover relative flex items-stretch gap-3 p-3.5 sm:p-4" data-lead={lead.id}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className={cn("text-[1.02rem] leading-snug", !lead.name && "italic text-ink-500")}>
            <Link href={`/admin/leads/${lead.id}`} className="after:absolute after:inset-0" data-lead-open>
              {lead.name || "No name given"}
            </Link>
          </h3>
          <span className={cn("badge", STAGE_TONE[lead.status])}>{stageLabel(lead.status, lead.kind)}</span>
          {lead.temperature ? <span className={cn("badge", TEMPERATURE_TONE[lead.temperature])}>{TEMPERATURE_LABEL[lead.temperature]}</span> : null}
          {selling ? <span className="badge bg-navy-900 text-gold-200">Wants to sell</span> : null}
          {!lead.sent ? (
            <span className="badge bg-danger-100 text-danger-700" data-unsent>
              Not sent
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-[13.5px] text-ink-700">
          {lead.ref ? <span className="num mr-2 font-semibold text-navy-900">{lead.ref}</span> : null}
          {about}
        </p>
        <p className={cn("mt-1 flex flex-wrap items-center gap-x-1.5 text-[12.5px]", late ? "font-semibold text-danger-700" : "text-ink-500")}>
          {open && lead.nextAt ? (
            <>
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {late ? "Overdue: " : ""}
              {NEXT_LABEL[lead.nextKind]} <span className="num">{formatWhen(lead.nextAt, now)}</span>
              {lead.nextNote ? <span className="font-normal text-ink-500">· {lead.nextNote}</span> : null}
            </>
          ) : (
            <>
              Came in {daysAgo(lead.createdAt, now)}
              {lead.lastContactAt ? ` · last contact ${daysAgo(lead.lastContactAt, now)}` : open ? " · not contacted yet" : ""}
              {leadSourceLabel(lead.source) ? ` · ${leadSourceLabel(lead.source)}` : ""}
            </>
          )}
        </p>
      </div>
      <div className="relative z-10 flex shrink-0 items-center gap-1.5">
        <a href={telHref(lead.phone)} className="inline-flex h-11 w-11 items-center justify-center rounded-[3px] bg-navy-900 text-paper-50 hover:bg-navy-800" aria-label={`Call ${formatPhoneDisplay(lead.phone)}`} title={formatPhoneDisplay(lead.phone)}>
          <Phone className="h-[18px] w-[18px]" aria-hidden="true" />
        </a>
        <a href={whatsappHref(lead.phone, waText)} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 w-11 items-center justify-center rounded-[3px] border border-navy-900/20 bg-paper-0 text-navy-900 hover:border-navy-800" aria-label="WhatsApp">
          <WhatsAppIcon className="h-[18px] w-[18px]" />
        </a>
        <ChevronRight className="hidden h-5 w-5 text-ink-400 sm:block" aria-hidden="true" />
      </div>
    </article>
  );
}
