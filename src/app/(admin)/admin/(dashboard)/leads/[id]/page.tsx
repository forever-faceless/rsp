import { CalendarClock, ExternalLink, Footprints, Inbox, MessageCircle, Mic, Pencil, Phone, PlayCircle, StickyNote } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CallLink, LeadDetailsForm, VoiceNote } from "@/components/admin/leads/LeadTools";
import { LogForm } from "@/components/admin/leads/LogForm";
import { ConfirmButton, Notice, PageHeader } from "@/components/admin/ui";
import { WhatsAppIcon } from "@/components/site/PhoneLinks";
import { deleteLead, logContact, updateLeadDetails } from "@/lib/actions/leads";
import { replayUrl } from "@/lib/analytics-config";
import { getSettings } from "@/lib/db/queries";
import { leadSourceLabel, leadThreadHref } from "@/lib/lead-sources";
import { getCallSheet, getLead, isOpen, listLeadEvents, type LeadEventRow } from "@/lib/leads/desk";
import { daysAgo, EVENT_LABEL, formatWhen, LOST_LABEL, NEXT_LABEL, OUTCOME_LABEL, STAGE_TONE, stageLabel, TEMPERATURE_LABEL, TEMPERATURE_TONE } from "@/lib/leads/labels";
import { cn, formatDate, formatDateTime, istInputValue, whatsappHref } from "@/lib/utils";

export const metadata = { title: "Lead" };

const eventIcon = { call: Phone, visit: Footprints, whatsapp: MessageCircle, note: StickyNote, stage: Pencil } as const;

