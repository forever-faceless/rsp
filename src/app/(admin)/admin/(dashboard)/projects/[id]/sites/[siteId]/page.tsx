import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { PhotoManager } from "@/components/admin/PhotoManager";
import { SiteForm } from "@/components/admin/SiteForm";
import { SurveyPanel } from "@/components/admin/SurveyPanel";
import { ConfirmButton, PageHeader, Section, SectionNav } from "@/components/admin/ui";
import { VideoManager } from "@/components/admin/VideoManager";
import { addVideoLink, attachUploadedVideo, removeVideo } from "@/lib/actions/media";
import { deleteSite, removeSiteImage, setSiteCover, updateSite, uploadSiteImages } from "@/lib/actions/sites";
import { getProjectById, getSiteById, getSurveyFor } from "@/lib/db/queries";
import { formatSiteNo, formatSiteRef, refSlug } from "@/lib/refs";

export const metadata = { title: "Edit site" };

export default async function EditSitePage({ params, searchParams }: PageProps<"/admin/projects/[id]/sites/[siteId]">) {
  const { id: rawId, siteId: rawSiteId } = await params;
  const { created } = await searchParams;
  const id = Number(rawId);
  const siteId = Number(rawSiteId);
  if (!Number.isInteger(id) || !Number.isInteger(siteId)) notFound();
  const [project, site] = await Promise.all([getProjectById(id), getSiteById(siteId)]);
  if (!project || !site || site.projectId !== id) notFound();
  const survey = await getSurveyFor({ siteId });
  const prefix = project.prefix;
  const ref = formatSiteRef(prefix, project.propertyNo, site.siteNo);
  const owner = { kind: "site" as const, id: siteId };

  return (
    <>
      <PageHeader
        title={`Site ${formatSiteNo(site.siteNo)}`}
        refText={ref}
        description={created ? "Site created. Add a survey and photos when you are next on the layout." : project.nameEn}
        back={{ href: `/admin/projects/${id}/sites`, label: `Sites in ${project.nameEn}` }}
        actions={
          project.published ? (
            <a href={`/en/properties/${refSlug(prefix, project.propertyNo, site.siteNo)}`} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> View on the website
            </a>
          ) : null
        }
      />

      <SectionNav
        items={[
          ["#details", "Details"],
          ["#survey", "Survey"],
          ["#photos", "Photos"],
          ["#videos", "Videos"],
        ]}
      />

      <div className="space-y-6">
        <Section id="details" title="Site details">
          <SiteForm site={site} action={updateSite.bind(null, siteId)} prefix={prefix} projectNo={project.propertyNo} />
        </Section>

        <Section id="survey" title="Site survey" description="The pin that is this site's location, and its boundary. They plot the site on the layout map and draw its plan on the website.">
          <SurveyPanel survey={survey} targetKey={`site:${siteId}`} />
        </Section>

        <Section id="photos" title="Photos" description="Without photos of its own, the site shows the project's photos.">
          <PhotoManager images={site.images} uploadAction={uploadSiteImages.bind(null, siteId)} removeAction={removeSiteImage.bind(null, siteId)} coverAction={setSiteCover.bind(null, siteId)} />
        </Section>

        <Section id="videos" title="Videos">
          <VideoManager videos={site.videos} linkAction={addVideoLink.bind(null, owner)} attachAction={attachUploadedVideo.bind(null, owner)} removeAction={removeVideo.bind(null, owner)} />
        </Section>

        <Section title="Delete" description="To take a sold site off sale, mark it Sold instead. Deleting removes it from the layout altogether.">
          <ConfirmButton action={deleteSite.bind(null, siteId)} label="Delete this site" confirmLabel="Yes, delete it" size="md" />
        </Section>
      </div>
    </>
  );
}
