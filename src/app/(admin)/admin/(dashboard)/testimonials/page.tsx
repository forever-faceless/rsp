import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { listTestimonials } from "@/lib/db/queries";

export const metadata = { title: "Testimonials" };

export default async function TestimonialsPage() {
  const items = await listTestimonials(false);
  return (
    <>
      <PageHeader
        title="Testimonials"
        description="What clients have said, shown on the home page. Only publish words a client actually gave you, with their permission."
        actions={
          <Link href="/admin/testimonials/new" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" /> New testimonial
          </Link>
        }
      />
      {items.length ? (
        <ul className="space-y-3">
          {items.map((t) => (
            <li key={t.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-navy-900">
                  {t.nameEn}
                  {t.published ? null : <span className="badge ml-2 bg-paper-200 text-ink-700">Hidden</span>}
                  {t.isDemo ? <span className="badge ml-2 bg-warning-100 text-warning-700">Demo</span> : null}
                </p>
                {t.locationEn ? <p className="text-[13px] text-ink-500">{t.locationEn}</p> : null}
                <p className="mt-1.5 line-clamp-2 text-[14px] text-ink-700">{t.quoteEn}</p>
              </div>
              <Link href={`/admin/testimonials/${t.id}`} className="btn-outline btn-sm self-start sm:self-auto">
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No testimonials yet" text="The section stays off the home page until there is at least one." />
      )}
    </>
  );
}
