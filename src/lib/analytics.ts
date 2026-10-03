import posthog from "posthog-js";
import { STAFF_MARK } from "./analytics-config";

/**
 * Only the public site at its real address is measured: never the admin, a local copy, the
 * test runs, a preview deployment, or a browser the office has signed in from.
 */
export function trackingAllowed(): boolean {
  if (typeof window === "undefined") return false;
  const { hostname, pathname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname.endsWith(".localhost")) return false;
  let site = "";
  try {
    site = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").hostname;
  } catch {}
  if (!site || hostname !== site) return false;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return false;
  try {
    if (window.localStorage.getItem(STAFF_MARK)) return false;
  } catch {}
  return true;
}

/** Records one event, when analytics is running on this page. Leaving the page, a beacon carries it. */
export function track(event: string, properties?: Record<string, unknown>, options?: { leaving?: boolean }) {
  if (!posthog.__loaded) return;
  posthog.capture(event, properties, options?.leaving ? { transport: "sendBeacon" } : undefined);
}

/** The id of this visit's recording, kept with an enquiry so the office can watch how it came about. */
export function visitId(): string {
  return posthog.__loaded ? (posthog.get_session_id() ?? "") : "";
}

/**
 * Ties this visitor's visits to the enquiry they sent, by its number in the register only:
 * no name or phone number goes to PostHog.
 */
export function identifyLead(leadId: number, ref: string) {
  if (!posthog.__loaded || !leadId) return;
  posthog.identify(`lead:${leadId}`, { lead_id: leadId }, { first_enquiry_about: ref });
}

/** Marks this browser as the office's, and stops anything already running in it. */
export function markStaffBrowser() {
  try {
    window.localStorage.setItem(STAFF_MARK, "1");
  } catch {}
  if (posthog.__loaded) posthog.opt_out_capturing();
}
