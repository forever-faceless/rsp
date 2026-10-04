"use client";

import { Languages, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { localeNames, locales, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * The quick enquiry opens over the listing, not on a page of its own. Opening it only changes
 * the address to …/interest, so the address can be shared and the back button closes it; the
 * listing behind is never reloaded. Someone arriving on …/interest from a shared link gets the
 * same listing with the card already open, and closing it simply drops back to the listing.
 */

/** True when this visit opened the card itself, so closing can step back instead of adding to history. */
let openedHere = false;

/** Opens the quick enquiry over the listing without leaving it. */
export function openEnquiry(interestPath: string) {
  openedHere = true;
  window.history.pushState(null, "", interestPath);
}

/** Closes the card and shows the listing it was opened over. */
export function closeEnquiry(listingPath: string) {
  if (openedHere) {
    openedHere = false;
    window.history.back();
  } else {
    window.history.replaceState(null, "", listingPath);
  }
}

/** The open card's own close, which lets it slide away first. */
const CloseContext = createContext<(() => void) | null>(null);

/** A link to the listing that, inside the card, simply closes it: the listing is already there behind it. */
export function CloseEnquiryLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const close = useContext(CloseContext);
  return (
    <a
      href={href}
      className={className}
      onClick={(ev) => {
        if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
        ev.preventDefault();
        if (close) close();
        else closeEnquiry(href);
      }}
    >
      {children}
    </a>
  );
}

/** A plain left click opens the card in place; a new-tab click, or no script at all, follows the link as usual. */
export function EnquireLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={className}
      data-enquire
      onClick={(ev) => {
        if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
        ev.preventDefault();
        openEnquiry(href);
      }}
    >
      {children}
    </a>
  );
}

/**
 * English or Kannada, at the top of the card. The card opens again in the other language with
 * what was already typed (the form keeps it in the tab), and the visit's history is not
 * lengthened, so closing it afterwards still lands on the listing.
 */
export function EnquiryLanguage({ locale, hrefs, label }: { locale: Locale; hrefs: Record<Locale, string>; label: string }) {
  return (
    <div className="flex min-h-10 items-center gap-2" data-interest-lang>
      <Languages className="h-4 w-4 text-ink-500" aria-hidden="true" />
      <div className="inline-flex rounded-[3px] border border-navy-900/15 bg-paper-0 p-0.5" role="group" aria-label={label}>
        {locales.map((l) =>
          l === locale ? (
            <span key={l} lang={l} aria-current="true" className="rounded-[2px] bg-navy-900 px-3 py-1 text-[13px] font-semibold leading-6 text-gold-200">
              {localeNames[l]}
            </span>
          ) : (
            <a
              key={l}
              href={hrefs[l]}
              lang={l}
              hrefLang={l}
              onClick={(ev) => {
                if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
                ev.preventDefault();
                track("language_switched", { to: l, place: "enquiry_card" }, { leaving: true });
                window.location.replace(hrefs[l]);
              }}
              className="rounded-[2px] px-3 py-1 text-[13px] font-semibold leading-6 text-navy-800 transition-colors hover:bg-navy-900/6"
            >
              {localeNames[l]}
            </a>
          ),
        )}
      </div>
    </div>
  );
}

type Props = {
  interestPath: string;
  listingPath: string;
  closeLabel: string;
  /**
   * How long someone landing on a shared link sees the listing before the card rises over it,
   * in milliseconds from the page's start. A card opened from the listing comes up at once.
   */
  landingDelay?: number;
  children: React.ReactNode;
};

const EXIT_MS = 240;
/** How far the sheet must be pulled down before letting go closes it. */
const DISMISS_PX = 90;

/**
 * On a phone the card is a sheet rising from the bottom, with a strip of the dimmed listing left
 * showing above it and a handle to pull it down, so it reads as something laid over the page and
 * put away again, not a page of its own. On a wider screen it is a card in the middle.
 */
