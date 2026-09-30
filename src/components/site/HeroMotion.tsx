"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap, prefersReducedMotion, setupGsap, SplitText, useGSAP } from "@/components/motion/gsap";

/**
 * Opening sequence of the home page. The headline rises line by line, then the specimen
 * sheet on the right is drafted in front of the visitor: outline first, then the fill,
 * the dimension on each side, the corner marks and finally the particulars beneath.
 */
export function HeroMotion({ children, className }: { children: React.ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!prefersReducedMotion()) document.documentElement.classList.add("motion");
  }, []);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      setupGsap();
      const reveal = () => el.querySelectorAll("[data-hero-hide]").forEach((n) => n.setAttribute("data-revealed", ""));
      if (prefersReducedMotion()) {
        reveal();
        return;
      }

      const title = el.querySelector<HTMLElement>("[data-hero-title]");
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      reveal();

      tl.from("[data-hero-eyebrow]", { autoAlpha: 0, x: -14, duration: 0.6 }, 0.05);

      if (title) {
        // autoSplit re-splits once the web font has loaded or the width changes, so the lines
        // break where they really fall. Returning the tween lets it carry on across a re-split.
        SplitText.create(title, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          linesClass: "hero-line",
          onSplit: (self) => gsap.from(self.lines, { yPercent: 105, duration: 0.95, stagger: 0.09, delay: 0.12, ease: "power4.out" }),
        });
      }

      tl.from("[data-hero-fade]", { autoAlpha: 0, y: 18, duration: 0.8, stagger: 0.1 }, 0.5);

      // The sheet.
      tl.from("[data-sheet]", { autoAlpha: 0, y: 34, duration: 1, ease: "power3.out" }, 0.3)
        .from("[data-sheet-mark]", { scale: 0, duration: 0.5, stagger: 0.05, ease: "back.out(2)" }, 0.7)
        .from(".plan-road", { autoAlpha: 0, duration: 0.6 }, 0.9)
        .from(".plan-outline", { drawSVG: "0%", duration: 1.5, ease: "power2.inOut" }, 0.85)
        .from(".plan-fill", { autoAlpha: 0, duration: 0.9 }, 1.75)
        .from(".plan-corner", { scale: 0, transformOrigin: "center", duration: 0.4, stagger: 0.09, ease: "back.out(2.4)" }, 1.55)
        .from(".plan-dim line", { drawSVG: "50% 50%", duration: 0.55, stagger: 0.04 }, 1.95)
        .from(".plan-dim text", { autoAlpha: 0, duration: 0.45, stagger: 0.08 }, 2.15)
        .from(".plan-area", { autoAlpha: 0, scale: 0.9, transformOrigin: "center", duration: 0.6 }, 2.3)
        .from(".plan-north", { autoAlpha: 0, rotation: -70, transformOrigin: "50% 50%", duration: 0.9, ease: "back.out(1.6)" }, 2.1)
        .from(".plan-scale", { autoAlpha: 0, x: -10, duration: 0.5 }, 2.35)
        .from("[data-sheet-row]", { autoAlpha: 0, y: 10, duration: 0.5, stagger: 0.07 }, 2.2);
    },
    { scope: root },
  );

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
