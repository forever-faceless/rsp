import { notFound } from "next/navigation";
import { SurveyLoader } from "@/components/admin/survey/SurveyLoader";
import { getProjectById, getPropertyById, getSettings, getSiteById, getSurveyById, listRegions } from "@/lib/db/queries";
import { DEFAULT_CENTRE, isValidLatLng } from "@/lib/geo";
import { formatRef } from "@/lib/refs";
import { regionOptions } from "@/lib/regions";
import { geometryOf } from "@/lib/survey";
import { surveyTargetChoices } from "@/lib/survey-targets";

export const metadata = { title: "Survey" };

export default async function SurveyPage({ params }: PageProps<"/admin/surveys/[id]">) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();
  const survey = await getSurveyById(id);
  if (!survey) notFound();
  const [settings, regions] = await Promise.all([getSettings(), listRegions()]);

  // What the survey is attached to, and where to open the map when nothing is marked yet.
  let target: { key: string; refText: string; label: string; href: string } | null = null;
  let centre = isValidLatLng(settings.officeLat, settings.officeLng) ? { lat: settings.officeLat!, lng: settings.officeLng! } : DEFAULT_CENTRE;
  const centreOn = (lat: number | null, lng: number | null) => {
    if (isValidLatLng(lat, lng)) centre = { lat: lat!, lng: lng! };
  };

  if (survey.propertyId != null) {
    const p = await getPropertyById(survey.propertyId);
    if (p) {
      target = { key: `property:${p.id}`, refText: formatRef(p.prefix, p.propertyNo), label: p.titleEn, href: `/admin/properties/${p.id}` };
      centreOn(p.lat, p.lng);
    }
  } else if (survey.siteId != null) {
    const s = await getSiteById(survey.siteId);
    const project = s ? await getProjectById(s.projectId) : null;
    if (s && project) {
      target = { key: `site:${s.id}`, refText: formatRef(project.prefix, project.propertyNo, s.siteNo), label: project.nameEn, href: `/admin/projects/${project.id}/sites/${s.id}` };
      centreOn(project.lat, project.lng);
      centreOn(s.lat, s.lng);
    }
  } else if (survey.projectId != null) {
    const project = await getProjectById(survey.projectId);
    if (project) {
      target = { key: `project:${project.id}`, refText: formatRef(project.prefix, project.propertyNo), label: `${project.nameEn} (whole layout)`, href: `/admin/projects/${project.id}` };
      centreOn(project.lat, project.lng);
    }
  }

  const targets = await surveyTargetChoices();

  return (
    <SurveyLoader
      key={`${survey.id}-${target?.key ?? "loose"}`}
      survey={{ id: survey.id, title: survey.title, notes: survey.notes, geometry: geometryOf(survey), photos: survey.photos, updatedAt: survey.updatedAt.getTime() }}
      target={target}
      targets={targets}
      regions={regionOptions(regions)}
      defaultPrefix={settings.propertyPrefix}
      centre={centre}
    />
  );
}