function Entry({ e }: { e: LeadEventRow }) {
  const Icon = e.audioId ? Mic : eventIcon[e.kind];
  return (
    <li className="flex gap-3" data-event={e.kind}>
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-navy-900/12 bg-paper-0 text-navy-800">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 border-b border-navy-900/8 pb-4">
        <p className="text-[14px] font-semibold text-navy-900">
          {e.audioId ? "Spoken note" : EVENT_LABEL[e.kind]}
          {e.kind === "call" && e.direction === "in" ? " from them" : ""}
          {e.outcome ? <span className="font-normal text-ink-600"> · {OUTCOME_LABEL[e.outcome]}</span> : null}
        </p>
        {e.text ? <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-ink-700">{e.text}</p> : null}
        {e.audioId ? <audio controls preload="none" src={`/admin/leads/audio/${e.audioId}`} className="mt-2 h-10 w-full max-w-sm" /> : null}
        <p className="num mt-1 text-xs text-ink-400">
          {formatDateTime(e.at)}
          {e.by ? ` · ${e.by}` : ""}
        </p>
      </div>
    </li>
  );
}

export default async function LeadPage({ params, searchParams }: PageProps<"/admin/leads/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const lead = await getLead(id);
  if (!lead) notFound();
  const [events, sheet, settings, query] = await Promise.all([listLeadEvents(id), getCallSheet(lead), getSettings(), searchParams]);

  const now = new Date();
  const selling = lead.kind === "sell";
  const open = isOpen(lead);
  const late = open && lead.nextAt && lead.nextAt.getTime() < now.getTime();
  const byOffice = lead.source.startsWith("office:");
  const theirWords = byOffice ? "" : lead.message;
  const notes = byOffice ? [lead.message, lead.notes].filter(Boolean).join("\n") : lead.notes;
  const thread = leadThreadHref(lead.source);
  const hello = lead.name && !lead.name.startsWith("@") ? `Namaskara ${lead.name}` : "Namaskara";
  const about = sheet ? `${sheet.title}${sheet.location ? `, ${sheet.location}` : ""}` : lead.ref;
  // The first message of a fresh lead, or one that reminds someone who has gone quiet what they asked about.
  const quiet = (now.getTime() - (lead.lastContactAt ?? lead.createdAt).getTime()) / 86_400_000 >= 3;
  const waText = selling
    ? `${hello}, this is ${settings.companyNameEn}. Thank you for telling us about your property. When would be a good time to visit it?`
    : quiet && about
      ? `${hello}, this is ${settings.companyNameEn}. On ${formatDate(lead.createdAt)} you asked about ${about}${lead.ref ? ` (${lead.ref})` : ""}. ${sheet?.status === "available" || !sheet ? "It is still available." : ""} When would be a good time to talk, or would you like to see it this week?`
      : `${hello}, this is ${settings.companyNameEn}. Thank you for your enquiry${lead.ref ? ` about ${lead.ref}` : ""}. When would be a good time to talk?`;

  return (
    <>
      <PageHeader title={lead.name || "No name given"} back={{ href: "/admin/leads", label: "Leads" }} refText={lead.ref || undefined} />

      {typeof query.added === "string" ? (
        <div className="mb-5">
          <Notice tone="success">Lead added. Set what happens next below.</Notice>
        </div>
      ) : null}

      <div className="-mt-3 mb-5 flex flex-wrap items-center gap-2">
        <span className={cn("badge", STAGE_TONE[lead.status])} data-stage={lead.status}>
          {stageLabel(lead.status, lead.kind)}
        </span>
        {lead.temperature ? <span className={cn("badge", TEMPERATURE_TONE[lead.temperature])}>{TEMPERATURE_LABEL[lead.temperature]}</span> : null}
        <span className={cn("badge", selling ? "bg-navy-900 text-gold-200" : "bg-paper-200 text-ink-700")}>{selling ? "Wants to sell" : "Wants to buy"}</span>
        {lead.status === "lost" && lead.lostReason ? <span className="text-[13px] text-ink-600">{LOST_LABEL[lead.lostReason]}</span> : null}
        <span className="text-[13px] text-ink-500">
          Came in {daysAgo(lead.createdAt, now)}
          {lead.lastContactAt ? ` · last contact ${daysAgo(lead.lastContactAt, now)}` : " · not contacted yet"}
        </span>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <CallLink phone={lead.phone} className="btn-primary" />
        <a href={whatsappHref(lead.phone, waText)} target="_blank" rel="noopener noreferrer" className="btn-outline" data-whatsapp>
          <WhatsAppIcon className="h-4 w-4" /> WhatsApp
        </a>
        {thread ? (
          <Link href={thread} className="btn-ghost" data-lead-thread>
            <Inbox className="h-4 w-4" aria-hidden="true" /> Instagram conversation
          </Link>
        ) : null}
        {lead.sessionId ? (
          <a href={replayUrl(lead.sessionId)} target="_blank" rel="noopener noreferrer" className="btn-ghost" data-replay>
            <PlayCircle className="h-4 w-4" aria-hidden="true" /> Watch their visit
          </a>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-5">
          {open ? (
            <div className={cn("flex items-start gap-3 rounded-[4px] border px-4 py-3.5", late ? "border-danger-600/30 bg-danger-100" : lead.nextAt ? "border-navy-900/15 bg-navy-50" : "border-warning-600/30 bg-warning-100")} data-next>
              <CalendarClock className={cn("mt-0.5 h-5 w-5 shrink-0", late ? "text-danger-700" : "text-navy-800")} aria-hidden="true" />
              {lead.nextAt ? (
                <p className="text-[14.5px] text-ink-900">
                  <span className="font-semibold">
                    {late ? "Overdue: " : "Next: "}
                    {NEXT_LABEL[lead.nextKind]}
                  </span>{" "}
                  <span className="num">{formatWhen(lead.nextAt, now)}</span>
                  {lead.nextNote ? <span className="block text-[13.5px] text-ink-700">{lead.nextNote}</span> : null}
                </p>
              ) : (
                <p className="text-[14.5px] font-semibold text-warning-700">Nothing is planned for this lead. Set the next step below so it is not forgotten.</p>
              )}
            </div>
          ) : null}

          {sheet ? (
            <section className="card p-4 sm:p-5 lg:hidden" data-call-sheet>
              <Sheet sheet={sheet} />
            </section>
          ) : null}

          <LogForm
            action={logContact.bind(null, lead.id)}
            lead={{ kind: lead.kind, status: lead.status, temperature: lead.temperature, nextKind: lead.nextKind, nextNote: lead.nextNote, nextAt: lead.nextAt ? istInputValue(lead.nextAt) : "" }}
          />

          <section className="card p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[1.15rem] leading-snug">History</h2>
              <VoiceNote leadId={lead.id} />
            </div>
            <ol className="space-y-4" data-history>
              {events.map((e) => (
                <Entry key={e.id} e={e} />
              ))}
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold-500/40 bg-gold-100 text-gold-800">
                  <Inbox className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-navy-900">
                    Enquiry came in
                    <span className="font-normal text-ink-600"> · {leadSourceLabel(lead.source) || "Website form"}</span>
                  </p>
                  {!lead.sent ? <p className="mt-1 text-[13px] font-medium text-danger-700">They typed their number on the quick enquiry card but did not press send.</p> : null}
                  {theirWords ? (
                    <p className="mt-1.5 whitespace-pre-line rounded-[3px] bg-paper-100 px-3 py-2 text-[14px] text-ink-700" data-lead-message>
                      {theirWords}
                    </p>
                  ) : null}
                  <p className="num mt-1 text-xs text-ink-400">{formatDateTime(lead.createdAt)}</p>
                </div>
              </li>
            </ol>
          </section>
        </div>

        <aside className="space-y-5">
          {sheet ? (
            <section className="card hidden p-4 sm:p-5 lg:block" data-call-sheet>
              <Sheet sheet={sheet} />
            </section>
          ) : null}
          <section className="card p-4 sm:p-5">
            <h2 className="mb-4 text-[1.15rem] leading-snug">About them</h2>
            <LeadDetailsForm action={updateLeadDetails.bind(null, lead.id)} values={{ name: lead.name, kind: lead.kind, purpose: lead.purpose, budget: lead.budget, timeline: lead.timeline, notes }} />
            <div className="mt-5 border-t border-navy-900/8 pt-4">
              <ConfirmButton action={deleteLead.bind(null, lead.id)} label="Delete this lead" />
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

function Sheet({ sheet }: { sheet: NonNullable<Awaited<ReturnType<typeof getCallSheet>>> }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-mono">What they asked about</p>
          <h2 className="mt-1 text-[1.1rem] leading-snug">{sheet.title}</h2>
          {sheet.location ? <p className="mt-0.5 text-[13.5px] text-ink-600">{sheet.location}</p> : null}
        </div>
        {sheet.ref ? <span className="ref shrink-0">{sheet.ref}</span> : null}
      </div>
      {sheet.status !== "available" && sheet.status !== "ongoing" ? <p className="mt-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-danger-700">{sheet.status}</p> : null}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {sheet.facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">{label}</dt>
            <dd className="num mt-0.5 text-[1.05rem] font-semibold text-navy-900">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 rounded-[3px] border border-gold-500/40 bg-gold-100 px-3.5 py-3" data-office-price>
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-gold-800">Price, for the call only</p>
        {sheet.price ? (
          <p className="num mt-0.5 text-[1.15rem] font-semibold text-navy-900">{sheet.price}</p>
        ) : (
          <p className="mt-0.5 text-[13.5px] text-ink-700">
            Not saved yet.{" "}
            <Link href={sheet.editHref} className="font-semibold underline decoration-gold-500 decoration-2 underline-offset-4">
              Add it to the listing
            </Link>
          </p>
        )}
      </div>
      {sheet.landmarks.length ? (
        <ul className="mt-4 space-y-1 text-[13.5px] text-ink-700">
          {sheet.landmarks.slice(0, 6).map((l) => (
            <li key={l.id} className="flex justify-between gap-3">
              <span>{l.nameEn}</span>
              {l.driveMinutes ? <span className="num shrink-0 text-ink-500">{l.driveMinutes} min</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {sheet.documents.length ? <p className="mt-3 text-[13px] text-ink-600">Documents: {sheet.documents.join(", ")}</p> : null}
      {sheet.privateNotes ? <p className="mt-3 whitespace-pre-line rounded-[3px] bg-paper-100 px-3 py-2 text-[13px] text-ink-700">{sheet.privateNotes}</p> : null}
      <div className="mt-4 flex flex-wrap gap-3 text-[13px] font-semibold">
        <Link href={sheet.editHref} className="text-navy-800 underline decoration-gold-500 decoration-2 underline-offset-4">
          Open the listing
        </Link>
        <a href={sheet.publicHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-navy-800">
          On the website <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    </>
  );
}
