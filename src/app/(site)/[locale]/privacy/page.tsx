import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/site/PageIntro";
import { getSettings } from "@/lib/db/queries";
import { fill, getDictionary, isLocale, localePath } from "@/lib/i18n";
import { formatPhoneDisplay } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return { title: dict.privacy.title, description: dict.privacy.subtitle, alternates: { canonical: `/${locale}/privacy` } };
}

/** What the website keeps and why, in plain words: the enquiry forms, and the analytics. */
export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const settings = await getSettings();
  const values = { email: settings.email, phone: formatPhoneDisplay(settings.phonePrimary) };

  return (
    <>
      <PageIntro crumbs={[{ href: localePath(locale), label: dict.nav.home }, { label: dict.privacy.title }]} title={dict.privacy.title} subtitle={dict.privacy.subtitle} />
      <section className="container-x py-12 sm:py-16">
        <div className="max-w-3xl space-y-10">
          {dict.privacy.sections.map((s) => (
            <div key={s.title}>
              <h2 className="text-[1.35rem] leading-snug">{s.title}</h2>
              <p className="mt-3 text-[15.5px] leading-relaxed text-ink-700">{fill(s.text, values)}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
