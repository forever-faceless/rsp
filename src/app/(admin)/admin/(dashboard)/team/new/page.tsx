import { TeamForm } from "@/components/admin/PersonForms";
import { PageHeader, Section } from "@/components/admin/ui";
import { saveTeamMember } from "@/lib/actions/team";

export const metadata = { title: "Add a person" };

export default function NewTeamMemberPage() {
  return (
    <>
      <PageHeader title="Add a person" back={{ href: "/admin/team", label: "Team" }} />
      <Section title="Details">
        <TeamForm action={saveTeamMember.bind(null, null)} submitLabel="Add to the team" />
      </Section>
    </>
  );
}
