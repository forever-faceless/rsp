import { notFound } from "next/navigation";
import { TeamForm } from "@/components/admin/PersonForms";
import { ConfirmButton, PageHeader, Section } from "@/components/admin/ui";
import { deleteTeamMember, saveTeamMember } from "@/lib/actions/team";
import { getTeamMember } from "@/lib/db/queries";

export const metadata = { title: "Edit team member" };

export default async function EditTeamMemberPage({ params }: PageProps<"/admin/team/[id]">) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();
  const item = await getTeamMember(id);
  if (!item) notFound();
  return (
    <>
      <PageHeader title={item.nameEn} back={{ href: "/admin/team", label: "Team" }} />
      <div className="space-y-6">
        <Section title="Details">
          <TeamForm item={item} action={saveTeamMember.bind(null, id)} />
        </Section>
        <Section title="Delete">
          <ConfirmButton action={deleteTeamMember.bind(null, id)} label="Remove from the team" confirmLabel="Yes, remove" size="md" />
        </Section>
      </div>
    </>
  );
}
