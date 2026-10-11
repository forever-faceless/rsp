"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Reloads the page's data every few seconds while it is on screen, so new messages appear by themselves. */
export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => {
      // Not while the tab is in the background, and not while something is being typed.
      const typing = document.activeElement instanceof HTMLTextAreaElement || document.activeElement instanceof HTMLInputElement;
      if (document.visibilityState === "visible" && !typing) router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [router, seconds]);
  return null;
}
