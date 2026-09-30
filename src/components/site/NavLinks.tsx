"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string };

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative whitespace-nowrap px-2.5 py-2 text-[14px] font-medium transition-colors xl:px-3 after:absolute after:inset-x-3 after:-bottom-px after:h-[2px] after:origin-left after:bg-gold-500 after:transition-transform after:duration-300",
              active ? "text-navy-900 after:scale-x-100" : "text-ink-600 after:scale-x-0 hover:text-navy-900 hover:after:scale-x-100",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
