"use client";

import { Building2, ExternalLink, FolderKanban, LayoutDashboard, LogOut, MapPinned, Menu, MessageSquareText, Quote, Settings, Handshake, Users, X, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; short: string; icon: LucideIcon; exact?: boolean };

const nav: Item[] = [
  { href: "/admin", label: "Dashboard", short: "Home", icon: LayoutDashboard, exact: true },
  { href: "/admin/properties", label: "Properties", short: "Properties", icon: Building2 },
  { href: "/admin/projects", label: "Projects and sites", short: "Projects", icon: FolderKanban },
  { href: "/admin/surveys", label: "Field surveys", short: "Survey", icon: MapPinned },
  { href: "/admin/leads", label: "Enquiries", short: "Enquiries", icon: MessageSquareText },
  { href: "/admin/brokers", label: "Brokers", short: "Brokers", icon: Handshake },
  { href: "/admin/testimonials", label: "Testimonials", short: "Testimonials", icon: Quote },
  { href: "/admin/team", label: "Team", short: "Team", icon: Users },
  { href: "/admin/settings", label: "Company settings", short: "Settings", icon: Settings },
];

/** The five destinations that matter on a phone, with the survey tool in the middle. */
const tabs = ["/admin", "/admin/properties", "/admin/surveys", "/admin/leads"];

export function AdminShell({ user, newLeads, children }: { user: string; newLeads: number; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    // Close the menu after navigating (state derived from a prop change, no effect needed).
    setLastPath(pathname);
    setOpen(false);
  }

  const isActive = (item: Item) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));
  // The survey tool is a full-screen workspace, so the page chrome steps out of its way.
  const workspace = /^\/admin\/surveys\/\d+(\/reel)?$/.test(pathname);

  const links = (
    <nav className="space-y-0.5" aria-label="Admin">
      {nav.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-[3px] px-3 text-[14px] font-medium transition-colors",
              active ? "bg-gold-400/15 text-gold-200" : "text-navy-200 hover:bg-paper-0/6 hover:text-paper-50",
            )}
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            <span className="flex-1">{item.label}</span>
            {item.href === "/admin/leads" && newLeads > 0 ? <span className="num rounded-[2px] bg-gold-400 px-1.5 py-0.5 text-[11px] font-semibold text-navy-950">{newLeads}</span> : null}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="space-y-0.5 border-t border-paper-0/10 pt-3">
      <a href="/en" target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-3 rounded-[3px] px-3 text-[14px] text-navy-200 hover:bg-paper-0/6 hover:text-paper-50">
        <ExternalLink className="h-[18px] w-[18px]" aria-hidden="true" /> View website
      </a>
      <form action={logout}>
        <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-[3px] px-3 text-left text-[14px] text-navy-200 hover:bg-paper-0/6 hover:text-paper-50">
          <LogOut className="h-[18px] w-[18px]" aria-hidden="true" /> Sign out <span className="ml-auto text-xs text-navy-400">{user}</span>
        </button>
      </form>
    </div>
  );

  const brand = (
    <Link href="/admin" className="flex flex-col items-start gap-1.5" aria-label="RSP Ventures register">
      <Image src="/brand/logo-wide-sm.webp" alt="" width={687} height={160} unoptimized className="h-9 w-auto" />
      <span className="font-mono text-[9.5px] uppercase leading-none tracking-[0.24em] text-navy-300">Register</span>
    </Link>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="surface-navy sticky top-0 hidden h-dvh flex-col justify-between overflow-y-auto p-4 lg:flex">
        <div>
          <div className="px-2 py-2">{brand}</div>
          <div className="mt-7">{links}</div>
        </div>
        {footer}
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className={cn("surface-navy sticky top-0 z-40 flex h-14 items-center justify-between px-4 lg:hidden", workspace && "hidden")}>
          {brand}
          <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex h-11 w-11 items-center justify-center rounded-[3px] text-paper-50" aria-label={open ? "Close menu" : "Menu"} aria-expanded={open}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </header>
        {open ? (
          <div className="surface-navy fixed inset-x-0 bottom-0 top-14 z-40 space-y-4 overflow-y-auto p-4 lg:hidden">
            {links}
            {footer}
          </div>
        ) : null}

        <main className={cn("flex-1", workspace ? "" : "p-4 pb-24 sm:p-6 sm:pb-24 lg:p-9 lg:pb-9")}>{children}</main>

        {/* Thumb-reach navigation on a phone. */}
        <nav
          className={cn("fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-navy-900/15 bg-paper-0 pb-[env(safe-area-inset-bottom)] lg:hidden", workspace && "hidden")}
          aria-label="Quick navigation"
        >
          {nav
            .filter((i) => tabs.includes(i.href))
            .map((item) => {
              const active = isActive(item);
              const survey = item.href === "/admin/surveys";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("relative flex min-h-[58px] flex-col items-center justify-center gap-1 text-[11px] font-semibold", active ? "text-navy-900" : "text-ink-500")}
                >
                  <span className={cn("flex items-center justify-center", survey && "h-8 w-11 rounded-[3px] bg-navy-900 text-gold-200")}>
                    <item.icon className="h-[19px] w-[19px]" aria-hidden="true" />
                  </span>
                  {item.short}
                  {item.href === "/admin/leads" && newLeads > 0 ? (
                    <span className="num absolute right-[22%] top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold-400 px-1 text-[10px] font-semibold text-navy-950">{newLeads}</span>
                  ) : null}
                  {active ? <span className="absolute inset-x-5 top-0 h-[2px] bg-gold-500" aria-hidden="true" /> : null}
                </Link>
              );
            })}
          <button type="button" onClick={() => setOpen(true)} className="flex min-h-[58px] flex-col items-center justify-center gap-1 text-[11px] font-semibold text-ink-500">
            <Menu className="h-[19px] w-[19px]" aria-hidden="true" />
            More
          </button>
        </nav>
      </div>
    </div>
  );
}
