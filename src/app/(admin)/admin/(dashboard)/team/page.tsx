import { Pencil, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { listTeam } from "@/lib/db/queries";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const items = await listTeam(false);
  return (
    <>
      <PageHeader
        title="Team"
        description="The people buyers will deal with, shown on the About page. Faces and names make a company easier to trust."
        actions={
          <Link href="/admin/team/new" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" /> Add a person
          </Link>
        }
      />
      {items.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((m) => (
            <li key={m.id} className="card flex items-center gap-4 p-4">
              {m.photo ? (
                <Image src={m.photo} alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-[3px] object-cover" />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[3px] bg-navy-900 font-display text-xl font-semibold text-gold-200" aria-hidden="true">
                  {m.nameEn.trim().charAt(0)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-navy-900">{m.nameEn}</p>
                <p className="truncate text-[13px] text-ink-600">{m.roleEn}</p>
                {m.published ? null : <span className="badge mt-1 bg-paper-200 text-ink-700">Hidden</span>}
              </div>
              <Link href={`/admin/team/${m.id}`} className="btn-outline btn-sm">
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Nobody added yet" text="The team section stays off the About page until there is at least one person." />
      )}
    </>
  );
}
