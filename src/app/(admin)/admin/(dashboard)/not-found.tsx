import Link from "next/link";
import { EmptyState } from "@/components/admin/ui";

export default function AdminNotFound() {
  return (
    <EmptyState
      title="Nothing here"
      text="This record does not exist, or it was deleted."
      action={
        <Link href="/admin" className="btn-primary btn-sm">
          Back to the dashboard
        </Link>
      }
    />
  );
}
