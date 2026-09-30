import { ArrowRight, Camera, Hash, LocateFixed, Quote, Ruler, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CountUp } from "@/components/motion/CountUp";
import { Reveal } from "@/components/motion/Reveal";
import type { Settings, Testimonial } from "@/lib/db/schema";
import { fill, localePath, pick, type Dictionary, type Locale } from "@/lib/i18n";
import { cn, formatPhoneDisplay, telHref } from "@/lib/utils";
import { CallButton, WhatsAppButton } from "./PhoneLinks";
import { ProcessLine } from "./ProcessLine";
import { SectionHeading } from "./SectionHeading";

// ---------------------------------------------------------------- figures

type Figures = { sold: number; delivered: number };

/**
 * The band of figures under the headline. It is switched on in settings, and it counts from
 * the register: each figure is what was done before the website plus what the register holds
 * today, so marking a listing sold moves the number without anyone editing it.
 */
export function StatBand({ dict, settings, available, figures }: { dict: Dictionary; settings: Settings; available: number; figures: Figures }) {
  if (!settings.showStats) return null;
  const years = settings.establishedYear ? Math.max(0, new Date().getFullYear() - settings.establishedYear) : 0;
  const stats = [
    { value: available, label: dict.home.statAvailable, suffix: "" },
    { value: settings.statPropertiesSold + figures.sold, label: dict.home.statSold, suffix: "" },
    { value: settings.statProjectsDelivered + figures.delivered, label: dict.home.statProjects, suffix: "" },
    { value: settings.statClients + figures.sold, label: dict.home.statClients, suffix: "" },
    { value: years, label: dict.home.statYears, suffix: "" },
  ]
    .filter((s) => s.value > 0)
    .slice(0, 4);
  if (stats.length < 2) return null;

  return (
    <section className="surface-navy bg-grid-dark">
      <Reveal
        as="dl"
        mode="children"
        className={cn("container-x grid grid-cols-2 gap-x-6 gap-y-9 py-12 sm:py-14", stats.length === 4 ? "lg:grid-cols-4" : stats.length === 3 ? "lg:grid-cols-3" : "")}
      >
        {stats.map((s) => (
          <div key={s.label} className="border-l border-gold-400/35 pl-5">
            <dd className="font-display text-[2.4rem] font-semibold leading-none text-gold-300 [font-stretch:112%] sm:text-[3rem]">
              <CountUp value={s.value} suffix={s.suffix} className="tabular-nums" />
            </dd>
            <dt className="label-mono mt-3 !text-navy-300">{s.label}</dt>
          </div>
        ))}
      </Reveal>
    </section>
  );
}

// ---------------------------------------------------------------- how we list

const registerIcons: LucideIcon[] = [LocateFixed, Ruler, Hash, Camera];

