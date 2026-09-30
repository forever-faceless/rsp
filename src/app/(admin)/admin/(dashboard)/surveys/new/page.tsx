import { NewSurveyForm } from "@/components/admin/survey/NewSurveyForm";
import { PageHeader, Section } from "@/components/admin/ui";
import { surveyTargetChoices } from "@/lib/survey-targets";

export const metadata = { title: "New survey" };

export default async function NewSurveyPage({ searchParams }: PageProps<"/admin/surveys/new">) {
  const { target } = await searchParams;
  const targets = await surveyTargetChoices();
  const wanted = typeof target === "string" ? target : "";
  const preselected = targets.some((t) => t.key === wanted) ? wanted : "";

  return (
    <>
      <PageHeader title="New survey" back={{ href: "/admin/surveys", label: "Field surveys" }} />
      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <Section title="Start a survey">
          <NewSurveyForm targets={targets} preselected={preselected} />
        </Section>
        <Section title="On the site">
          <ol className="space-y-4 text-[14px] leading-relaxed text-ink-700">
            {[
              ["Allow location", "The browser asks once for permission to use the phone's GPS. Wait for the accuracy to settle below about 8 m."],
              ["Mark the property", "Drop the pin where you stand, then walk to each corner and add it. For a regular site, enter its width and depth instead."],
              ["Take photos", "Add them to the survey from the phone's camera while you are still there."],
              ["Finish at your desk", "Open the same survey on a computer to enter taped lengths, add distances, export to Google Earth and make a video."],
            ].map(([title, text], i) => (
              <li key={title} className="grid grid-cols-[2rem_1fr] gap-x-2">
                <span className="num pt-0.5 text-[12px] font-medium text-gold-700">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <span className="block font-semibold text-navy-900">{title}</span>
                  {text}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-5 border-t border-navy-900/8 pt-4 text-[13px] leading-relaxed text-ink-500">
            If the signal drops, keep working. Everything is kept on the phone and sent as soon as the connection returns. If the plot cannot be walked at all, do it from your desk: tap its corners on the satellite map, or draw it in Google Earth, save it as KML or KMZ and import the file into the survey.
          </p>
        </Section>
      </div>
    </>
  );
}
