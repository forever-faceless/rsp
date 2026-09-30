import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/motion/Reveal";
import { EnquiryForm } from "@/components/site/EnquiryForm";
import { PageIntro } from "@/components/site/PageIntro";
import { CallButton, WhatsAppButton } from "@/components/site/PhoneLinks";
import { getSettings, listPublishedProjects } from "@/lib/db/queries";
import { fill, getDictionary, isLocale, localePath, pick } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[locale]/enquire">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return { title: dict.enquiry.title, description: dict.enquiry.subtitle, alternates: { canonical: `/${locale}/enquire` } };
}

export default async function EnquirePage({ params, searchParams }: PageProps<"/[locale]/enquire">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const query = await searchParams;
  const [settings, projects] = await Promise.all([getSettings(), listPublishedProjects()]);
  const name = pick(settings, "companyName", locale);
  const wa = settings.whatsapp || settings.phonePrimary;
  const wanted = Number(Array.isArray(query.project) ? query.project[0] : query.project);
  const project = projects.find((p) => p.id === wanted);

  return (
    <>
      <PageIntro crumbs={[{ href: localePath(locale), label: dict.nav.home }, { label: dict.nav.enquire }]} eyebrow={dict.nav.enquire} title={dict.enquiry.title} subtitle={dict.enquiry.subtitle}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <CallButton phone={settings.phonePrimary} variant="primary" />
          <WhatsAppButton phone={wa} label={dict.common.whatsapp} text={fill(dict.enquiry.whatsappPrefill, { subject: name })} variant="outline" />
        </div>
      </PageIntro>

      <section className="container-x py-12 sm:py-16">
        <Reveal className="card mx-auto max-w-3xl p-6 sm:p-10">
          <EnquiryForm
            locale={locale}
            t={dict.enquiry}
            whatsappLabel={dict.common.whatsapp}
            projects={projects.map((p) => ({ id: p.id, name: pick(p, "name", locale) }))}
            subject={{ label: project ? pick(project, "name", locale) : name, projectId: project?.id ?? null }}
            phone={settings.phonePrimary}
            whatsapp={wa}
            source={localePath(locale, "/enquire")}
          />
        </Reveal>
      </section>
    </>
  );
}
