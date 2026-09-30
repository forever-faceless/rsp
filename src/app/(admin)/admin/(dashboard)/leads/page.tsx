import { Download } from "lucide-react";
import Link from "next/link";
import { LeadRow } from "@/components/admin/LeadRow";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { countLeadsByStatus, getSettings, listLeads } from "@/lib/db/queries";
import { LEAD_KINDS, LEAD_STATUSES, type LeadKind, type LeadStatus } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export const metadata = { title: "Enquiries" };

const statusLabel: Record<LeadStatus, string> = { new: "New", contacted: "Contacted", qualified: "Qualified", closed: "Closed" };
const kindLabel: Record<LeadKind, string> = { buy: "Buyers", sell: "Sellers" };

export default async function LeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  const query = await searchParams;
  const rawStatus = typeof query.status === "string" ? query.status : "";
  const rawKind = typeof query.kind === "string" ? query.kind : "";
  const status = (LEAD_STATUSES as readonly string[]).includes(rawStatus) ? (rawStatus as LeadStatus) : undefined;
  const kind = (LEAD_KINDS as readonly string[]).includes(rawKind) ? (rawKind as LeadKind) : undefined;
  const [settings, leads, counts] = await Promise.all([getSettings(), listLeads({ status, kind }), countLeadsByStatus()]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const href = (next: { status?: string; kind?: string }) => {
    const p = new URLSearchParams();
    const s = "status" in next ? next.status : status;
    const k = "kind" in next ? next.kind : kind;
    if (s) p.set("status", s);
    if (k) p.set("kind", k);
    const q = p.toString();
    return q ? `/admin/leads?${q}` : "/admin/leads";
  };
  const chip = (active: boolean) => cn("inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-[3px] border px-3 text-[13px] font-semibold transition-colors", active ? "border-navy-900 bg-navy-900 text-gold-200" : "border-navy-900/15 bg-paper-0 text-ink-700 hover:border-navy-800");

  return (
    <>
      <PageHeader
        title="Enquiries"
        description="People who asked about a property, and owners who want to sell through you."
        actions={
          <a href={`/admin/leads/export${status || kind ? `?${new URLSearchParams({ ...(status ? { status } : {}), ...(kind ? { kind } : {}) })}` : ""}`} className="btn-outline btn-sm">
            <Download className="h-4 w-4" aria-hidden="true" /> Download as a spreadsheet
          </a>
        }
      />

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        <Link href={href({ status: undefined })} className={chip(!status)}>
          All <span className="num opacity-70">{total}</span>
        </Link>
        {LEAD_STATUSES.map((s) => (
          <Link key={s} href={href({ status: s })} className={chip(status === s)}>
            {statusLabel[s]} <span className="num opacity-70">{counts[s]}</span>
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
        <div className="space-y-3">
          {leads.map((lead) => (
            <LeadRow key={lead.id} lead={lead} company={settings.companyNameEn} />
          ))}
        </div>
      ) : (
        <EmptyState title="Nothing here" text={status || kind ? "No enquiries match this filter." : "Enquiries appear here as soon as a visitor sends a form on the website."} />
      )}
    </>
  );
}
