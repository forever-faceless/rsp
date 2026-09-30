import { notFound } from "next/navigation";
import { TestimonialForm } from "@/components/admin/PersonForms";
import { ConfirmButton, PageHeader, Section } from "@/components/admin/ui";
import { deleteTestimonial, saveTestimonial } from "@/lib/actions/testimonials";
import { getTestimonial } from "@/lib/db/queries";

export const metadata = { title: "Edit testimonial" };

export default async function EditTestimonialPage({ params }: PageProps<"/admin/testimonials/[id]">) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();
  const item = await getTestimonial(id);
  if (!item) notFound();
  return (
    <>
      <PageHeader title={item.nameEn} back={{ href: "/admin/testimonials", label: "Testimonials" }} />
      <div className="space-y-6">
        <Section title="Testimonial">
          <TestimonialForm item={item} action={saveTestimonial.bind(null, id)} />
        </Section>
        <Section title="Delete">
          <ConfirmButton action={deleteTestimonial.bind(null, id)} label="Delete this testimonial" confirmLabel="Yes, delete it" size="md" />
        </Section>
      </div>
    </>
  );
}
