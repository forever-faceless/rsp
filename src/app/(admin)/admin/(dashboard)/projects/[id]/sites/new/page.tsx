import { notFound } from "next/navigation";
import { SiteForm } from "@/components/admin/SiteForm";
import { PageHeader, Section } from "@/components/admin/ui";
import { createSite } from "@/lib/actions/sites";
import { getProjectById, nextSiteNo } from "@/lib/db/queries";
import { formatPropertyNo } from "@/lib/refs";

export const metadata = { title: "New site" };

export default async function NewSitePage({ params }: PageProps<"/admin/projects/[id]/sites/new">) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();
  const project = await getProjectById(id);
  if (!project) notFound();
  const next = await nextSiteNo(id);

  return (
    <>
      <PageHeader title="Add a site" refText={formatPropertyNo(project.prefix, project.propertyNo)} back={{ href: `/admin/projects/${id}/sites`, label: `Sites in ${project.nameEn}` }} />
      <Section title="Site details">
        <SiteForm action={createSite.bind(null, id)} submitLabel="Create site" prefix={project.prefix} projectNo={project.propertyNo} nextSiteNo={next} />
      </Section>
    </>
  );
}
