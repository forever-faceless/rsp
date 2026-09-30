import { MapPinned, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { PlotPlan } from "@/components/site/PlotPlan";
import { listSurveys } from "@/lib/db/queries";
import { planFromCorners } from "@/lib/plan";
import { formatRef } from "@/lib/refs";
import { formatDateTime, formatNumber } from "@/lib/utils";

export const metadata = { title: "Field surveys" };

export default async function SurveysPage() {
  const surveys = await listSurveys();
  const loose = surveys.filter((s) => s.targetPropertyNo == null);

  return (
    <>
      <PageHeader
        title="Field surveys"
        description="Stand on the property with your phone, mark the location and walk the boundary. Finish the measurements later on a computer."
        actions={
          <Link href="/admin/surveys/new" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" /> New survey
          </Link>
        }
      />

      {loose.length ? (
        <p className="mb-5 rounded-[3px] border border-warning-600/25 bg-warning-100 px-4 py-3 text-[14px] text-warning-700">
          {loose.length === 1 ? "1 survey is" : `${loose.length} surveys are`} not attached to a listing yet. Open {loose.length === 1 ? "it" : "them"} to attach or to create a property.
        </p>
      ) : null}

      {surveys.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {surveys.map((s) => {
            const shape = planFromCorners(s.corners);
            return (
              <li key={s.id}>
                <Link href={`/admin/surveys/${s.id}`} className="card card-hover flex h-full gap-4 p-4">
                  <div className="bg-grid flex h-24 w-28 shrink-0 items-center justify-center bg-paper-100 p-2">
                    {shape ? <PlotPlan shape={shape} detail="mini" width={200} height={160} className="h-full w-full" /> : <MapPinned className="h-7 w-7 text-navy-800/30" aria-hidden="true" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    {s.targetPropertyNo != null && s.targetPrefix ? <span className="ref">{formatRef(s.targetPrefix, s.targetPropertyNo, s.targetSiteNo)}</span> : <span className="badge bg-warning-100 text-warning-700">Not attached</span>}
                    <p className="mt-2 truncate text-[15px] font-semibold text-navy-900">{s.title || s.targetLabel || "Untitled survey"}</p>
                    <p className="num mt-1 text-[12.5px] text-ink-600">
                      {s.areaSqft ? `${formatNumber(Math.round(s.areaSqft))} sq ft` : s.lat != null ? "Pin only" : "Nothing marked yet"}
                      {s.corners.length ? ` · ${s.corners.length} corners` : ""}
                      {s.photos.length ? ` · ${s.photos.length} photos` : ""}
                    </p>
                    <p className="mt-1 text-[12px] text-ink-400">{formatDateTime(s.updatedAt)}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="No surveys yet"
          text="A survey records where a property is and how its boundary runs. Start one when you are standing on the property."
          action={
            <Link href="/admin/surveys/new" className="btn-primary">
              <Plus className="h-4 w-4" aria-hidden="true" /> New survey
            </Link>
          }
        />
      )}
    </>
  );
}
