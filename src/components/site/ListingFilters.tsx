"use client";

import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { FACINGS, LISTING_STATUSES, PROPERTY_TYPES } from "@/lib/db/enums";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type FilterValues = {
  q: string;
  region: string;
  scope: string;
  type: string;
  status: string;
  facing: string;
  budget: string;
  area: string;
  sort: string;
};

type Props = { values: FilterValues; dict: Dictionary; activeCount: number; view: "list" | "map"; regions: { value: string; label: string }[] };

/**
 * Filters for the property list. Every choice lives in the address, so a filtered view can
 * be bookmarked or sent to a buyer, and the form still works as a plain GET without scripting.
 */
export function ListingFilters({ values, dict, activeCount, view, regions }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const form = useRef<HTMLFormElement | null>(null);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const t = dict.listings;

  const apply = () => {
    const f = form.current;
    if (!f) return;
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(f).entries()) {
      const v = String(value).trim();
      // Defaults stay out of the address, which keeps shared links short.
      if (v && !(key === "scope" && v === "all") && !(key === "sort" && v === "newest") && !(key === "view" && v === "list")) params.set(key, v);
    }
    const query = params.toString();
    start(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  const select = (name: keyof FilterValues, label: string, options: { value: string; label: string }[], blank?: string) => (
    <div>
      <label htmlFor={`f-${name}`} className="label-mono mb-1.5 block">
        {label}
      </label>
      <select id={`f-${name}`} name={name} defaultValue={values[name]} onChange={apply} className="field text-[14px]">
        {blank != null ? <option value="">{blank}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <form
      ref={form}
      method="get"
      action={pathname}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      className="card p-4 sm:p-5"
      // Remount when the address changes so the fields always reflect it.
      key={JSON.stringify(values)}
    >
      <input type="hidden" name="view" value={view} />
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
          <label htmlFor="f-q" className="sr-only">
            {dict.search.keyword}
          </label>
          <input id="f-q" name="q" defaultValue={values.q} placeholder={dict.search.keywordPlaceholder} className="field !pl-10" enterKeyHint="search" maxLength={60} />
        </div>
        <button type="submit" className="btn-primary shrink-0 !px-4" aria-label={dict.search.submit}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4 sm:hidden" aria-hidden="true" />}
          <span className="hidden sm:inline">{dict.search.submit}</span>
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="filter-fields"
          className="btn-outline relative shrink-0 !px-3.5 lg:hidden"
          aria-label={open ? t.hideFilters : t.showFilters}
        >
          {open ? <X className="h-4 w-4" aria-hidden="true" /> : <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />}
          {activeCount > 0 && !open ? (
            <span className="num absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-400 px-1 text-[11px] font-semibold text-navy-950">{activeCount}</span>
          ) : null}
        </button>
      </div>

      <div id="filter-fields" className={cn("mt-4 gap-3 sm:grid-cols-2 lg:grid-cols-4", regions.length > 1 ? "xl:grid-cols-8" : "xl:grid-cols-7", open ? "grid" : "hidden lg:grid")}>
        {regions.length > 1 ? select("region", t.region, regions, dict.common.any) : null}
        {select("scope", t.scope, [
          { value: "all", label: t.scopes.all },
          { value: "independent", label: t.scopes.independent },
          { value: "projects", label: t.scopes.projects },
        ])}
        {select(
          "type",
          t.type,
          PROPERTY_TYPES.map((p) => ({ value: p, label: dict.types[p] })),
          dict.common.any,
        )}
        {select(
          "status",
          t.status,
          LISTING_STATUSES.map((s) => ({ value: s, label: dict.status.listing[s] })),
          dict.common.any,
        )}
        {select(
          "budget",
          t.budget,
          dict.search.budgets.map((b, i) => ({ value: String(i + 1), label: b.label })),
          dict.common.any,
        )}
        {select(
          "area",
          t.area,
          t.areas.map((a, i) => ({ value: String(i + 1), label: a.label })),
          dict.common.any,
        )}
        {select(
          "facing",
          t.facing,
          FACINGS.map((f) => ({ value: f, label: dict.facing[f] })),
          dict.common.any,
        )}
        {select("sort", t.sort, [
          { value: "newest", label: t.sorts.newest },
          { value: "price_asc", label: t.sorts.price_asc },
          { value: "price_desc", label: t.sorts.price_desc },
          { value: "area_asc", label: t.sorts.area_asc },
          { value: "area_desc", label: t.sorts.area_desc },
        ])}
      </div>
    </form>
  );
}
