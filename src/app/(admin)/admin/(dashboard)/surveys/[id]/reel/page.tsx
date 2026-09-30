import Link from "next/link";
import { notFound } from "next/navigation";
import { ReelMaker } from "@/components/admin/survey/ReelMaker";
import { EmptyState } from "@/components/admin/ui";
import type { MediaOwner } from "@/lib/actions/media";
import { getProjectById, getPropertyById, getSettings, getSiteById, getSurveyById } from "@/lib/db/queries";
import { formatFeet } from "@/lib/geo";
import { en } from "@/lib/i18n/dictionaries/en";
import { formatRef, formatSiteNo } from "@/lib/refs";
import { measureDistance, summariseSurvey } from "@/lib/survey";
import { priceLine, publicPrice } from "@/lib/pricing";
import { formatArea, formatINRShort, formatPhoneDisplay } from "@/lib/utils";

export const metadata = { title: "Video reel" };

export default async function ReelPage({ params }: PageProps<"/admin/surveys/[id]/reel">) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();
  const survey = await getSurveyById(id);
  if (!survey) notFound();

  if (survey.corners.length < 3) {
    return (
      <div className="p-4 sm:p-6 lg:p-9">
        <EmptyState
          title="Mark the boundary first"
          text="The video closes in on the plot and draws its outline, so the survey needs at least three corners."
          action={
            <Link href={`/admin/surveys/${id}`} className="btn-primary btn-sm">
              Back to the survey
            </Link>
          }
        />
      </div>
    );
  }

  const settings = await getSettings();
  const summary = summariseSurvey(survey.corners);

  let refText = `Survey ${survey.id}`;
  let title = survey.title;
  let location = "";
  let price = "";
  let facing = "";
  let area = summary.areaSqft ? formatArea(summary.areaSqft, "sqft") : "";
  let dimension = summary.dimension ? `${summary.dimension} ft` : "";
  let owner: MediaOwner | null = null;
  let ownerHref: string | null = null;

  if (survey.propertyId != null) {
    const p = await getPropertyById(survey.propertyId);
    if (p) {
      refText = formatRef(p.prefix, p.propertyNo);
      title = p.titleEn;
      location = p.locationEn;
      const shown = publicPrice(p, p.callForPrice);
      price = p.callForPrice ? en.common.onRequest : priceLine(shown.price, shown.pricePerSqft, en.common.perSqft);
      facing = p.facing ? en.facing[p.facing] : "";
      if (p.areaSqft) area = formatArea(p.areaSqft, p.areaUnit);
      if (p.dimension) dimension = `${p.dimension} ft`;
      owner = { kind: "property", id: p.id };
      ownerHref = `/admin/properties/${p.id}#videos`;
    }
  } else if (survey.siteId != null) {
    const s = await getSiteById(survey.siteId);
    const project = s ? await getProjectById(s.projectId) : null;
    if (s && project) {
      refText = formatRef(project.prefix, project.propertyNo, s.siteNo);
      title = `Site ${formatSiteNo(s.siteNo)}, ${project.nameEn}`;
      location = project.locationEn;
      const shown = publicPrice(s, s.callForPrice || project.callForPrice);
      price = s.callForPrice || project.callForPrice ? en.common.onRequest : priceLine(shown.price, shown.pricePerSqft, en.common.perSqft);
      facing = s.facing ? en.facing[s.facing] : "";
      if (s.areaSqft) area = formatArea(s.areaSqft, "sqft");
      if (s.dimension) dimension = `${s.dimension} ft`;
      owner = { kind: "site", id: s.id };
      ownerHref = `/admin/projects/${project.id}/sites/${s.id}#videos`;
    }
  } else if (survey.projectId != null) {
    const project = await getProjectById(survey.projectId);
    if (project) {
      refText = formatRef(project.prefix, project.propertyNo);
      title = project.nameEn;
      location = project.locationEn;
      price = project.callForPrice ? en.common.onRequest : project.priceFrom ? `From ${formatINRShort(project.priceFrom)}` : "";
      dimension = project.totalSites ? `${project.totalSites} sites` : "";
      if (project.totalAreaAcres) area = `${project.totalAreaAcres} acres`;
      owner = { kind: "project", id: project.id };
      ownerHref = `/admin/projects/${project.id}#videos`;
    }
  }

  return (
    <ReelMaker
      surveyId={survey.id}
      refText={refText}
      title={title || refText}
      location={location}
      facts={[
        { label: "Area", value: area },
        { label: survey.projectId != null ? "Sites" : "Size", value: dimension },
        { label: "Facing", value: facing },
      ]}
      price={price}
      phone={settings.phonePrimary ? formatPhoneDisplay(settings.phonePrimary) : ""}
      company={settings.companyNameEn}
      tagline={settings.taglineEn}
      corners={survey.corners.map((c) => ({ lat: c.lat, lng: c.lng }))}
      sideLabels={summary.sides.map((s) => formatFeet(s.ft))}
      measures={survey.measures.map((m) => ({ a: m.a, b: m.b, label: measureDistance(m), endLabel: m.label || undefined }))}
      owner={owner}
      ownerHref={ownerHref}
    />
  );
}
