"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { WhatsAppIcon } from "./PhoneLinks";

type Props = { path: string; text: string; labels: { whatsapp: string; copy: string; copied: string }; tone?: "light" | "dark"; className?: string };

/** Sends the page to someone on WhatsApp, or copies its address. */
export function ShareButtons({ path, text, labels, tone = "light", className }: Props) {
  const [copied, setCopied] = useState(false);
  const dark = tone === "dark";
  const url = () => new URL(path, window.location.origin).toString();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard access can be refused; the address bar is still there.
    }
  };

  const base = cn(
    "inline-flex min-h-9 items-center gap-2 rounded-[3px] border px-3 text-[13px] font-semibold transition-colors",
    dark ? "border-paper-0/20 text-navy-100 hover:border-gold-300 hover:text-gold-200" : "border-navy-900/15 text-navy-800 hover:border-navy-800",
  );

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <button type="button" className={base} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url()}`)}`, "_blank", "noopener,noreferrer")}>
        <WhatsAppIcon />
        {labels.whatsapp}
      </button>
      <button type="button" className={base} onClick={copy} aria-live="polite">
        {copied ? <Check className="h-4 w-4 text-success-600" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
        {copied ? labels.copied : labels.copy}
      </button>
    </div>
  );
}
