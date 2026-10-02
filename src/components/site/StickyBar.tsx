"use client";

import { MessageSquareText, Phone } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { localePath } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { telHref, whatsappHref } from "@/lib/utils";
import { WhatsAppIcon } from "./PhoneLinks";

type Props = {
  locale: Locale;
  phone: string;
  whatsapp: string;
  whatsappText: string;
  labels: { call: string; whatsapp: string; enquire: string };
};

/** Call, WhatsApp and Enquire, always within thumb reach on a phone. */
export function StickyBar({ locale, phone, whatsapp, whatsappText, labels }: Props) {
  const pathname = usePathname();
  // On a listing, Enquire opens that listing's quick enquiry; the card itself needs no bar beneath it.
  const listing = /^\/(en|kn)\/properties\/[^/]+$/.test(pathname) ? pathname : null;
  if (pathname.endsWith("/interest")) return null;
  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-navy-900/15 bg-paper-0 pb-[env(safe-area-inset-bottom)] md:hidden">
      {phone ? (
        <a href={telHref(phone)} className="flex min-h-[60px] flex-col items-center justify-center gap-1 text-[12px] font-semibold text-navy-900 active:bg-navy-50">
          <Phone className="h-[18px] w-[18px]" aria-hidden="true" />
          {labels.call}
        </a>
      ) : (
        <span />
      )}
      {whatsapp ? (
        <a
          href={whatsappHref(whatsapp, whatsappText)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[60px] flex-col items-center justify-center gap-1 border-x border-navy-900/10 text-[12px] font-semibold text-success-700 active:bg-success-100"
        >
          <WhatsAppIcon className="h-[18px] w-[18px]" />
          {labels.whatsapp}
        </a>
      ) : (
        <span className="border-x border-navy-900/10" />
      )}
      <Link href={listing ? `${listing}/interest` : localePath(locale, "/enquire")} className="flex min-h-[60px] flex-col items-center justify-center gap-1 bg-navy-900 text-[12px] font-semibold text-gold-200 active:bg-navy-800">
        <MessageSquareText className="h-[18px] w-[18px]" aria-hidden="true" />
        {labels.enquire}
      </Link>
    </div>
  );
}
