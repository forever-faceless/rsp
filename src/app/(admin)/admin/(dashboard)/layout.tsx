import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { countLeadsByStatus } from "@/lib/db/queries";
import { countThreads } from "@/lib/instagram/store";

export default async function DashboardLayout({ children }: LayoutProps<"/admin">) {
  const session = await requireAdmin();
  const [counts, inbox] = await Promise.all([countLeadsByStatus(), countThreads()]);
  return (
    <AdminShell user={session.user} newLeads={counts.new} inboxWaiting={inbox.needs_you}>
      {children}
    </AdminShell>
  );
}
