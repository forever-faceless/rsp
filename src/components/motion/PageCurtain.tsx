"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { formatRef, parseRef } from "@/lib/refs";
import { gsap, prefersReducedMotion, setupGsap, useGSAP } from "./gsap";

type Props = {
  /** "hold" stays in place while the page loads; "lift" plays the reveal as soon as it mounts. */
  mode: "hold" | "lift";
  /** Property number or project name shown under the mark. */
  label?: string;
  caption?: string;
};

const SEEN_KEY = "rsp-curtain-seen";

/** Works out the property number from the address while the page itself is still loading. */
function labelFromParams(params: Record<string, string | string[] | undefined>): string {
  const raw = typeof params.ref === "string" ? params.ref : "";
  const parsed = parseRef(raw);
  if (!parsed) return "";
  const prefix = decodeURIComponent(raw).match(/^[a-z]+/i)?.[0] ?? "";
  return formatRef(prefix, parsed.propertyNo, parsed.siteNo);
}

/**
 * The opening screen of a property page: the mark on navy, the property number beneath it
 * and a gold line keeping time. The loading state and the page render the same screen, so
 * the hand-over between them is invisible; the page then lifts it away.
 */
export function PageCurtain({ mode, label, caption }: Props) {
  const root = useRef<HTMLDivElement | null>(null);
  const params = useParams();
  const [done, setDone] = useState(false);
  const text = label ?? labelFromParams(params);

  useGSAP(
    () => {
      if (mode !== "lift" || !root.current) return;
      setupGsap();
      if (prefersReducedMotion()) {
        setDone(true);
        return;
      }
      let seen = false;
      try {
        seen = sessionStorage.getItem(SEEN_KEY) === "1";
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {
        // Private browsing can refuse storage; the longer opening simply plays again.
      }
      const tl = gsap.timeline({ delay: seen ? 0.12 : 0.55, onComplete: () => setDone(true) });
      tl.to("[data-curtain-inner]", { autoAlpha: 0, y: -14, duration: 0.35, ease: "power2.in" })
        .to("[data-curtain-panel]", { yPercent: -100, duration: seen ? 0.65 : 0.85, ease: "power4.inOut" }, "-=0.05")
        .to("[data-curtain-edge]", { yPercent: -100, duration: seen ? 0.65 : 0.85, ease: "power4.inOut" }, "<0.08");
    },
    { scope: root, dependencies: [mode] },
  );

  if (done) return null;

  return (
    <div ref={root} className="curtain no-print !bg-transparent" aria-hidden="true" style={mode === "hold" ? { animation: "none" } : undefined}>
      <div data-curtain-edge className="absolute inset-0 bg-gold-400" />
      <div data-curtain-panel className="bg-grid-dark absolute inset-0 bg-navy-900" />
      <div data-curtain-inner className="relative flex flex-col items-center px-6 text-center">
        <div className="sheen">
          <Image src="/brand/logo-full-sm.webp" alt="" width={360} height={267} priority unoptimized className="h-auto w-[150px] sm:w-[176px]" />
        </div>
        <div className="mt-7 h-px w-40 overflow-hidden bg-gold-300/15">
          <div className="curtain-line h-full w-full bg-gold-300" />
        </div>
        {caption ? <p className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.24em] text-navy-300">{caption}</p> : null}
        {text ? <p className="mt-2 font-mono text-[15px] font-medium tracking-[0.1em] text-gold-200">{text}</p> : null}
      </div>
    </div>
  );
}
