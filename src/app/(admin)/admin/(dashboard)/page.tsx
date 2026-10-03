import { Building2, FolderKanban, MapPinned, MessageSquareText, Plus } from "lucide-react";
import Link from "next/link";
import { LeadRow } from "@/components/admin/LeadRow";
import { ConfirmButton, PageHeader, StatCard } from "@/components/admin/ui";
import { clearDemoContent } from "@/lib/actions/settings";
import { getDashboardStats, getSettings, listRegions } from "@/lib/db/queries";
import { formatPropertyNo } from "@/lib/refs";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const [stats, settings, regions] = await Promise.all([getDashboardStats(), getSettings(), listRegions()]);
  const missing = [!settings.phonePrimary && "phone number", !settings.addressEn && "office address", !settings.email && "email"].filter(Boolean) as string[];

  return (
    <>
      <PageHeader title="Dashboard" description={`Next property numbers: ${regions.map((r) => formatPropertyNo(r.code, r.nextNo)).join(", ")}.`} />

      {settings.demoContent ? (
        <div className="mb-6 rounded-[4px] border border-warning-600/30 bg-warning-100 p-4 sm:p-5">
          <p className="text-[15px] font-semibold text-warning-700">The website is showing demo content</p>
          <p className="mt-1 max-w-3xl text-[14px] leading-relaxed text-ink-700">
            The listings, testimonials, phone numbers and figures were put there so you can see how the site looks when it is full. None of it is real. Remove it before the site goes live. Anything you have added yourself is kept.
          </p>
          <div className="mt-3">
            <ConfirmButton action={clearDemoContent} label="Remove the demo content" confirmLabel="Yes, remove it all" icon={false} />
          </div>
        </div>
      ) : null}

      {!settings.demoContent && missing.length ? (
        <p className="mb-6 rounded-[3px] border border-navy-900/15 bg-navy-50 px-4 py-3 text-[14px] text-navy-800">
          The website has no {missing.join(", ")} yet.{" "}
          <Link href="/admin/settings" className="font-semibold underline decoration-gold-500 decoration-2 underline-offset-4">
            Add them in company settings
          </Link>
          .
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          { href: "/admin/surveys/new", label: "New survey", note: "On the site", icon: MapPinned, primary: true },
          { href: "/admin/properties/new", label: "New property", note: "Single listing", icon: Building2 },
          { href: "/admin/projects/new", label: "New project", note: "A layout", icon: FolderKanban },
          { href: "/admin/leads/new", label: "New lead", note: "From a DM or a call", icon: MessageSquareText },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={a.primary ? "flex flex-col gap-2 rounded-[4px] bg-navy-900 p-4 text-paper-50 transition-colors hover:bg-navy-800" : "card card-hover flex flex-col gap-2 p-4"}
          >
            <span className="flex items-center justify-between">
              <a.icon className={a.primary ? "h-5 w-5 text-gold-300" : "h-5 w-5 text-gold-600"} aria-hidden="true" />
              <Plus className={a.primary ? "h-4 w-4 text-navy-300" : "h-4 w-4 text-ink-400"} aria-hidden="true" />
            </span>
            <span className={a.primary ? "text-[14px] font-semibold leading-tight" : "text-[14px] font-semibold leading-tight text-navy-900"}>{a.label}</span>
            <span className={a.primary ? "hidden text-xs text-navy-300 sm:block" : "hidden text-xs text-ink-500 sm:block"}>{a.note}</span>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="New leads" value={stats.leads.new} hint={`${stats.leads.contacted} contacted, ${stats.leads.qualified} qualified`} href="/admin/leads?status=new" />
        <StatCard label="Properties" value={stats.properties} hint={`${stats.availableProperties} available, ${stats.draftProperties} draft`} href="/admin/properties" />
        <StatCard label="Sites in projects" value={stats.sites} hint={`${stats.availableSites} available in ${stats.projects} projects`} href="/admin/projects" />
        <StatCard label="Surveys" value={stats.surveys} hint={stats.looseSurveys ? `${stats.looseSurveys} not attached yet` : "All attached"} href="/admin/surveys" />
      </div>

      <div className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-[1.25rem]">Recent leads</h2>
          <Link href="/admin/leads" className="text-[13.5px] font-semibold text-navy-800 underline decoration-gold-500 decoration-2 underline-offset-4">
            View all
          </Link>
        </div>
        {stats.recentLeads.length ? (
          <div className="space-y-3">
            {stats.recentLeads.map((lead) => (
              <LeadRow key={lead.id} lead={lead} compact company={settings.companyNameEn} />
            ))}
          </div>
        ) : (
          <p className="card p-8 text-center text-[14px] text-ink-500">No leads yet. They appear here as soon as a visitor leaves a number, or when you add one.</p>
        )}
      </div>
    </>
  );
}
