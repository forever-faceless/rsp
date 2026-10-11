import { ExternalLink, Film, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { LeadFromThread } from "@/components/admin/inbox/LeadFromThread";
import { ReplyBox } from "@/components/admin/inbox/ReplyBox";
import { ConfirmButton, PageHeader, Section, SubmitButton } from "@/components/admin/ui";
import { WhatsAppIcon } from "@/components/site/PhoneLinks";
import { leadFromThread, replyInThread, resumeAutomation, saveThread, setThreadState } from "@/lib/actions/instagram";
import { listSurveyTargets } from "@/lib/db/queries";
import { IG_STATES, IG_TOPICS, type IgMessage } from "@/lib/db/schema";
import { replyWindow, STATE_LABEL, STATE_TONE, TOPIC_LABEL } from "@/lib/instagram/labels";
import { quickReplies } from "@/lib/instagram/process";
import { getIgSettings, getThread, listIgMedia, updateThread } from "@/lib/instagram/store";
import { formatRef } from "@/lib/refs";
import { cn, formatDateTime, formatPhoneDisplay, telHref, whatsappHref } from "@/lib/utils";

export const metadata = { title: "Conversation" };

const senderLabel = { them: "", auto: "Automatic reply", office: "You", app: "From the Instagram app" } as const;

function Bubble({ m, permalink, tied }: { m: IgMessage; permalink: string; tied: string }) {
  const mine = m.direction === "out";
  const shared = m.kind === "reel" || m.kind === "post";
  return (
    <li className={cn("flex", mine ? "justify-end" : "justify-start")} data-message={m.sender}>
      <div className={cn("max-w-[85%] rounded-[6px] border px-3.5 py-2.5 sm:max-w-[72%]", mine ? (m.sender === "auto" ? "border-success-600/20 bg-success-100" : "border-navy-900 bg-navy-900 text-paper-50") : "border-navy-900/12 bg-paper-0")}>
        {m.kind === "comment" ? (
          <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Comment{m.mediaTitle ? ` on "${m.mediaTitle.slice(0, 40)}"` : ""}
          </p>
        ) : null}
        {shared || m.kind === "story" || m.kind === "media" ? (
          <p className="mb-1 flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-navy-800">
            <Film className="h-3.5 w-3.5" aria-hidden="true" />
            {m.kind === "reel" ? "Shared a reel" : m.kind === "post" ? "Shared a post" : m.kind === "story" ? "Replied to a story" : "Sent an attachment"}
            {tied ? <span className="ref">{tied}</span> : shared ? <span className="font-normal text-danger-700">not tied to a property yet</span> : null}
            {permalink ? (
              <a href={permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-normal underline">
                Open <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            ) : null}
          </p>
        ) : null}
        {shared && m.mediaTitle ? <p className="mb-1 text-[12.5px] italic text-ink-500">{m.mediaTitle.slice(0, 120)}</p> : null}
        {m.text ? <p className="whitespace-pre-line break-words text-[14.5px] leading-relaxed">{m.text}</p> : null}
        {m.failed ? <p className="mt-1.5 text-[12.5px] font-semibold text-danger-700">Not sent: {m.failed}</p> : null}
        <p className={cn("mt-1.5 text-[11px]", mine && m.sender !== "auto" ? "text-navy-300" : "text-ink-400")}>
          {senderLabel[m.sender] ? `${senderLabel[m.sender]} · ` : ""}
          <span className="num">{formatDateTime(m.createdAt)}</span>
        </p>
      </div>
    </li>
  );
}

export default async function ThreadPage({ params }: PageProps<"/admin/inbox/[id]">) {
  const { id } = await params;
  const threadId = Number(id);
  const found = Number.isInteger(threadId) ? await getThread(threadId) : null;
  if (!found) notFound();
  const { thread, messages } = found;
  // Opening the conversation counts as having read it.
  if (thread.unread) await updateThread(thread.id, { unread: 0 });

  const [settings, targets, media] = await Promise.all([getIgSettings(), listSurveyTargets(), listIgMedia()]);
  const quick = await quickReplies(thread, settings);
  const reply = replyWindow(thread.lastInboundAt);
  const byMedia = new Map(media.map((m) => [m.mediaId, m]));
  // The newest reel they sent that is not tied to a property yet: tying it teaches the automation.
  const untied = [...messages].reverse().find((m) => m.direction === "in" && (m.kind === "reel" || m.kind === "post") && m.mediaId && !byMedia.get(m.mediaId)?.ref);
  const title = thread.name || (thread.username ? `@${thread.username}` : "Instagram user");
  const options = targets.map((t) => {
    const ref = formatRef(t.prefix, t.propertyNo, t.siteNo);
    return { value: ref, label: `${ref} · ${t.siteNo != null ? `Site in ${t.label}` : t.label}` };
  });

  return (
    <>
      <AutoRefresh seconds={8} />
      <PageHeader
        title={title}
        description={thread.name && thread.username ? `@${thread.username}` : undefined}
        back={{ href: "/admin/inbox", label: "Inbox" }}
        actions={
          thread.username ? (
            <a href={`https://www.instagram.com/${thread.username}/`} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> Profile
            </a>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <section className="card p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-navy-900/8 pb-4">
            <span className={cn("badge", STATE_TONE[thread.state])}>{STATE_LABEL[thread.state]}</span>
            <span className="badge bg-paper-200 text-ink-700">{TOPIC_LABEL[thread.topic]}</span>
            {thread.ref ? <span className="ref">{thread.ref}</span> : null}
            {thread.autoPaused ? <span className="text-[12.5px] text-ink-500">Automation paused here</span> : null}
          </div>
          {messages.length ? (
            <ul className="space-y-3" data-messages>
              {messages.map((m) => (
                <Bubble key={m.id} m={m} permalink={byMedia.get(m.mediaId)?.permalink ?? ""} tied={byMedia.get(m.mediaId)?.ref ?? ""} />
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-[14px] text-ink-500">No messages in this conversation yet.</p>
          )}
          <div className="mt-6 border-t border-navy-900/8 pt-5">
            <ReplyBox
              action={replyInThread.bind(null, thread.id)}
              quick={quick}
              open={reply.open}
              closedNote={
                thread.lastInboundAt
                  ? "Instagram only lets a business reply within 24 hours of their last message, and that time has passed. Call or WhatsApp them if you have their number."
                  : "They have commented but not messaged yet. Instagram allows one private reply to a comment, which has been sent; you can write here once they answer it."
              }
            />
            {reply.open && reply.until ? (
              <p className="mt-2 text-[12px] text-ink-400">
                Instagram lets you reply here until <span className="num">{formatDateTime(reply.until)}</span>.
              </p>
            ) : null}
          </div>
        </section>

        <div className="space-y-6">
          <Section title="Sort it">
            <form action={saveThread.bind(null, thread.id)} className="space-y-3">
              <label className="block text-[12.5px] font-semibold text-ink-700">
                Where it stands
                <select name="state" defaultValue={thread.state} className="field mt-1 !py-2 text-[14px]">
                  {IG_STATES.map((s) => (
                    <option key={s} value={s}>
                      {STATE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[12.5px] font-semibold text-ink-700">
                What it is about
                <select name="topic" defaultValue={thread.topic} className="field mt-1 !py-2 text-[14px]">
                  {IG_TOPICS.map((t) => (
                    <option key={t} value={t}>
                      {TOPIC_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[12.5px] font-semibold text-ink-700">
                Which property
                <select name="ref" defaultValue={thread.ref} className="field mt-1 !py-2 text-[14px]">
                  <option value="">None in particular</option>
                  {thread.ref && !options.some((o) => o.value === thread.ref) ? <option value={thread.ref}>{thread.ref}</option> : null}
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              {untied ? (
                <label className="flex items-start gap-2.5 rounded-[3px] border border-gold-500/40 bg-gold-100/50 px-3 py-2.5 text-[13.5px] text-ink-800">
                  <input type="checkbox" name="rememberReel" value={untied.id} defaultChecked className="check" />
                  <span>The reel they sent is about this property. Remember it, so the next person who sends it is answered at once.</span>
                </label>
              ) : null}
              <label className="block text-[12.5px] font-semibold text-ink-700">
                Notes
                <textarea name="notes" defaultValue={thread.notes} rows={2} maxLength={2000} className="field mt-1 text-[14px]" />
              </label>
              <SubmitButton className="btn-sm">Save</SubmitButton>
            </form>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-navy-900/8 pt-4">
              {thread.state !== "closed" ? <ConfirmButton action={setThreadState.bind(null, thread.id, "closed")} label="Close" confirmLabel="Yes, close it" icon={false} /> : null}
              {thread.state !== "spam" ? <ConfirmButton action={setThreadState.bind(null, thread.id, "spam")} label="Spam" confirmLabel="Yes, mark as spam" icon={false} /> : null}
              {thread.autoPaused ? (
                <form action={resumeAutomation.bind(null, thread.id)}>
                  <SubmitButton className="btn-sm" variant="outline">
                    Let the automation answer again
                  </SubmitButton>
                </form>
              ) : null}
            </div>
          </Section>

          <Section title="Lead" description={thread.leadId ? "Their number is on the Leads page." : "A number they send here is saved as a lead by itself."}>
            {thread.phone ? (
              <div className="flex flex-wrap gap-2">
                <a href={telHref(thread.phone)} className="btn-primary btn-sm">
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" /> <span className="num">{formatPhoneDisplay(thread.phone)}</span>
                </a>
                <a href={whatsappHref(thread.phone)} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
                  <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp
                </a>
                <Link href="/admin/leads" className="btn-ghost btn-sm">
                  Open Leads
                </Link>
              </div>
            ) : (
              <LeadFromThread action={leadFromThread.bind(null, thread.id)} name={thread.name} />
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
