"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { gsap, prefersReducedMotion, setupGsap, useGSAP } from "./gsap";

type Props = {
  children: React.ReactNode;
  className?: string;
  /** "self" fades the element in as one piece; "children" brings its direct children in one after another. */
  mode?: "self" | "children";
  as?: "div" | "section" | "ul" | "ol" | "li" | "article" | "header" | "footer" | "dl";
  delay?: number;
  stagger?: number;
  /** Distance travelled, in pixels. */
  y?: number;
  id?: string;
};

/**
 * Entrance animation on scroll. Content is server-rendered and readable without scripting;
 * the hidden starting state only applies once the inline script has switched motion on.
 */
export function Reveal({ children, className, mode = "self", as = "div", delay = 0, stagger = 0.08, y = 22, id }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const Tag = as as React.ElementType;

  // React's strict mode in development resets attributes on <html>; put the class back before paint.
  useLayoutEffect(() => {
    if (!prefersReducedMotion()) document.documentElement.classList.add("motion");
  }, []);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      setupGsap();
      const targets = mode === "children" ? Array.from(el.children) : [el];
      if (prefersReducedMotion() || !targets.length) {
        el.setAttribute("data-revealed", "");
        return;
      }
      gsap.set(targets, { autoAlpha: 0, y });
      el.setAttribute("data-revealed", "");
      gsap.to(targets, {
        autoAlpha: 1,
        y: 0,
        duration: 0.9,
        delay,
        stagger: mode === "children" ? stagger : 0,
        ease: "power3.out",
        clearProps: "transform",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref} id={id} data-reveal={mode === "children" ? "children" : ""} className={cn(className)}>
      {children}
    </Tag>
  );
}
