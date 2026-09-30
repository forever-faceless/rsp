import type { PlanShape } from "@/lib/plan";
import { cornerLabel, formatFeet } from "@/lib/geo";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PlotPlan } from "./PlotPlan";

type Props = {
  dict: Dictionary;
  shape: PlanShape;
  refText: string;
  areaLabel?: string;
  perimeterFt?: number | null;
  roadLabel?: string;
  className?: string;
};

/**
 * The measured drawing of a property, with a schedule of its sides, its area and its
 * perimeter beside it.
 */
export function PlanPanel({ dict, shape, refText, areaLabel, perimeterFt, roadLabel, className }: Props) {
  const note = shape.source === "measured" ? dict.property.planNote : shape.source === "gps" ? dict.property.planGps : dict.property.planApprox;
  const n = shape.sidesFt.length;
  return (
    <div className={cn("grid gap-px border border-navy-900/12 bg-navy-900/12 lg:grid-cols-[1.35fr_0.65fr]", className)}>
      <div className="bg-grid relative bg-paper-0 p-3 sm:p-6">
        <span className="ref absolute left-4 top-4 sm:left-6 sm:top-6">{refText}</span>
        <PlotPlan shape={shape} areaLabel={areaLabel} roadLabel={roadLabel} width={620} height={440} title={`${refText} ${dict.property.plan}`} className="mx-auto h-auto w-full max-w-[640px]" />
      </div>

      <div className="flex flex-col bg-paper-0 p-5 sm:p-7">
        <table className="table-reg">
          <thead>
            <tr>
              <th className="!pl-0">{dict.property.side}</th>
              <th className="!pr-0 text-right">{dict.common.ft}</th>
            </tr>
          </thead>
          <tbody>
            {shape.sidesFt.slice(0, 12).map((ft, i) => (
              <tr key={i}>
                <td className="num !pl-0 font-medium text-navy-900">
                  {cornerLabel(i)} <span className="text-ink-300">→</span> {cornerLabel((i + 1) % n)}
                </td>
                <td className="num !pr-0 text-right font-semibold text-navy-900">{formatFeet(ft).replace(" ft", "")}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-navy-900/12 pt-5">
          {areaLabel ? (
            <div>
              <dt className="label-mono">{dict.property.surveyedArea}</dt>
              <dd className="num mt-1 text-[15px] font-semibold text-navy-900">{areaLabel}</dd>
            </div>
          ) : null}
          {perimeterFt ? (
            <div>
              <dt className="label-mono">{dict.property.perimeter}</dt>
              <dd className="num mt-1 text-[15px] font-semibold text-navy-900">{formatFeet(perimeterFt)}</dd>
            </div>
          ) : null}
        </dl>

        <p className="mt-5 text-[12.5px] leading-relaxed text-ink-500">{note}</p>
      </div>
    </div>
  );
}
