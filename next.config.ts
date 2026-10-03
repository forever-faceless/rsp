import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tests build into their own folder, so checking a change never disturbs the running site.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  experimental: {
    serverActions: {
      // Admin photo uploads (several photos per submit) exceed the 1 MB default.
      // Vercel enforces its own 4.5 MB cap; photos are compressed in the browser to stay under it.
      bodySizeLimit: "40mb",
    },
  },
  // Read from disk at runtime, so they are shipped with the server bundle: the Drizzle
  // migrations, and the type and logo that link-preview pictures are drawn with.
  outputFileTracingIncludes: {
    "/*": ["./drizzle/**/*", "./src/assets/fonts/*.ttf", "./public/brand/logo-wide.png"],
  },
  // Analytics travel through the site's own address to PostHog's EU servers, so blockers that
  // stop third-party trackers do not silently drop them. PostHog's addresses end in a slash,
  // which Next would otherwise redirect away.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://eu-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/array/:path*", destination: "https://eu-assets.i.posthog.com/array/:path*" },
      { source: "/ingest/:path*", destination: "https://eu.i.posthog.com/:path*" },
    ];
  },
  async headers() {
    return [
      {
        // The field survey tool needs the phone's GPS; everything else is denied by default.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
