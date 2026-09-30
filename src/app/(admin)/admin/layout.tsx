import type { Metadata, Viewport } from "next";
import "@/app/globals.css";
import { fontClassNames } from "@/lib/fonts";

export const dynamic = "force-dynamic";
// Photo uploads process several images per request; allow more than the 10 s serverless default.
export const maxDuration = 60;

export const metadata: Metadata = {
  title: { default: "Register", template: "%s · RSP Ventures register" },
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "RSP Register", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0d1a2d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="en" className={`${fontClassNames} h-full antialiased`}>
      <body className="min-h-full bg-paper-100 text-ink-800">{children}</body>
    </html>
  );
}
