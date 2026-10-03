/**
 * PostHog, the site's analytics: page views, clicks, heatmaps and session recordings of the
 * public site. The key is PostHog's write-only project key, made to be read by browsers.
 */
export const POSTHOG_KEY = "phc_o82Dtqtnt2fnCwHKXHFrzV5zCW7PUvnWouyWKPgg7hQb";
export const POSTHOG_PROJECT = 292872;
export const POSTHOG_UI = "https://eu.posthog.com";

/** Set in a browser once it has signed in to the admin, so the office's own visits stay out of the figures. */
export const STAFF_MARK = "rsp-staff";

/** Where to watch the recording of a visit in PostHog. */
export function replayUrl(sessionId: string): string {
  return `${POSTHOG_UI}/project/${POSTHOG_PROJECT}/replay/${encodeURIComponent(sessionId)}`;
}
