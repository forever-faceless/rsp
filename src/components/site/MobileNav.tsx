"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gsap, prefersReducedMotion, setupGsap, useGSAP } from "@/components/motion/gsap";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import type { NavItem } from "./NavLinks";
import { CallButton, WhatsAppButton } from "./PhoneLinks";
import { RefSearch } from "./RefSearch";

type Props = {
  locale: Locale;
  items: NavItem[];
  phone: string;
  whatsapp: string;
  whatsappText: string;
  labels: { menu: string; close: string; call: string; whatsapp: string };
  search: { byNumber: string; placeholder: string; go: string; notFound: string; invalid: string; hint: string };
};

export function MobileNav({ locale, items, phone, whatsapp, whatsappText, labels, search }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const panel = useRef<HTMLDivElement | null>(null);

  if (lastPath !== pathname) {
    // Close the menu after navigating (state derived from a prop change, no effect needed).
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useGSAP(
    () => {
      if (!open || !panel.current || prefersReducedMotion()) return;
      setupGsap();
      gsap.fromTo(panel.current, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.55, ease: "power3.out" });
      gsap.fromTo("[data-nav-item]", { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.05, delay: 0.12, ease: "power3.out" });
    },
    { scope: panel, dependencies: [open] },
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative z-[61] inline-flex h-11 w-11 items-center justify-center rounded-[3px] text-navy-900 hover:bg-navy-900/6"
        aria-label={open ? labels.close : labels.menu}
        aria-expanded={open}
        aria-controls="mobile-menu"
      >
        {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
      </button>

      {/* Rendered on <body>: the header's backdrop blur would otherwise trap a fixed panel inside it. */}
      {open
        ? createPortal(
            <div
              id="mobile-menu"
              ref={panel}
              className="bg-grid fixed inset-x-0 bottom-0 top-[var(--header-h)] z-[60] flex flex-col overflow-y-auto bg-paper-50 lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label={labels.menu}
            >
          <nav className="container-x flex-1 py-6" aria-label="Mobile">
            <ul>
              {items.map((item, i) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href} data-nav-item className="border-b border-navy-900/10">
                    <Link href={item.href} className="flex items-baseline gap-4 py-4" aria-current={active ? "page" : undefined}>
                      <span className="w-6 font-mono text-[11px] text-gold-700">{String(i + 1).padStart(2, "0")}</span>
                      <span className={cn("font-display text-[1.55rem] font-semibold [font-stretch:112%]", active ? "text-gold-700" : "text-navy-900")}>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div data-nav-item className="mt-7">
              <RefSearch locale={locale} labels={search} variant="panel" onNavigate={() => setOpen(false)} />
            </div>
          </nav>
              <div data-nav-item className="container-x grid grid-cols-2 gap-3 border-t border-navy-900/10 bg-paper-0 py-4">
                <CallButton phone={phone} label={labels.call} showNumber={false} variant="primary" />
                <WhatsAppButton phone={whatsapp} label={labels.whatsapp} text={whatsappText} variant="outline" />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
