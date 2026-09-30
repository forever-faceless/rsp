import { TestimonialForm } from "@/components/admin/PersonForms";
import { PageHeader, Section } from "@/components/admin/ui";
import { saveTestimonial } from "@/lib/actions/testimonials";

export const metadata = { title: "New testimonial" };

export default function NewTestimonialPage() {
  return (
    <>
      <PageHeader title="New testimonial" back={{ href: "/admin/testimonials", label: "Testimonials" }} />
      <Section title="Testimonial">
        <TestimonialForm action={saveTestimonial.bind(null, null)} submitLabel="Add testimonial" />
      </Section>
    </>
  );
}
