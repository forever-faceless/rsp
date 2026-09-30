import { ExternalLink, LandPlot, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { ProjectStatusBadge } from "@/components/site/StatusBadge";
import { listAllProjects } from "@/lib/db/queries";
import { en } from "@/lib/i18n/dictionaries/en";
import { formatPropertyNo } from "@/lib/refs";

export const metadata = { title: "Projects" };

export default async function ProjectsAdminPage() {
  const projects = await listAllProjects();
  return (
    <>
      <PageHeader
        title="Projects and sites"
        description="Layouts and the sites inside them. A project takes one property number, and its sites are numbered under it."
        actions={
          <Link href="/admin/projects/new" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" /> New project
          </Link>
        }
      />
      {projects.length ? (
        <ul className="space-y-3">
          {projects.map((p) => (
            <li key={p.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="ref">{formatPropertyNo(p.prefix, p.propertyNo)}</span>
                  <ProjectStatusBadge status={p.status} label={en.status.project[p.status]} />
                  {p.published ? null : <span className="badge bg-paper-200 text-ink-700">Hidden</span>}
                  {p.featured ? <span className="badge bg-gold-100 text-gold-800">Featured</span> : null}
                </div>
                <p className="mt-2 truncate text-[16px] font-semibold text-navy-900">{p.nameEn}</p>
                <p className="num mt-0.5 text-[13px] text-ink-600">
                  {[p.locationEn, `${p.siteCount} sites listed`, `${p.availableCount} available`].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/projects/${p.id}/sites`} className="btn-outline btn-sm">
                  <LandPlot className="h-4 w-4" aria-hidden="true" /> Sites
                </Link>
                {p.published ? (
                  <a href={`/en/projects/${p.slug}`} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm" aria-label="View on the website">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                ) : null}
                <Link href={`/admin/projects/${p.id}`} className="btn-primary btn-sm">
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No projects yet"
          text="Create a project for each layout, then add its sites one by one or as a numbered run."
          action={
            <Link href="/admin/projects/new" className="btn-primary btn-sm">
              <Plus className="h-4 w-4" aria-hidden="true" /> New project
            </Link>
          }
        />
      )}
    </>
  );
}
