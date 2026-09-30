import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * True when a person is opening a page, as opposed to the router fetching data or prefetching a
 * link that happens to be on screen. Next strips its own router headers before the proxy runs,
 * so the browser's fetch metadata is what tells the two apart.
 */
function isPageVisit(request: NextRequest): boolean {
  const dest = request.headers.get("sec-fetch-dest");
  if (dest) return dest === "document";
  return (request.headers.get("accept") ?? "").includes("text/html");
}

function detectLocale(request: NextRequest): Locale {
  const fromCookie = request.cookies.get(LOCALE_COOKIE)?.value ?? "";
  if (isLocale(fromCookie)) return fromCookie;
  const accept = request.headers.get("accept-language") ?? "";
  if (/(^|,)\s*kn\b/i.test(accept)) return "kn";
  return defaultLocale;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ----- Admin area: optimistic session check (pages and server actions re-verify) -----
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/login") return NextResponse.next();
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const session = token ? await verifySessionToken(token) : null;
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ----- Public site: every page lives under /en or /kn -----
  const first = pathname.split("/")[1] ?? "";
  if (isLocale(first)) {
    const response = NextResponse.next();
    // Remember the language only when the visitor actually opened a page in it. The link to the
    // other language is prefetched as soon as it is on screen, and that must not flip the choice.
    if (isPageVisit(request) && request.cookies.get(LOCALE_COOKIE)?.value !== first) {
      response.cookies.set(LOCALE_COOKIE, first, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
    }
    return response;
  }

  const locale = detectLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Everything except API routes, uploaded files, Next internals and static assets.
    "/((?!api|uploads|_next/static|_next/image|favicon\\.ico|brand|demo|icon|apple-icon|opengraph-image|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|txt|xml|pdf|html|kml|json|mp4|webm|woff2?)$).*)",
  ],
};
