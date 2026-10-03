import { Clock, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import type { Settings } from "@/lib/db/schema";
import { localePath, pick, type Dictionary, type Locale } from "@/lib/i18n";
import { formatPhoneDisplay, telHref } from "@/lib/utils";
import { Logo } from "./Logo";
import { RefSearch } from "./RefSearch";

function Social({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-[3px] border border-paper-0/15 text-navy-200 transition-colors hover:border-gold-300 hover:text-gold-200"
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </a>
  );
}

/** Plain line drawings in the same weight as the rest of the icon set. */
const socialIcons = {
  facebook: <path d="M14.5 21v-7.5H17l.5-3h-3V8.7c0-.9.4-1.5 1.500-1.5h1.500V4.500c-.5-.1-1.300-.2-2.200-.2-2.300 0-3.800 1.400-3.800 3.900v2.300H9v3h2.500V21" />,
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17.1" cy="6.9" r="0.6" fill="currentColor" />
    </>
  ),
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="3.5" />
      <path d="M10.2 9.3v5.4l4.6-2.700Z" fill="currentColor" />
    </>
  ),
};

export function SiteFooter({ locale, dict, settings }: { locale: Locale; dict: Dictionary; settings: Settings }) {
  const year = new Date().getFullYear();
  const name = pick(settings, "companyName", locale);
  const address = pick(settings, "address", locale);
  const hours = pick(settings, "workingHours", locale);
  const phones = [settings.phonePrimary, settings.phoneSecondary].filter(Boolean);

  const explore = [
    { href: localePath(locale, "/properties"), label: dict.nav.properties },
    { href: localePath(locale, "/projects"), label: dict.nav.projects },
    { href: localePath(locale, "/sell"), label: dict.nav.sell },
    { href: localePath(locale, "/enquire"), label: dict.nav.enquire },
  ];
  const company = [
    { href: localePath(locale, "/about"), label: dict.nav.about },
    { href: localePath(locale, "/contact"), label: dict.nav.contact },
    { href: localePath(locale, "/privacy"), label: dict.footer.privacy },
    { href: "/admin", label: dict.nav.admin },
  ];

  return (
    <footer className="surface-navy bg-grid-dark relative mt-auto">
      <div className="h-[3px] w-full bg-gold-500" aria-hidden="true" />
      <div className="container-x grid gap-12 py-14 lg:grid-cols-[1.25fr_0.7fr_0.7fr_1.15fr] lg:gap-10 lg:py-16">
        <div>
          <Logo href={localePath(locale)} tone="dark" tagline={pick(settings, "tagline", locale) || undefined} />
          <p className="mt-5 max-w-sm text-[14.5px] leading-relaxed text-navy-200">{dict.footer.about}</p>
          <RefSearch
            locale={locale}
            labels={{ ...dict.search, placeholder: `${settings.propertyPrefix}-0001` }}
            variant="panel"
            tone="dark"
            className="mt-7 max-w-sm"
          />
        </div>

        <nav aria-label={dict.footer.explore}>
          <p className="label-mono !text-gold-300">{dict.footer.explore}</p>
          <ul className="mt-4 space-y-2.5 text-[14.5px]">
            {explore.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-navy-200 transition-colors hover:text-gold-200">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={dict.footer.company}>
          <p className="label-mono !text-gold-300">{dict.footer.company}</p>
          <ul className="mt-4 space-y-2.5 text-[14.5px]">
            {company.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-navy-200 transition-colors hover:text-gold-200">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="label-mono !text-gold-300">{dict.footer.contactTitle}</p>
          <ul className="mt-4 space-y-3.5 text-[14.5px] text-navy-200">
            {phones.length ? (
              <li className="flex gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" aria-hidden="true" />
                <span className="flex flex-col gap-1">
                  {phones.map((p) => (
                    <a key={p} href={telHref(p)} className="num text-paper-50 hover:text-gold-200">
                      {formatPhoneDisplay(p)}
                    </a>
                  ))}
                </span>
              </li>
            ) : null}
            {settings.email ? (
              <li className="flex gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" aria-hidden="true" />
                <a href={`mailto:${settings.email}`} className="break-all hover:text-gold-200">
                  {settings.email}
                </a>
              </li>
            ) : null}
            {address ? (
              <li className="flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" aria-hidden="true" />
                <span className="leading-relaxed">{address}</span>
              </li>
            ) : null}
            {hours ? (
              <li className="flex gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" aria-hidden="true" />
                <span>{hours}</span>
              </li>
            ) : null}
          </ul>
          <div className="mt-6 flex gap-2">
            <Social href={settings.facebookUrl} label="Facebook">
              {socialIcons.facebook}
            </Social>
            <Social href={settings.instagramUrl} label="Instagram">
              {socialIcons.instagram}
            </Social>
            <Social href={settings.youtubeUrl} label="YouTube">
              {socialIcons.youtube}
            </Social>
          </div>
        </div>
      </div>

      <div className="border-t border-paper-0/10">
        <div className="container-x space-y-3 py-6 text-[12.5px] leading-relaxed text-navy-300">
          <p className="max-w-4xl">{dict.footer.disclaimer}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {year} {name}. {dict.footer.rights}
              {settings.regNumber ? (
                <span className="num">
                  {" "}
                  · {dict.common.regNo} {settings.regNumber}
                </span>
              ) : null}
              {settings.gstin ? (
                <span className="num">
                  {" "}
                  · {dict.common.gstin} {settings.gstin}
                </span>
              ) : null}
            </p>
            <p className="text-navy-400">{dict.footer.mapCredit}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
