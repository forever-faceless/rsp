import { Clapperboard, Download, MapPinned, PencilRuler } from "lucide-react";
import Link from "next/link";
import { PlotPlan } from "@/components/site/PlotPlan";
import type { Survey } from "@/lib/db/schema";
import { formatCoords, formatFeet } from "@/lib/geo";
import { planFromCorners } from "@/lib/plan";
import { geometryOf, summariseSurvey, surveyCentre } from "@/lib/survey";
import { formatDateTime, formatNumber } from "@/lib/utils";

/**
 * What the register knows about where a listing is and what its boundary is, shown on its
 * edit page, with the way into the survey tool. The survey's pin is the listing's location:
 * there is nowhere else to enter one. `targetKey` is "property:12", "site:5" or "project:3".
 */
export function SurveyPanel({ survey, targetKey }: { survey: Survey | null; targetKey: string }) {
  if (!survey) {
    return (
      <div className="bg-grid flex flex-col items-start gap-4 rounded-[4px] border border-dashed border-navy-900/20 bg-paper-50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <MapPinned className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" aria-hidden="true" />
          <p className="max-w-xl text-[14px] leading-relaxed text-ink-700">
            <span className="font-semibold text-navy-900">Not surveyed yet, so it has no location.</span> The survey is where the location is set: drop the pin where the property is, then mark the boundary. Until then the website shows no map for it.
          </p>
        </div>
        <Link href={`/admin/surveys/new?target=${encodeURIComponent(targetKey)}`} className="btn-primary btn-sm shrink-0">
          <PencilRuler className="h-4 w-4" aria-hidden="true" /> Start a survey
        </Link>
      </div>
    );
  }

  const summary = summariseSurvey(survey.corners);
  const shape = planFromCorners(survey.corners);
  const at = surveyCentre(geometryOf(survey));
  return (
    <div className="grid gap-5 md:grid-cols-[260px_1fr]">
      <div className="bg-grid flex aspect-[4/3] items-center justify-center border border-navy-900/12 bg-paper-50 p-2">
        {shape ? <PlotPlan shape={shape} width={360} height={270} className="h-full w-full" /> : <MapPinned className="h-8 w-8 text-navy-800/30" aria-hidden="true" />}
      </div>
      <div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <div>
            <dt className="label-mono">Area</dt>
            <dd className="num mt-1 text-[15px] font-semibold text-navy-900">{summary.areaSqft ? `${formatNumber(Math.round(summary.areaSqft))} sq ft` : "Pin only"}</dd>
          </div>
          <div>
            <dt className="label-mono">Shape</dt>
            <dd className="num mt-1 text-[15px] font-semibold text-navy-900">{summary.dimension ? `${summary.dimension} ft` : survey.corners.length ? `${survey.corners.length} corners` : "Not drawn"}</dd>
          </div>
          <div>
            <dt className="label-mono">Perimeter</dt>
            <dd className="num mt-1 text-[15px] font-semibold text-navy-900">{summary.perimeterFt ? formatFeet(summary.perimeterFt) : ""}</dd>
          </div>
          <div className="col-span-2 sm:col-span-3">
            <dt className="label-mono">Location</dt>
            <dd className="mt-1 text-[13.5px] text-ink-600" data-location>
              {at ? (
                <>
                  <span className="num text-[15px] font-semibold text-navy-900">{formatCoords(at.lat, at.lng)}</span>
                  <span className="ml-2.5">{survey.lat != null ? `The survey pin${survey.pinLabel ? `, named ${survey.pinLabel}` : ""}.` : "The middle of the plot. No pin has been dropped yet."}</span>
                </>
              ) : (
                "No pin yet. The website shows no map until the survey has one."
              )}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-[12.5px] text-ink-500">
          Last changed {formatDateTime(survey.updatedAt)}
          {survey.measures.length ? ` · ${survey.measures.length} extra measurement${survey.measures.length === 1 ? "" : "s"}` : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/admin/surveys/${survey.id}`} className="btn-primary btn-sm">
            <PencilRuler className="h-4 w-4" aria-hidden="true" /> Open the survey
          </Link>
          <a href={`/admin/surveys/${survey.id}/export?format=kml`} className="btn-outline btn-sm">
            <Download className="h-4 w-4" aria-hidden="true" /> KML for Google Earth
          </a>
          {survey.corners.length >= 3 ? (
            <Link href={`/admin/surveys/${survey.id}/reel`} className="btn-outline btn-sm">
              <Clapperboard className="h-4 w-4" aria-hidden="true" /> Video reel
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
