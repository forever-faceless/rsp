import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { countLeadsByStatus } from "@/lib/db/queries";

export default async function DashboardLayout({ children }: LayoutProps<"/admin">) {
  const session = await requireAdmin();
  const counts = await countLeadsByStatus();
  return (
    <AdminShell user={session.user} newLeads={counts.new}>
      {children}
    </AdminShell>
  );
}
