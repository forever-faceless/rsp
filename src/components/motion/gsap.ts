"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

declare global {
  interface Window {
    __rspMotion?: boolean;
  }
}

let registered = false;

/** Registers the plugins once and tells the inline failsafe that animation code is alive. */
export function setupGsap(): typeof gsap {
  if (!registered && typeof window !== "undefined") {
    gsap.registerPlugin(useGSAP, ScrollTrigger, DrawSVGPlugin, SplitText);
    // Shared timelines address parts that some pages do not have; that is expected, not an error.
    gsap.config({ nullTargetWarn: false });
    gsap.defaults({ ease: "power3.out", duration: 0.8 });
    ScrollTrigger.config({ ignoreMobileResize: true });
    window.__rspMotion = true;
    // Development only: lets a test drive the clock by hand when the window is not on screen.
    if (process.env.NODE_ENV === "development") (window as unknown as { __gsap?: typeof gsap }).__gsap = gsap;
    registered = true;
  }
  return gsap;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export { gsap, ScrollTrigger, SplitText, useGSAP };
