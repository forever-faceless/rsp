import { LeadForm } from "@/components/admin/LeadForm";
import { PageHeader, Section } from "@/components/admin/ui";
import { addLead } from "@/lib/actions/leads";
import { listSurveyTargets } from "@/lib/db/queries";
import { getDictionary } from "@/lib/i18n";
import { formatRef } from "@/lib/refs";

export const metadata = { title: "Add a lead" };

export default async function NewLeadPage() {
  const targets = await listSurveyTargets();
  const { enquiry } = getDictionary("en");
  const option = (t: (typeof targets)[number]) => ({
    value: t.key,
    label: `${formatRef(t.prefix, t.propertyNo, t.siteNo)} · ${t.siteNo != null ? `Site in ${t.label}` : t.label}`,
  });
  const subjects = [
    { label: "Properties", options: targets.filter((t) => t.key.startsWith("property:")).map(option) },
    { label: "Sites in projects", options: targets.filter((t) => t.key.startsWith("site:")).map(option) },
    { label: "Whole projects", options: targets.filter((t) => t.key.startsWith("project:")).map(option) },
  ];

  return (
    <>
      <PageHeader
        title="Add a lead"
        description="For someone who reached you outside the website: a DM, a call, a walk-in, or through the advocate. Only the number is needed; the rest can wait."
        back={{ href: "/admin/leads", label: "Leads" }}
      />
      <Section title="Lead details">
        <LeadForm action={addLead} subjects={subjects} budgets={enquiry.budgets} timelines={enquiry.timelines} />
      </Section>
    </>
  );
}