export function EnquireOverlay({ interestPath, listingPath, closeLabel, landingDelay = 0, children }: Props) {
  const pathname = usePathname();
  const open = pathname === interestPath;
  // Only the card a visitor lands on waits; once it has been closed, it opens again at once.
  const [landing, setLanding] = useState(landingDelay > 0);
  // Until the card has risen it lets taps through to the listing, which is all that shows.
  const [ready, setReady] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setLanding(false);
      setReady(false);
    }
  }
  const delay = landing ? landingDelay : 0;
  const sheet = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    const finish = () => {
      leaving.current = false;
      closeEnquiry(listingPath);
    };
    const el = sheet.current;
    const bg = backdrop.current;
    if (!el || !bg || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return finish();
    const phone = window.matchMedia("(max-width: 639px)").matches;
    el.style.transition = `transform ${EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1), opacity ${EXIT_MS}ms ease-in`;
    el.style.transform = phone ? "translateY(100%)" : "translateY(12px) scale(0.98)";
    if (!phone) el.style.opacity = "0";
    bg.style.transition = `opacity ${EXIT_MS}ms ease-in`;
    bg.style.opacity = "0";
    window.setTimeout(finish, EXIT_MS);
  }, [listingPath]);

  useEffect(() => {
    if (!open || ready) return;
    // Counted from the page's start, so a slow load does not add a second wait on top.
    const wait = delay ? Math.max(0, delay + 300 - performance.now()) : 0;
    const timer = window.setTimeout(() => setReady(true), wait);
    return () => window.clearTimeout(timer);
  }, [open, ready, delay]);

  // On a phone, pulling the sheet down from its top closes it, as a bottom sheet does: visitors
  // tried it on the card itself, not only on the handle. Fields keep their own gestures.
  useEffect(() => {
    const area = scroller.current;
    if (!open || !area) return;
    let startX = 0;
    let startY = 0;
    let dy = 0;
    let tracking = false;
    let pulling = false;
    const onStart = (ev: TouchEvent) => {
      const target = ev.target instanceof Element ? ev.target : null;
      tracking = ev.touches.length === 1 && area.scrollTop <= 0 && window.matchMedia("(max-width: 639px)").matches && !target?.closest("input, textarea, select");
      pulling = false;
      dy = 0;
      startX = ev.touches[0]?.clientX ?? 0;
      startY = ev.touches[0]?.clientY ?? 0;
    };
    const onMove = (ev: TouchEvent) => {
      const el = sheet.current;
      if (!tracking || !el) return;
      const x = (ev.touches[0]?.clientX ?? startX) - startX;
      const y = (ev.touches[0]?.clientY ?? startY) - startY;
      if (!pulling) {
        if (y > 10 && y > Math.abs(x) * 1.5 && area.scrollTop <= 0) {
          pulling = true;
          el.style.transition = "none";
        } else {
          if (Math.abs(x) > 10 || Math.abs(y) > 10) tracking = false;
          return;
        }
      }
      ev.preventDefault();
      dy = Math.max(0, y - 10);
      el.style.transform = `translateY(${dy}px)`;
    };
    const onEnd = () => {
      const el = sheet.current;
      const was = pulling;
      tracking = false;
      pulling = false;
      if (!was || !el) return;
      if (dy > DISMISS_PX) return close();
      el.style.transition = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";
      el.style.transform = "";
    };
    area.addEventListener("touchstart", onStart, { passive: true });
    area.addEventListener("touchmove", onMove, { passive: false });
    area.addEventListener("touchend", onEnd);
    area.addEventListener("touchcancel", onEnd);
    return () => {
      area.removeEventListener("touchstart", onStart);
      area.removeEventListener("touchmove", onMove);
      area.removeEventListener("touchend", onEnd);
      area.removeEventListener("touchcancel", onEnd);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = before;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  if (!open) return null;
  return (
    <CloseContext.Provider value={close}>
      <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="interest-title" data-interest style={{ ["--enter-delay" as string]: `${delay}ms` }}>
        <div ref={backdrop} className={cn("enquiry-backdrop absolute inset-0 bg-navy-950/60 sm:backdrop-blur-sm", !ready && "pointer-events-none")} onClick={close} aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center sm:items-center sm:p-6">
          <div
            ref={sheet}
            className={cn(
              "enquiry-sheet relative flex max-h-[calc(100dvh-5.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-t-[16px] bg-paper-50 shadow-lift sm:max-h-[calc(100dvh-3rem)] sm:rounded-[4px]",
              ready && "pointer-events-auto",
            )}
            data-interest-sheet
          >
            {/* The handle: pull the sheet down to put it away. */}
            <div
              className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center sm:hidden"
              aria-hidden="true"
              data-interest-handle
              onPointerDown={(ev) => {
                if (ev.pointerType === "mouse" || !sheet.current) return;
                drag.current = { y: ev.clientY, dy: 0 };
                ev.currentTarget.setPointerCapture(ev.pointerId);
                sheet.current.style.transition = "none";
              }}
              onPointerMove={(ev) => {
                const d = drag.current;
                if (!d || !sheet.current) return;
                d.dy = Math.max(0, ev.clientY - d.y);
                sheet.current.style.transform = `translateY(${d.dy}px)`;
              }}
              onPointerUp={() => {
                const d = drag.current;
                const el = sheet.current;
                drag.current = null;
                if (!d || !el) return;
                if (d.dy > DISMISS_PX) return close();
                el.style.transition = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";
                el.style.transform = "";
              }}
              onPointerCancel={() => {
                drag.current = null;
                if (sheet.current) sheet.current.style.transform = "";
              }}
            >
              <span className="h-[5px] w-11 rounded-full bg-navy-900/20" />
            </div>
            <a
              href={listingPath}
              aria-label={closeLabel}
              data-interest-close
              onClick={(ev) => {
                ev.preventDefault();
                close();
              }}
              className="absolute right-3 top-10 z-10 inline-flex h-10 w-10 items-center justify-center rounded-[3px] bg-paper-0/90 text-navy-900 shadow-card hover:bg-paper-0 sm:top-3"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </a>
            <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:grid lg:grid-cols-[1.15fr_0.85fr]" data-interest-scroll>
              {children}
            </div>
          </div>
        </div>
      </div>
    </CloseContext.Provider>
  );
}
