import { ExternalLink, LandPlot } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LandmarkEditor } from "@/components/admin/LandmarkEditor";
import { ProjectForm } from "@/components/admin/ProjectForm";
import { ProjectMedia } from "@/components/admin/ProjectMedia";
import { SurveyPanel } from "@/components/admin/SurveyPanel";
import { ConfirmButton, PageHeader, Section, SectionNav } from "@/components/admin/ui";
import { VideoManager } from "@/components/admin/VideoManager";
import { deleteLandmark, saveLandmark } from "@/lib/actions/landmarks";
import { addVideoLink, attachUploadedVideo, removeVideo } from "@/lib/actions/media";
import { deleteProject, removeProjectImage, setProjectCover, updateProject, uploadProjectMedia } from "@/lib/actions/projects";
import { getProjectById, getSurveyFor, listLandmarks, listSites } from "@/lib/db/queries";
import { isValidLatLng } from "@/lib/geo";
import { formatPropertyNo } from "@/lib/refs";

export const metadata = { title: "Edit project" };

export default async function EditProjectPage({ params, searchParams }: PageProps<"/admin/projects/[id]">) {
  const { id: rawId } = await params;
  const { created } = await searchParams;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();
  const project = await getProjectById(id);
  if (!project) notFound();
  const [landmarks, sites, survey] = await Promise.all([listLandmarks({ projectId: id }), listSites(id), getSurveyFor({ projectId: id })]);
  const origin = isValidLatLng(project.lat, project.lng) ? { lat: project.lat!, lng: project.lng! } : null;
  const owner = { kind: "project" as const, id };
  const ref = formatPropertyNo(project.prefix, project.propertyNo);

  return (
    <>
      <PageHeader
        title={project.nameEn}
        refText={ref}
        description={created ? "Project created. Now add photos, the layout plan, nearby landmarks and the sites." : `${sites.length} sites listed, ${landmarks.length} landmarks`}
        back={{ href: "/admin/projects", label: "Projects" }}
        actions={
          <>
            <Link href={`/admin/projects/${id}/sites`} className="btn-primary btn-sm">
              <LandPlot className="h-4 w-4" aria-hidden="true" /> Manage sites ({sites.length})
            </Link>
            {project.published ? (
              <a href={`/en/projects/${project.slug}`} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
                <ExternalLink className="h-4 w-4" aria-hidden="true" /> View on the website
              </a>
            ) : null}
          </>
        }
      />

      <SectionNav
        items={[
          ["#details", "Details"],
          ["#survey", "Boundary"],
          ["#media", "Photos and plan"],
          ["#videos", "Videos"],
          ["#landmarks", "Landmarks"],
        ]}
      />

      <div className="space-y-6">
        <Section id="details" title="Project details">
          <ProjectForm project={project} action={updateProject.bind(null, id)} />
        </Section>

        <Section id="survey" title="Layout boundary" description="The pin that is the layout's location, and its outer edge. Each site has its own survey, opened from the site's page.">
          <SurveyPanel survey={survey} targetKey={`project:${id}`} />
        </Section>

        <Section id="media" title="Photos, layout plan and brochure" description="JPG, PNG or WebP photos. They are resized and converted automatically.">
          <ProjectMedia project={project} uploadAction={uploadProjectMedia.bind(null, id)} removeAction={removeProjectImage.bind(null, id)} setCoverAction={setProjectCover.bind(null, id)} />
        </Section>

        <Section id="videos" title="Videos">
          <VideoManager videos={project.videos} linkAction={addVideoLink.bind(null, owner)} attachAction={attachUploadedVideo.bind(null, owner)} removeAction={removeVideo.bind(null, owner)} />
        </Section>

        <Section id="landmarks" title="Nearby landmarks" description="Distances are measured from the pin of the layout survey.">
          {origin || landmarks.length ? (
            <LandmarkEditor landmarks={landmarks} origin={origin} saveAction={saveLandmark.bind(null, owner)} deleteAction={deleteLandmark} />
          ) : (
            <p className="rounded-[4px] border border-dashed border-navy-900/20 bg-paper-50 p-4 text-[14px] leading-relaxed text-ink-700">
              Landmarks can be added once the layout survey has a pin.{" "}
              <a href="#survey" className="font-semibold text-navy-900 underline decoration-gold-500 decoration-2 underline-offset-4">
                Go to the survey
              </a>
            </p>
          )}
        </Section>

        <Section title="Delete" description={`Deleting a project also deletes all its sites, landmarks and photos, and retires ${ref} for good. Enquiries are kept.`}>
          <ConfirmButton action={deleteProject.bind(null, id)} label="Delete this project" confirmLabel="Yes, delete everything" size="md" />
        </Section>
      </div>
    </>
  );
}
