import posthog from "posthog-js";
import { trackingAllowed } from "@/lib/analytics";
import { POSTHOG_KEY, POSTHOG_UI } from "@/lib/analytics-config";

// Analytics for the public site. It starts before the page becomes interactive, so the first
// moments of a visit are in the recording too. Events go through the site's own /ingest
// address (see next.config.ts), so blockers that stop third-party trackers do not drop them.
if (trackingAllowed()) {
  try {
    posthog.init(POSTHOG_KEY, {
      api_host: "/ingest",
      ui_host: POSTHOG_UI,
      defaults: "2026-08-30",
      // Profiles only for visitors who sent an enquiry, and those carry only its register number.
      person_profiles: "identified_only",
      capture_exceptions: true,
      session_recording: {
        // Whatever is typed into a form never appears in a recording, and nor do lines marked private.
        maskAllInputs: true,
        maskTextSelector: "[data-private]",
      },
      before_send: (event) => {
        if (!event) return null;
        const url = event.properties?.$current_url;
        if (typeof url === "string" && /^https?:\/\/[^/]+\/admin(\/|$|\?)/.test(url)) return null;
        // Instagram's and Facebook's in-app browsers throw this from their own bridge to the app,
        // over and over; it says nothing about the site and would bury its real errors.
        if (event.event === "$exception" && /Java object is gone/.test(JSON.stringify(event.properties?.$exception_list ?? event.properties?.$exception_message ?? ""))) return null;
        return event;
      },
    });

    // Where a shared link was posted (?from=instagram), kept with everything in the visit.
    const from = new URLSearchParams(window.location.search).get("from");
    if (from && /^[a-z0-9_-]{1,24}$/i.test(from)) posthog.register_for_session({ shared_from: from.toLowerCase() });

    // A call or a WhatsApp tap, from wherever it is on the site: the moments a visitor reaches out.
    document.addEventListener(
      "click",
      (ev) => {
        const link = ev.target instanceof Element ? ev.target.closest<HTMLAnchorElement>('a[href^="tel:"], a[href*="wa.me/"]') : null;
        if (!link) return;
        posthog.capture(link.href.startsWith("tel:") ? "call_clicked" : "whatsapp_clicked", { place: link.closest("[data-interest]") ? "enquiry_card" : window.location.pathname }, { transport: "sendBeacon" });
      },
      { capture: true },
    );
  } catch {}
}
