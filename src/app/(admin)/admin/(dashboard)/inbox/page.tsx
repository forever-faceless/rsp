import { Phone, Settings2 } from "lucide-react";
import Link from "next/link";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { IG_STATES, type IgState } from "@/lib/db/schema";
import { STATE_LABEL, STATE_TONE, TOPIC_LABEL } from "@/lib/instagram/labels";
import { countThreads, getIgSettings, listThreads, tokenOf } from "@/lib/instagram/store";
import { cn, formatDateTime, formatPhoneDisplay } from "@/lib/utils";

export const metadata = { title: "Inbox" };

/** Every Instagram conversation, with the ones waiting for the office first. */
export default async function InboxPage({ searchParams }: PageProps<"/admin/inbox">) {
  const query = await searchParams;
  const raw = typeof query.state === "string" ? query.state : "";
  const all = raw === "all";
  const state: IgState = (IG_STATES as readonly string[]).includes(raw) ? (raw as IgState) : "needs_you";
  const [threads, counts, settings] = await Promise.all([listThreads(all ? undefined : state), countThreads(), getIgSettings()]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const connected = Boolean(tokenOf(settings));
  const chip = (active: boolean) => cn("inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-[3px] border px-3 text-[13px] font-semibold transition-colors", active ? "border-navy-900 bg-navy-900 text-gold-200" : "border-navy-900/15 bg-paper-0 text-ink-700 hover:border-navy-800");

  return (
    <>
      <AutoRefresh seconds={10} />
      <PageHeader
        title="Inbox"
        description="Instagram messages and comments. What the automation could not answer waits under Needs you."
        actions={
          <Link href="/admin/instagram" className="btn-outline btn-sm">
            <Settings2 className="h-4 w-4" aria-hidden="true" /> Automation and reels
          </Link>
        }
      />

      {!connected ? (
        <p className="mb-5 rounded-[3px] border border-navy-900/15 bg-navy-50 px-4 py-3 text-[14px] text-navy-800">
          Instagram is not connected yet, so nothing arrives here.{" "}
          <Link href="/admin/instagram" className="font-semibold underline decoration-gold-500 decoration-2 underline-offset-4">
            See what is needed
          </Link>
          .
        </p>
      ) : !settings.dmAuto ? (
        <p className="mb-5 rounded-[3px] border border-navy-900/15 bg-navy-50 px-4 py-3 text-[14px] text-navy-800">
          Automatic replies are switched off, so every new message waits for you here.{" "}
          <Link href="/admin/instagram" className="font-semibold underline decoration-gold-500 decoration-2 underline-offset-4">
            Switch them on
          </Link>
          .
        </p>
      ) : null}

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1" data-inbox-filters>
        {IG_STATES.map((s) => (
          <Link key={s} href={s === "needs_you" ? "/admin/inbox" : `/admin/inbox?state=${s}`} className={chip(!all && state === s)}>
            {STATE_LABEL[s]} <span className="num opacity-70">{counts[s]}</span>
          </Link>
        ))}
        <Link href="/admin/inbox?state=all" className={chip(all)}>
          All <span className="num opacity-70">{total}</span>
        </Link>
      </div>

      {threads.length ? (
        <ul className="space-y-2.5">
          {threads.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/inbox/${t.id}`} className="card card-hover flex items-start gap-3.5 p-4 sm:p-5" data-thread={t.id}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-900 text-[15px] font-semibold uppercase text-gold-200" aria-hidden="true">
                  {(t.name || t.username || "?").replace(/^@/, "").slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[1.02rem] font-semibold leading-snug text-navy-900">{t.name || (t.username ? `@${t.username}` : "Instagram user")}</span>
                    {t.name && t.username ? <span className="text-[13px] text-ink-500">@{t.username}</span> : null}
                    <span className={cn("badge", STATE_TONE[t.state])}>{STATE_LABEL[t.state]}</span>
                    <span className="badge bg-paper-200 text-ink-700">{TOPIC_LABEL[t.topic]}</span>
                    {t.ref ? <span className="ref">{t.ref}</span> : null}
                    {t.unread > 0 ? <span className="num rounded-full bg-gold-400 px-1.5 py-0.5 text-[11px] font-semibold text-navy-950">{t.unread} new</span> : null}
                  </span>
                  <span className="mt-1.5 block truncate text-[14px] text-ink-700">{t.lastText || "No messages yet"}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-500">
                    <span className="num">{formatDateTime(t.lastMessageAt)}</span>
                    {t.phone ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-navy-800">
                        <Phone className="h-3.5 w-3.5" aria-hidden="true" /> <span className="num">{formatPhoneDisplay(t.phone)}</span>
                      </span>
                    ) : null}
                    {t.autoPaused ? <span>Automation paused here</span> : null}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={all ? "No conversations yet" : `Nothing under ${STATE_LABEL[state]}`}
          text={state === "needs_you" && !all ? "When someone writes something the automation cannot answer, it waits here for you." : "Conversations appear here as people message or comment on Instagram."}
        />
      )}
    </>
  );
}
