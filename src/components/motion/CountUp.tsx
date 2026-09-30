"use client";

import { useRef } from "react";
import { gsap, prefersReducedMotion, setupGsap, useGSAP } from "./gsap";

const format = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Counts up to a figure the first time it scrolls into view. The final value is what the server renders. */
export function CountUp({ value, suffix = "", className }: { value: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion() || value <= 0) return;
      setupGsap();
      const state = { n: 0 };
      gsap.to(state, {
        n: value,
        duration: Math.min(2.2, 0.9 + value / 400),
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 92%", once: true },
        onStart: () => {
          el.textContent = `0${suffix}`;
        },
        onUpdate: () => {
          el.textContent = `${format.format(Math.round(state.n))}${suffix}`;
        },
      });
    },
    { scope: ref, dependencies: [value, suffix] },
  );

  return (
    <span ref={ref} className={className}>
      {format.format(value)}
      {suffix}
    </span>
  );
}
