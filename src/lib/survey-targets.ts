import "server-only";
import type { SurveyTargetChoice } from "@/components/admin/survey/SurveyTool";
import { listSurveyTargets } from "@/lib/db/queries";
import { formatRef } from "@/lib/refs";

/** Every listing a survey can be attached to, labelled with its property number. */
export async function surveyTargetChoices(): Promise<SurveyTargetChoice[]> {
  const targets = await listSurveyTargets();
  return targets.map((t) => ({
    key: t.key,
    label: t.label,
    refText: formatRef(t.prefix, t.propertyNo, t.siteNo),
    group: t.key.startsWith("property:") ? "Properties" : t.key.startsWith("project:") ? "Projects" : "Sites",
  }));
}
