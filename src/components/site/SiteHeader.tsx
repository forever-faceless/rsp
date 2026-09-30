import type { Settings } from "@/lib/db/schema";
import { fill, localePath, pick, type Dictionary, type Locale } from "@/lib/i18n";
import { LocaleSwitch } from "./LocaleSwitch";
import { Logo } from "./Logo";
import { MobileNav } from "./MobileNav";
import { NavLinks, type NavItem } from "./NavLinks";
import { CallButton } from "./PhoneLinks";
import { RefSearch } from "./RefSearch";

export function buildNav(locale: Locale, dict: Dictionary): NavItem[] {
  return [
    { href: localePath(locale, "/properties"), label: dict.nav.properties },
    { href: localePath(locale, "/projects"), label: dict.nav.projects },
    { href: localePath(locale, "/sell"), label: dict.nav.sell },
    { href: localePath(locale, "/about"), label: dict.nav.about },
    { href: localePath(locale, "/contact"), label: dict.nav.contact },
  ];
}

export function SiteHeader({ locale, dict, settings }: { locale: Locale; dict: Dictionary; settings: Settings }) {
  const nav = buildNav(locale, dict);
  const search = { ...dict.search, hint: dict.search.byNumberHint, placeholder: `${settings.propertyPrefix}-0001` };
  const whatsappText = fill(dict.enquiry.whatsappPrefill, { subject: pick(settings, "companyName", locale) });

  return (
    <header className="sticky top-0 z-50 border-b border-navy-900/10 bg-paper-50/92 backdrop-blur-md">
      <a href="#main" className="btn-primary btn-sm sr-only left-3 top-3 z-[90] focus:not-sr-only focus:absolute">
        {dict.nav.skip}
      </a>
      <div className="container-x flex h-[var(--header-h)] items-center justify-between gap-4">
        {/* The roof fills the top of the logo, so the lettering sits below its middle. Lifting it by that much puts "RSP VENTURES" on the same line as the menu. */}
        <Logo href={localePath(locale)} tagline={pick(settings, "tagline", locale) || undefined} className="-translate-y-[13%]" />

        <nav className="hidden items-center lg:flex" aria-label="Primary">
          <NavLinks items={nav} />
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {/* Kannada labels run longer, so the number search waits for a wider screen there. */}
          <RefSearch locale={locale} labels={search} className={locale === "kn" ? "hidden 2xl:block" : "hidden xl:block"} />
          <LocaleSwitch locale={locale} label={dict.nav.switchTo} />
          <CallButton phone={settings.phonePrimary} variant="primary" size="sm" />
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <LocaleSwitch locale={locale} label={dict.nav.switchTo} />
          <MobileNav
            locale={locale}
            items={[{ href: localePath(locale), label: dict.nav.home }, ...nav, { href: localePath(locale, "/enquire"), label: dict.nav.enquire }]}
            phone={settings.phonePrimary}
            whatsapp={settings.whatsapp || settings.phonePrimary}
            whatsappText={whatsappText}
            labels={{ menu: dict.nav.menu, close: dict.nav.close, call: dict.nav.callUs, whatsapp: dict.common.whatsapp }}
            search={search}
          />
        </div>
      </div>
    </header>
  );
}
