import type { MetadataRoute } from "next";

/**
 * Lets the owner add the admin panel to a phone's home screen, where it opens full screen
 * like an app. That is the quickest way into the field survey tool when standing on a site.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RSP Ventures",
    short_name: "RSP Ventures",
    description: "Property register and field survey for RSP Ventures.",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbfaf6",
    theme_color: "#0d1a2d",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New field survey", short_name: "Survey", url: "/admin/surveys/new" },
      { name: "Enquiries", short_name: "Enquiries", url: "/admin/leads" },
    ],
  };
}
