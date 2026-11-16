import { Download, Plus, Search } from "lucide-react";
import Link from "next/link";
import { LeadRow } from "@/components/admin/LeadRow";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { countLeadsByStatus, getSettings, listLeads } from "@/lib/db/queries";
import { LEAD_KINDS, LEAD_STATUSES, OPEN_LEAD_STATUSES, type LeadKind, type LeadStatus } from "@/lib/db/schema";
import { stageLabel } from "@/lib/leads/labels";
import { cn } from "@/lib/utils";

export const metadata = { title: "Leads" };

const kindLabel: Record<LeadKind, string> = { buy: "Buyers", sell: "Sellers" };
/** Lists that cut across the stages: what is still alive, and what has nothing planned. */
const VIEWS = ["open", "unplanned"] as const;
type View = (typeof VIEWS)[number];
const viewLabel: Record<View, string> = { open: "Open", unplanned: "Nothing planned" };

export default async function LeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  const query = await searchParams;
  const one = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : "");
  const status = (LEAD_STATUSES as readonly string[]).includes(one("status")) ? (one("status") as LeadStatus) : undefined;
  const kind = (LEAD_KINDS as readonly string[]).includes(one("kind")) ? (one("kind") as LeadKind) : undefined;
  const view = (VIEWS as readonly string[]).includes(one("view")) ? (one("view") as View) : undefined;
  const q = one("q").trim().slice(0, 60);
  const [settings, all, counts] = await Promise.all([getSettings(), listLeads({ status, kind }), countLeadsByStatus()]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const openCount = OPEN_LEAD_STATUSES.reduce((n, s) => n + counts[s], 0);

  const digits = q.replace(/\D/g, "");
  const needle = q.toLowerCase();
  const isOpen = (s: LeadStatus) => (OPEN_LEAD_STATUSES as readonly string[]).includes(s);
  const leads = all
    .filter((l) => (view === "open" ? isOpen(l.status) : view === "unplanned" ? isOpen(l.status) && !l.nextAt : true))
    .filter((l) => !q || [l.name, l.ref, l.subject ?? "", l.notes, l.message].some((v) => v.toLowerCase().includes(needle)) || (digits.length >= 3 && l.phone.includes(digits)));

  const href = (next: { status?: string; kind?: string; view?: string }) => {
    const p = new URLSearchParams();
    const s = "status" in next ? next.status : "view" in next ? undefined : status;
    const v = "view" in next ? next.view : "status" in next ? undefined : view;
    const k = "kind" in next ? next.kind : kind;
    if (s) p.set("status", s);
    if (v) p.set("view", v);
    if (k) p.set("kind", k);
    if (q) p.set("q", q);
    const out = p.toString();
    return out ? `/admin/leads?${out}` : "/admin/leads";
  };
  const chip = (active: boolean) => cn("inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-[3px] border px-3 text-[13px] font-semibold transition-colors", active ? "border-navy-900 bg-navy-900 text-gold-200" : "border-navy-900/15 bg-paper-0 text-ink-700 hover:border-navy-800");
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Leads"
        description="Everyone who asked about a property or wants to sell through you. Open one to see its history and set what happens next."
        actions={
          <>
            <Link href="/admin/leads/new" className="btn-primary btn-sm">
              <Plus className="h-4 w-4" aria-hidden="true" /> Add a lead
            </Link>
            <a href={`/admin/leads/export${status || kind ? `?${new URLSearchParams({ ...(status ? { status } : {}), ...(kind ? { kind } : {}) })}` : ""}`} className="btn-outline btn-sm">
              <Download className="h-4 w-4" aria-hidden="true" /> Download as a spreadsheet
            </a>
          </>
        }
      />

      <form action="/admin/leads" className="mb-4 flex max-w-md gap-2" role="search">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        {view ? <input type="hidden" name="view" value={view} /> : null}
        {kind ? <input type="hidden" name="kind" value={kind} /> : null}
        <input type="search" name="q" defaultValue={q} placeholder="Name, number or property" className="field" aria-label="Search leads" />
        <button type="submit" className="btn-outline" aria-label="Search">
          <Search className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        <Link href={href({ status: undefined, view: undefined })} className={chip(!status && !view)}>
          All <span className="num opacity-70">{total}</span>
        </Link>
        <Link href={href({ view: "open" })} className={chip(view === "open")}>
          {viewLabel.open} <span className="num opacity-70">{openCount}</span>
        </Link>
        <Link href={href({ view: "unplanned" })} className={chip(view === "unplanned")}>
          {viewLabel.unplanned}
        </Link>
        <span className="mx-1 w-px shrink-0 bg-navy-900/15" aria-hidden="true" />
        {LEAD_STATUSES.filter((s) => counts[s] > 0 || s === status || s === "new").map((s) => (
          <Link key={s} href={href({ status: s })} className={chip(status === s)}>
            {stageLabel(s)} <span className="num opacity-70">{counts[s]}</span>
          </Link>
        ))}
        <span className="mx-1 w-px shrink-0 bg-navy-900/15" aria-hidden="true" />
        {LEAD_KINDS.map((k) => (
          <Link key={k} href={href({ kind: kind === k ? undefined : k })} className={chip(kind === k)}>
            {kindLabel[k]}
          </Link>
        ))}
      </div>

      {leads.length ? (
        <div className="space-y-2.5">
          {leads.map((lead) => (
            <LeadRow key={lead.id} lead={lead} company={settings.companyNameEn} now={now} />
          ))}
        </div>
      ) : (
        <EmptyState title="Nothing here" text={status || kind || view || q ? "No leads match this." : "Leads appear here as soon as a visitor leaves a number on the website, or when you add one yourself."} />
      )}
    </>
  );
}
