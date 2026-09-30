import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/motion/Reveal";
import { PageIntro } from "@/components/site/PageIntro";
import { CallButton, WhatsAppButton } from "@/components/site/PhoneLinks";
import { SellForm } from "@/components/site/SellForm";
import { getSettings } from "@/lib/db/queries";
import { getDictionary, isLocale, localePath } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[locale]/sell">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return { title: dict.sell.title, description: dict.sell.subtitle, alternates: { canonical: `/${locale}/sell` } };
}

export default async function SellPage({ params }: PageProps<"/[locale]/sell">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const settings = await getSettings();
  const wa = settings.whatsapp || settings.phonePrimary;

  return (
    <>
      <PageIntro crumbs={[{ href: localePath(locale), label: dict.nav.home }, { label: dict.nav.sell }]} eyebrow={dict.nav.sell} title={dict.sell.title} subtitle={dict.sell.subtitle} />

      <section className="container-x grid gap-12 py-12 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div>
          <Reveal>
            <h2 className="display-3">{dict.sell.stepsTitle}</h2>
          </Reveal>
          <Reveal as="ol" mode="children" stagger={0.1} className="mt-6 border-t border-navy-900/12">
            {dict.sell.steps.map((step, i) => (
              <li key={step.title} className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-b border-navy-900/12 py-6">
                <span className="num pt-0.5 text-[13px] font-medium text-gold-700">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="text-[1.15rem] leading-snug">{step.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{step.text}</p>
                </div>
              </li>
            ))}
          </Reveal>
          <Reveal className="mt-8 flex flex-col gap-3 sm:flex-row">
            <CallButton phone={settings.phonePrimary} variant="primary" />
            <WhatsAppButton phone={wa} label={dict.common.whatsapp} variant="outline" />
          </Reveal>
        </div>

        <Reveal className="card p-6 sm:p-9 lg:self-start">
          <h2 className="display-3">{dict.sell.formTitle}</h2>
          <div className="mt-6">
            <SellForm locale={locale} t={dict.sell} e={dict.enquiry} types={dict.types} source={localePath(locale, "/sell")} />
          </div>
        </Reveal>
      </section>
    </>
  );
}
