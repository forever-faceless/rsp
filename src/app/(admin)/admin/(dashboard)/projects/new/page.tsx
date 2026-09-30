import { ProjectForm } from "@/components/admin/ProjectForm";
import { PageHeader, Section } from "@/components/admin/ui";
import { createProject } from "@/lib/actions/projects";
import { getSettings, listRegions } from "@/lib/db/queries";
import { regionOptions } from "@/lib/regions";

export const metadata = { title: "New project" };

export default async function NewProjectPage() {
  const [settings, regions] = await Promise.all([getSettings(), listRegions()]);
  return (
    <>
      <PageHeader title="New project" description="Save the basics first. Photos, the layout plan, landmarks and sites are added on the next screen." back={{ href: "/admin/projects", label: "Projects" }} />
      <Section title="Project details">
        <ProjectForm action={createProject} submitLabel="Create project" regions={regionOptions(regions)} defaultPrefix={settings.propertyPrefix} />
      </Section>
    </>
  );
}
