import { Clock, Mail, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { MapLoader } from "@/components/map/MapLoader";
import { Reveal } from "@/components/motion/Reveal";
import { CtaBand, ProcessSection } from "@/components/site/HomeSections";
import { PageIntro } from "@/components/site/PageIntro";
import { getSettings, listTeam } from "@/lib/db/queries";
import { isValidLatLng } from "@/lib/geo";
import { getDictionary, isLocale, localePath, pick } from "@/lib/i18n";
import { formatPhoneDisplay, telHref } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return { title: dict.about.title, description: dict.about.subtitle, alternates: { canonical: `/${locale}/about` } };
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const [settings, team] = await Promise.all([getSettings(), listTeam()]);
  const about = pick(settings, "about", locale) || dict.about.fallback;
  const paragraphs = about.split(/\n{2,}/).filter(Boolean);
  const office = isValidLatLng(settings.officeLat, settings.officeLng) ? { lat: settings.officeLat!, lng: settings.officeLng! } : null;
  const name = pick(settings, "companyName", locale);
  const address = pick(settings, "address", locale);
  const serviceArea = pick(settings, "serviceArea", locale);

  const company = [
    { label: dict.common.since, value: settings.establishedYear ? String(settings.establishedYear) : "" },
    { label: dict.common.regNo, value: settings.regNumber },
    { label: dict.common.gstin, value: settings.gstin },
    { label: dict.projects.location, value: serviceArea },
  ].filter((c) => c.value);

  return (
    <>
      <PageIntro crumbs={[{ href: localePath(locale), label: dict.nav.home }, { label: dict.nav.about }]} eyebrow={dict.nav.about} title={dict.about.title} subtitle={dict.about.subtitle} />

      <section className="container-x grid gap-12 py-12 sm:py-20 lg:grid-cols-[1.2fr_0.8fr] lg:gap-20">
        <Reveal>
          <p className="eyebrow">{dict.about.storyTitle}</p>
          <div className="prose-soft mt-6 text-[1.08rem] leading-[1.75] text-ink-700">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </Reveal>
        {company.length ? (
          <Reveal delay={0.1} className="card bg-grid p-6 sm:p-8 lg:self-start">
            <Image src="/brand/logo-full-sm.webp" alt={name} width={360} height={267} unoptimized className="h-auto w-48" />
            <h2 className="mt-7 text-[1.15rem]">{dict.about.companyTitle}</h2>
            <dl className="mt-4">
              {company.map((c) => (
                <div key={c.label} className="flex items-baseline justify-between gap-6 border-t border-navy-900/10 py-3">
                  <dt className="label-mono">{c.label}</dt>
                  <dd className="num text-right text-[14px] font-semibold text-navy-900">{c.value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        ) : null}
      </section>

      <section className="border-y border-navy-900/10 bg-paper-100 py-16 sm:py-24">
        <div className="container-x">
          <Reveal>
            <p className="eyebrow">{dict.about.valuesTitle}</p>
          </Reveal>
          <Reveal as="ul" mode="children" stagger={0.1} className="mt-10 grid gap-px border border-navy-900/12 bg-navy-900/12 sm:grid-cols-2">
            {dict.about.values.map((v, i) => (
              <li key={v.title} className="bg-paper-50 p-7 sm:p-9">
                <span className="num text-[13px] font-medium text-gold-700">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 text-[1.3rem] leading-snug">{v.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-600">{v.text}</p>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      {team.length ? (
        <section className="container-x py-16 sm:py-24">
          <Reveal>
            <p className="eyebrow">{dict.about.teamTitle}</p>
          </Reveal>
          <Reveal as="ul" mode="children" stagger={0.08} className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((m) => (
              <li key={m.id} className="card overflow-hidden">
                <div className="bg-grid relative aspect-[4/5] bg-paper-100">
                  {m.photo ? (
                    <Image src={m.photo} alt={pick(m, "name", locale)} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center font-display text-[4rem] font-semibold text-navy-800/20 [font-stretch:120%]" aria-hidden="true">
                      {pick(m, "name", locale).trim().charAt(0)}
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="text-[1.1rem] leading-snug">{pick(m, "name", locale)}</h3>
                  {pick(m, "role", locale) ? <p className="label-mono mt-1.5 !text-gold-700">{pick(m, "role", locale)}</p> : null}
                  {pick(m, "bio", locale) ? <p className="mt-3 text-[14px] leading-relaxed text-ink-600">{pick(m, "bio", locale)}</p> : null}
                  {m.phone ? (
                    <a href={telHref(m.phone)} className="num mt-3 inline-flex items-center gap-2 text-[13.5px] font-semibold text-navy-800 hover:underline">
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      {formatPhoneDisplay(m.phone)}
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </Reveal>
        </section>
      ) : null}

      <ProcessSection eyebrow={dict.home.processEyebrow} title={dict.home.processTitle} steps={dict.home.process} className={team.length ? "border-t border-navy-900/10" : undefined} />

      {address || office ? (
        <section className="container-x pb-16 sm:pb-24">
          <Reveal className="grid gap-px border border-navy-900/12 bg-navy-900/12 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="bg-paper-0 p-7 sm:p-9">
              <p className="eyebrow">{dict.about.officeTitle}</p>
              <ul className="mt-6 space-y-4 text-[15px] text-ink-700">
                {address ? (
                  <li className="flex gap-3">
                    <MapPin className="mt-1 h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
                    <span className="leading-relaxed">{address}</span>
                  </li>
                ) : null}
                {settings.phonePrimary ? (
                  <li className="flex gap-3">
                    <Phone className="mt-1 h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
                    <a href={telHref(settings.phonePrimary)} className="num font-semibold text-navy-900 hover:underline">
                      {formatPhoneDisplay(settings.phonePrimary)}
                    </a>
                  </li>
                ) : null}
                {settings.email ? (
                  <li className="flex gap-3">
                    <Mail className="mt-1 h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
                    <a href={`mailto:${settings.email}`} className="break-all hover:underline">
                      {settings.email}
                    </a>
                  </li>
                ) : null}
                {pick(settings, "workingHours", locale) ? (
                  <li className="flex gap-3">
                    <Clock className="mt-1 h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
                    <span>{pick(settings, "workingHours", locale)}</span>
                  </li>
                ) : null}
              </ul>
            </div>
            {office ? (
              <div className="h-[340px] bg-paper-0 lg:h-auto lg:min-h-[380px]">
                <MapLoader pins={[{ id: "office", lat: office.lat, lng: office.lng, label: name, sub: address, kind: "main" }]} labels={{ map: dict.common.map, satellite: dict.common.satellite, interact: dict.common.useMap, close: dict.common.closeMap, expand: dict.common.fullScreen }} />
              </div>
            ) : null}
          </Reveal>
        </section>
      ) : null}

      <CtaBand locale={locale} dict={dict} settings={settings} />
    </>
  );
}
