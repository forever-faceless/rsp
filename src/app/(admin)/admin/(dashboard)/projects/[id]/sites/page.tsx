import { Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BulkSitesForm } from "@/components/admin/BulkSitesForm";
import { SitesTable } from "@/components/admin/SitesTable";
import { EmptyState, PageHeader, Section } from "@/components/admin/ui";
import { bulkCreateSites, bulkSetStatus, setSiteStatus } from "@/lib/actions/sites";
import { getProjectById, listSites, listSiteSurveys, nextSiteNo } from "@/lib/db/queries";
import { formatPropertyNo } from "@/lib/refs";

export const metadata = { title: "Sites" };

export default async function SitesPage({ params }: PageProps<"/admin/projects/[id]/sites">) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();
  const project = await getProjectById(id);
  if (!project) notFound();
  const [sites, surveys, next] = await Promise.all([listSites(id), listSiteSurveys(id), nextSiteNo(id)]);
  const surveyed = [...surveys.entries()].filter(([, s]) => s.corners.length >= 3).map(([siteId]) => siteId);
  const available = sites.filter((s) => s.status === "available").length;

  return (
    <>
      <PageHeader
        title={`Sites in ${project.nameEn}`}
        refText={formatPropertyNo(project.prefix, project.propertyNo)}
        description={`${sites.length} listed, ${available} available, ${surveyed.length} plotted on the map.`}
        back={{ href: `/admin/projects/${id}`, label: project.nameEn }}
        actions={
          <Link href={`/admin/projects/${id}/sites/new`} className="btn-primary btn-sm">
            <Plus className="h-4 w-4" aria-hidden="true" /> Add a site
          </Link>
        }
      />

      <div className="space-y-6">
        {sites.length ? (
          <SitesTable projectId={id} projectNo={project.propertyNo} prefix={project.prefix} sites={sites} surveyed={surveyed} setStatusAction={setSiteStatus} bulkAction={bulkSetStatus.bind(null, id)} />
        ) : (
          <EmptyState title="No sites yet" text="Add them one at a time, or create a numbered run below when most sites share the same size." />
        )}

        <Section title="Create many sites at once" description="For a run of sites with the same size, facing and rate, such as 1 to 40 of 30 × 40.">
          <BulkSitesForm action={bulkCreateSites.bind(null, id)} from={next} />
        </Section>
      </div>
    </>
  );
}
