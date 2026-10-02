"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
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

/** A link to the listing that, inside the card, simply closes it: the listing is already there behind it. */
export function CloseEnquiryLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={className}
      onClick={(ev) => {
        if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
        ev.preventDefault();
        closeEnquiry(href);
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

type Props = { interestPath: string; listingPath: string; closeLabel: string; children: React.ReactNode };

export function EnquireOverlay({ interestPath, listingPath, closeLabel, children }: Props) {
  const pathname = usePathname();
  const open = pathname === interestPath;

  const close = () => closeEnquiry(listingPath);

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
    // close reads only module state and the paths, which do not change while the card is open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-navy-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="interest-title"
      data-interest
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) close();
      }}
    >
      <div
        className="flex min-h-full items-start justify-center sm:items-center sm:p-6"
        onClick={(ev) => {
          if (ev.target === ev.currentTarget) close();
        }}
      >
        <div className={cn("relative w-full max-w-5xl bg-paper-50 shadow-lift sm:rounded-[4px] lg:grid lg:grid-cols-[1.15fr_0.85fr]")}>
          <a
            href={listingPath}
            aria-label={closeLabel}
            data-interest-close
            onClick={(ev) => {
              ev.preventDefault();
              close();
            }}
            className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-[3px] bg-paper-0/90 text-navy-900 shadow-card hover:bg-paper-0"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </a>
          {children}
        </div>
      </div>
    </div>
  );
}
