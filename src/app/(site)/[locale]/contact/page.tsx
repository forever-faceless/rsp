import { Clock, ExternalLink, Mail, MapPin, Navigation, Phone } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapLoader } from "@/components/map/MapLoader";
import { Reveal } from "@/components/motion/Reveal";
import { EnquiryForm } from "@/components/site/EnquiryForm";
import { PageIntro } from "@/components/site/PageIntro";
import { WhatsAppIcon } from "@/components/site/PhoneLinks";
import { getSettings, listPublishedProjects } from "@/lib/db/queries";
import { googleDirectionsLink, googleMapsLink, isValidLatLng } from "@/lib/geo";
import { fill, getDictionary, isLocale, localePath, pick } from "@/lib/i18n";
import { formatPhoneDisplay, telHref, whatsappHref } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return { title: dict.contact.title, description: dict.contact.subtitle, alternates: { canonical: `/${locale}/contact` } };
}

export default async function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const [settings, projects] = await Promise.all([getSettings(), listPublishedProjects()]);
  const name = pick(settings, "companyName", locale);
  const address = pick(settings, "address", locale);
  const hours = pick(settings, "workingHours", locale);
  const wa = settings.whatsapp || settings.phonePrimary;
  const office = isValidLatLng(settings.officeLat, settings.officeLng) ? { lat: settings.officeLat!, lng: settings.officeLng! } : null;
  const phones = [settings.phonePrimary, settings.phoneSecondary].filter(Boolean);

  const rows = [
    phones.length
      ? {
          icon: Phone,
          label: dict.contact.phone,
          body: (
            <span className="flex flex-col gap-1">
              {phones.map((p) => (
                <a key={p} href={telHref(p)} className="num text-[1.15rem] font-semibold text-navy-900 hover:underline">
                  {formatPhoneDisplay(p)}
                </a>
              ))}
            </span>
          ),
        }
      : null,
    wa
      ? {
          icon: WhatsAppIcon,
          label: dict.contact.whatsapp,
          body: (
            <a href={whatsappHref(wa, fill(dict.enquiry.whatsappPrefill, { subject: name }))} target="_blank" rel="noopener noreferrer" className="num text-[1.15rem] font-semibold text-navy-900 hover:underline">
              {formatPhoneDisplay(wa)}
            </a>
          ),
        }
      : null,
    settings.email
      ? {
          icon: Mail,
          label: dict.contact.email,
          body: (
            <a href={`mailto:${settings.email}`} className="break-all text-[1.05rem] font-semibold text-navy-900 hover:underline">
              {settings.email}
            </a>
          ),
        }
      : null,
    address ? { icon: MapPin, label: dict.contact.address, body: <span className="leading-relaxed text-ink-700">{address}</span> } : null,
    hours ? { icon: Clock, label: dict.contact.hours, body: <span className="text-ink-700">{hours}</span> } : null,
  ].filter((r): r is NonNullable<typeof r> => Boolean(r));

  return (
    <>
      <PageIntro crumbs={[{ href: localePath(locale), label: dict.nav.home }, { label: dict.nav.contact }]} eyebrow={dict.nav.contact} title={dict.contact.title} subtitle={dict.contact.subtitle} />

      <section className="container-x grid gap-12 py-12 sm:py-16 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <div>
          <Reveal>
            <p className="eyebrow">{dict.contact.office}</p>
          </Reveal>
          <Reveal as="ul" mode="children" stagger={0.07} className="mt-6 border-t border-navy-900/12">
            {rows.map((r) => (
              <li key={r.label} className="grid grid-cols-[1.75rem_1fr] gap-x-3 border-b border-navy-900/12 py-5">
                <r.icon className="mt-1 h-[18px] w-[18px] text-gold-600" aria-hidden="true" />
                <div>
                  <p className="label-mono">{r.label}</p>
                  <div className="mt-1.5 text-[15px]">{r.body}</div>
                </div>
              </li>
            ))}
          </Reveal>
        </div>

        <Reveal className="card p-6 sm:p-9 lg:self-start">
          <h2 className="display-3">{dict.contact.formTitle}</h2>
          <p className="mt-2 text-[15px] text-ink-600">{dict.enquiry.subtitle}</p>
          <div className="mt-6">
            <EnquiryForm
              locale={locale}
              t={dict.enquiry}
              whatsappLabel={dict.common.whatsapp}
              projects={projects.map((p) => ({ id: p.id, name: pick(p, "name", locale) }))}
              subject={{ label: name }}
              phone={settings.phonePrimary}
              whatsapp={wa}
              source={localePath(locale, "/contact")}
            />
          </div>
        </Reveal>
      </section>

      {office ? (
        <section className="container-x pb-16 sm:pb-24">
          <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="display-2">{dict.contact.mapTitle}</h2>
            <div className="flex flex-wrap gap-2">
              <a href={googleMapsLink(office.lat, office.lng)} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {dict.common.openInMaps}
              </a>
              <a href={googleDirectionsLink(office.lat, office.lng)} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm">
                <Navigation className="h-4 w-4" aria-hidden="true" />
                {dict.common.directions}
              </a>
            </div>
          </Reveal>
          <Reveal className="card mt-8 h-[380px] overflow-hidden sm:h-[460px]">
            <MapLoader pins={[{ id: "office", lat: office.lat, lng: office.lng, label: name, sub: address, kind: "main" }]} labels={{ map: dict.common.map, satellite: dict.common.satellite, interact: dict.common.useMap, close: dict.common.closeMap, expand: dict.common.fullScreen }} />
          </Reveal>
        </section>
      ) : null}
    </>
  );
}
