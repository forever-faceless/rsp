import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "@/app/globals.css";
import { MotionScript } from "@/components/motion/MotionScript";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { StickyBar } from "@/components/site/StickyBar";
import { getSettings } from "@/lib/db/queries";
import { fontClassNames } from "@/lib/fonts";
import { fill, getDictionary, isLocale, locales, pick, type Locale } from "@/lib/i18n";
import { siteUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#0d1a2d",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  const settings = await getSettings();
  const name = pick(settings, "companyName", locale) || dict.meta.siteName;
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: `${name} · ${pick(settings, "tagline", locale) || dict.home.heroEyebrow}`, template: `%s · ${name}` },
    description: dict.meta.description,
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])),
    },
    openGraph: {
      type: "website",
      siteName: name,
      locale: locale === "kn" ? "kn_IN" : "en_IN",
      images: [{ url: "/brand/og.png", width: 1200, height: 630 }],
    },
  };
}

export default async function SiteLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);
  const settings = await getSettings();

  return (
    <html lang={locale} className={cn(fontClassNames, "h-full antialiased")} suppressHydrationWarning>
      <head>
        <MotionScript />
      </head>
      <body className="has-sticky-bar flex min-h-full flex-col">
        <SiteHeader locale={locale} dict={dict} settings={settings} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter locale={locale} dict={dict} settings={settings} />
        <StickyBar
          locale={locale}
          phone={settings.phonePrimary}
          whatsapp={settings.whatsapp || settings.phonePrimary}
          labels={dict.stickyBar}
          whatsappText={fill(dict.enquiry.whatsappPrefill, { subject: pick(settings, "companyName", locale) })}
        />
      </body>
    </html>
  );
}
