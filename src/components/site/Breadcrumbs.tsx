import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type Crumb = { href?: string; label: string };

export function Breadcrumbs({ items, tone = "light", className }: { items: Crumb[]; tone?: "light" | "dark"; className?: string }) {
  const dark = tone === "dark";
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px]", dark ? "text-navy-300" : "text-ink-500")}>
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="inline-flex items-center gap-1.5">
            {i > 0 ? <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden="true" /> : null}
            {item.href ? (
              <Link href={item.href} className={cn("transition-colors", dark ? "hover:text-gold-200" : "hover:text-navy-800")}>
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className={cn("font-medium", dark ? "text-paper-50" : "text-navy-800")}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