export function RegisterSection({ dict }: { dict: Dictionary }) {
  return (
    <section className="border-y border-navy-900/10 bg-paper-100 py-16 sm:py-24">
      <div className="container-x grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <Reveal className="lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow">{dict.home.registerEyebrow}</p>
          <h2 className="display-2 mt-4">{dict.home.registerTitle}</h2>
          <p className="lede mt-5">{dict.home.registerIntro}</p>
        </Reveal>

        <Reveal as="ol" mode="children" stagger={0.1} className="border-t border-navy-900/12">
          {dict.home.register.map((item, i) => {
            const Icon = registerIcons[i] ?? Hash;
            return (
              <li key={item.title} className="grid grid-cols-[auto_1fr] gap-x-5 border-b border-navy-900/12 py-7 sm:grid-cols-[3.5rem_1fr_auto] sm:gap-x-7">
                <span className="num pt-1 text-[13px] font-medium text-gold-700">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="text-[1.25rem] leading-snug">{item.title}</h3>
                  <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-600">{item.text}</p>
                </div>
                <Icon className="hidden h-6 w-6 text-navy-800/45 sm:block" strokeWidth={1.5} aria-hidden="true" />
              </li>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- buying process

export function ProcessSection({ eyebrow, title, steps, className }: { eyebrow?: string; title: string; steps: { title: string; text: string }[]; className?: string }) {
  return (
    <section className={cn("py-16 sm:py-24", className)}>
      <div className="container-x">
        <Reveal>
          <SectionHeading eyebrow={eyebrow} title={title} />
        </Reveal>
        <ProcessLine steps={steps} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- sell band

export function SellBand({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <section className="container-x pb-16 sm:pb-24">
      <Reveal className="bg-grid relative grid gap-8 border border-navy-900/12 bg-paper-100 p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12 lg:p-14">
        <span className="absolute left-0 top-0 h-full w-[3px] bg-gold-500" aria-hidden="true" />
        <div className="max-w-2xl">
          <h2 className="display-2">{dict.home.sellTitle}</h2>
          <p className="lede mt-4">{dict.home.sellText}</p>
        </div>
        <Link href={localePath(locale, "/sell")} className="btn-primary btn-lg justify-self-start lg:justify-self-end">
          {dict.home.sellButton}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Reveal>
    </section>
  );
}

// ---------------------------------------------------------------- testimonials

export function Testimonials({ items, locale, dict }: { items: Testimonial[]; locale: Locale; dict: Dictionary }) {
  if (!items.length) return null;
  return (
    <section className="border-t border-navy-900/10 py-16 sm:py-24">
      <div className="container-x">
        <Reveal>
          <SectionHeading eyebrow={dict.home.testimonialsEyebrow} title={dict.home.testimonialsTitle} />
        </Reveal>
        <Reveal as="ul" mode="children" stagger={0.1} className="mt-12 grid gap-px border border-navy-900/10 bg-navy-900/10 md:grid-cols-3">
          {items.slice(0, 3).map((t) => (
            <li key={t.id} className="flex flex-col bg-paper-0 p-7 sm:p-8">
              <Quote className="h-6 w-6 text-gold-500" strokeWidth={1.5} aria-hidden="true" />
              <blockquote className="mt-5 flex-1 text-[1.02rem] leading-relaxed text-ink-800">{pick(t, "quote", locale)}</blockquote>
              <footer className="mt-7 flex items-center gap-3 border-t border-navy-900/8 pt-5">
                {t.photo ? (
                  <Image src={t.photo} alt="" width={44} height={44} className="h-11 w-11 rounded-full object-cover" />
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-900 font-display text-[15px] font-semibold text-gold-200" aria-hidden="true">
                    {pick(t, "name", locale).trim().charAt(0)}
                  </span>
                )}
                <span>
                  <span className="block text-[14.5px] font-semibold text-navy-900">{pick(t, "name", locale)}</span>
                  {pick(t, "location", locale) ? <span className="block text-[13px] text-ink-500">{pick(t, "location", locale)}</span> : null}
                </span>
              </footer>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- closing call to action

export function CtaBand({ locale, dict, settings, subject }: { locale: Locale; dict: Dictionary; settings: Settings; subject?: string }) {
  const wa = settings.whatsapp || settings.phonePrimary;
  const text = fill(dict.enquiry.whatsappPrefill, { subject: subject ?? pick(settings, "companyName", locale) });
  return (
    <section className="surface-navy bg-grid-dark relative overflow-hidden">
      <div className="container-x relative grid gap-10 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <Reveal className="on-dark">
          <div className="gold-rule" aria-hidden="true" />
          <h2 className="display-2 mt-6 !text-paper-50">{dict.home.ctaTitle}</h2>
          <p className="mt-4 max-w-xl text-[1.05rem] leading-relaxed text-navy-200">{dict.home.ctaText}</p>
        </Reveal>
        <Reveal delay={0.1} className="lg:justify-self-end">
          {settings.phonePrimary ? (
            <a href={telHref(settings.phonePrimary)} className="group block">
              <span className="label-mono !text-gold-300">{dict.nav.callUs}</span>
              <span className="num mt-2 block text-[1.9rem] font-medium text-paper-50 transition-colors group-hover:text-gold-200 sm:text-[2.4rem]">
                {formatPhoneDisplay(settings.phonePrimary)}
              </span>
            </a>
          ) : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href={localePath(locale, "/enquire")} className="btn-gold">
              {dict.home.ctaButton}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <WhatsAppButton phone={wa} label={dict.common.whatsapp} text={text} variant="outline-light" />
            {!settings.phonePrimary && settings.phoneSecondary ? <CallButton phone={settings.phoneSecondary} variant="outline-light" /> : null}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
