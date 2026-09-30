"use client";

import { Languages } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { otherLocale, switchLocalePath } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

type Props = { locale: Locale; label: string; tone?: "light" | "dark"; className?: string };

function Inner({ locale, label, tone = "light", className }: Props) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const to = otherLocale(locale);
  const href = `${switchLocalePath(pathname, to)}${search ? `?${search}` : ""}`;
  // A plain link on purpose: a full page load in the new language, which the proxy remembers,
  // and nothing for the router to prefetch and mistake for a choice.
  return (
    <a
      href={href}
      lang={to}
      hrefLang={to}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 rounded-[3px] px-2.5 text-[13px] font-semibold transition-colors",
        tone === "dark" ? "text-navy-200 hover:text-gold-200" : "text-ink-700 hover:bg-navy-900/6 hover:text-navy-900",
        className,
      )}
    >
      <Languages className="h-4 w-4 opacity-70" aria-hidden="true" />
      {label}
    </a>
  );
}

/** Switches between English and Kannada, staying on the same page and keeping any filters. */
export function LocaleSwitch(props: Props) {
  return (
    <Suspense fallback={<span className={cn("inline-flex min-h-10 items-center px-2.5 text-[13px] font-semibold opacity-60", props.className)}>{props.label}</span>}>
      <Inner {...props} />
    </Suspense>
  );
}
