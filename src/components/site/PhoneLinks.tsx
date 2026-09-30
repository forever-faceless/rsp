import { Phone } from "lucide-react";
import { cn, formatPhoneDisplay, telHref, whatsappHref } from "@/lib/utils";

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-4 w-4", className)} fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.67c2.2 0 4.27.86 5.82 2.42a8.2 8.2 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.4-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24ZM8.53 7.33c-.16 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.13.17 1.76 2.67 4.25 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.46-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.16-.48-.29-.25-.12-1.47-.73-1.69-.81-.23-.08-.4-.12-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23a7.4 7.4 0 0 1-1.38-1.72c-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.84-.2-.49-.4-.42-.56-.43l-.47-.01Z" />
    </svg>
  );
}

type Variant = "primary" | "gold" | "outline" | "outline-light" | "ghost";

const variantClass: Record<Variant, string> = {
  primary: "btn-primary",
  gold: "btn-gold",
  outline: "btn-outline",
  "outline-light": "btn-outline-light",
  ghost: "btn-ghost",
};

type ButtonProps = {
  phone: string;
  label?: string;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  showNumber?: boolean;
  className?: string;
};

export function CallButton({ phone, label, variant = "primary", size = "md", showNumber = true, className }: ButtonProps) {
  if (!phone) return null;
  const number = formatPhoneDisplay(phone);
  return (
    <a href={telHref(phone)} className={cn(variantClass[variant], size === "sm" && "btn-sm", size === "lg" && "btn-lg", className)}>
      <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label ? <span>{label}</span> : null}
      {showNumber ? <span className="num whitespace-nowrap">{number}</span> : null}
    </a>
  );
}

export function WhatsAppButton({ phone, label, text, variant = "outline", size = "md", className }: ButtonProps & { text?: string }) {
  if (!phone) return null;
  return (
    <a
      href={whatsappHref(phone, text)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(variantClass[variant], size === "sm" && "btn-sm", size === "lg" && "btn-lg", className)}
    >
      <WhatsAppIcon className="shrink-0" />
      {label ?? "WhatsApp"}
    </a>
  );
}
