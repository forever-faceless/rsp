import { listPublishedProjects } from "@/lib/db/queries";
import type { Settings } from "@/lib/db/schema";
import { fill, pick, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { EnquiryForm, type EnquirySubject } from "./EnquiryForm";
import { CallButton, WhatsAppButton } from "./PhoneLinks";

type Props = {
  locale: Locale;
  dict: Dictionary;
  settings: Settings;
  subject: EnquirySubject;
  source: string;
  title?: string;
  text?: string;
  id?: string;
  className?: string;
};

/** The full-width enquiry block that closes a project or property page. */
export async function EnquiryPanel({ locale, dict, settings, subject, source, title, text, id = "enquire", className }: Props) {
  const projects = subject.ref ? [] : (await listPublishedProjects()).map((p) => ({ id: p.id, name: pick(p, "name", locale) }));
  const wa = settings.whatsapp || settings.phonePrimary;
  return (
    <section id={id} className={cn("surface-navy bg-grid-dark scroll-mt-24 border border-navy-900", className)}>
      <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14 lg:p-14">
        <div className="on-dark">
          <p className="eyebrow">{dict.nav.enquire}</p>
          <h2 className="display-2 mt-4 !text-paper-50">{title ?? dict.enquiry.title}</h2>
          <p className="mt-4 text-[1.02rem] leading-relaxed text-navy-200">{text ?? dict.enquiry.subtitle}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-start">
            <CallButton phone={settings.phonePrimary} variant="gold" />
            <WhatsAppButton phone={wa} label={dict.common.whatsapp} text={fill(dict.enquiry.whatsappPrefill, { subject: subject.label })} variant="outline-light" />
          </div>
        </div>
        <EnquiryForm
          locale={locale}
          t={dict.enquiry}
          whatsappLabel={dict.common.whatsapp}
          projects={projects}
          subject={subject}
          phone={settings.phonePrimary}
          whatsapp={wa}
          source={source}
          tone="dark"
        />
      </div>
    </section>
  );
}
