"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap, prefersReducedMotion, setupGsap, useGSAP } from "@/components/motion/gsap";

/**
 * Numbered steps joined by a gold line that is drawn as the section scrolls into view:
 * left to right on a desktop, top to bottom on a phone.
 */
export function ProcessLine({ steps }: { steps: { title: string; text: string }[] }) {
  const root = useRef<HTMLOListElement | null>(null);

  useLayoutEffect(() => {
    if (!prefersReducedMotion()) document.documentElement.classList.add("motion");
  }, []);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      setupGsap();
      el.setAttribute("data-revealed", "");
      if (prefersReducedMotion()) return;

      const mm = gsap.matchMedia();
      const build = (horizontal: boolean) => {
        const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 82%", once: true } });
        tl.fromTo("[data-line]", horizontal ? { scaleX: 0 } : { scaleY: 0 }, { scaleX: 1, scaleY: 1, duration: 1.5, ease: "power2.inOut" }, 0)
          .from("[data-node]", { scale: 0, duration: 0.45, stagger: 0.28, ease: "back.out(2.2)" }, 0.1)
          .from("[data-step]", { autoAlpha: 0, y: 18, duration: 0.7, stagger: 0.28 }, 0.2);
      };
      mm.add("(min-width: 1024px)", () => build(true));
      mm.add("(max-width: 1023.98px)", () => build(false));
    },
    { scope: root },
  );

  return (
    <ol ref={root} data-reveal="children" className="relative mt-14 grid gap-10 lg:grid-cols-4 lg:gap-8">
      {/* The connecting line. One for each layout, so it can grow along the right axis. */}
      <span data-line className="absolute left-[11px] top-3 block h-[calc(100%-1.5rem)] w-px origin-top bg-gold-500/70 lg:hidden" aria-hidden="true" />
      <span data-line className="absolute left-0 top-[11px] hidden h-px w-full origin-left bg-gold-500/70 lg:block" aria-hidden="true" />

      {steps.map((step, i) => (
        <li key={step.title} className="relative pl-11 lg:pl-0 lg:pt-11">
          <span
            data-node
            className="absolute left-0 top-0 flex h-[23px] w-[23px] items-center justify-center border border-gold-600 bg-paper-50"
            aria-hidden="true"
          >
            <span className="h-[7px] w-[7px] bg-navy-800" />
          </span>
          <div data-step>
            <p className="num text-[12px] font-medium text-gold-700">{String(i + 1).padStart(2, "0")}</p>
            <h3 className="mt-2 text-[1.2rem] leading-snug">{step.title}</h3>
            <p className="mt-2.5 text-[15px] leading-relaxed text-ink-600">{step.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
