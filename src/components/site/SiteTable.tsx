"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Facing, ListingStatus } from "@/lib/db/enums";
import type { Locale } from "@/lib/i18n/config";
import { cn, formatINRShort, formatNumber } from "@/lib/utils";
import { ListingStatusBadge } from "./StatusBadge";

export type SiteRow = {
  id: number;
  siteNo: number;
  refText: string;
  dimension: string;
  areaSqft: number | null;
  facing: Facing | null;
  roadWidthFt: number | null;
  corner: boolean;
  status: ListingStatus;
  price: number | null;
  href: string;
};

type Labels = {
  siteNo: string;
  dimension: string;
  area: string;
  facing: string;
  road: string;
  price: string;
  status: string;
  onlyAvailable: string;
  facingFilter: string;
  dimensionFilter: string;
  all: string;
  clear: string;
  noResults: string;
  showing: string;
  showAll: string;
  corner: string;
  onRequest: string;
  sqft: string;
  ft: string;
  statusLabels: Record<ListingStatus, string>;
  facingLabels: Record<Facing, string>;
};

const FOLD = 24;

/** The schedule of sites in a layout, with the quick filters buyers reach for first. */
export function SiteTable({ sites, locale, labels }: { sites: SiteRow[]; locale: Locale; labels: Labels }) {
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [facing, setFacing] = useState("");
  const [dimension, setDimension] = useState("");

  const facings = useMemo(() => Array.from(new Set(sites.map((s) => s.facing).filter(Boolean))) as Facing[], [sites]);
  const dimensions = useMemo(() => Array.from(new Set(sites.map((s) => s.dimension).filter(Boolean))), [sites]);
  const filtered = useMemo(
    () => sites.filter((s) => (!onlyAvailable || s.status === "available") && (!facing || s.facing === facing) && (!dimension || s.dimension === dimension)),
    [sites, onlyAvailable, facing, dimension],
  );
  const hasFilters = onlyAvailable || facing || dimension;
  // A large layout would otherwise push the enquiry form a long way down the page.
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? filtered : filtered.slice(0, FOLD);
  const clear = () => {
    setOnlyAvailable(false);
    setFacing("");
    setDimension("");
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOnlyAvailable((v) => !v)}
          aria-pressed={onlyAvailable}
          className={cn(
            "min-h-10 rounded-[3px] border px-3.5 text-[13px] font-semibold transition-colors",
            onlyAvailable ? "border-success-600 bg-success-100 text-success-700" : "border-navy-900/18 bg-paper-0 text-ink-700 hover:border-navy-800",
          )}
        >
          {labels.onlyAvailable}
        </button>
        {facings.length > 1 ? (
          <select value={facing} onChange={(e) => setFacing(e.target.value)} className="field !w-auto !py-2 text-[13px]" aria-label={labels.facingFilter}>
            <option value="">
              {labels.facingFilter}: {labels.all}
            </option>
            {facings.map((f) => (
              <option key={f} value={f}>
                {labels.facingLabels[f]}
              </option>
            ))}
          </select>
        ) : null}
        {dimensions.length > 1 ? (
          <select value={dimension} onChange={(e) => setDimension(e.target.value)} className="field num !w-auto !py-2 text-[13px]" aria-label={labels.dimensionFilter}>
            <option value="">
              {labels.dimensionFilter}: {labels.all}
            </option>
            {dimensions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        ) : null}
        {hasFilters ? (
          <button type="button" onClick={clear} className="px-2 text-[13px] font-semibold text-navy-800 underline decoration-gold-500 decoration-2 underline-offset-4">
            {labels.clear}
          </button>
        ) : null}
        <span className="ml-auto text-[13px] text-ink-500" aria-live="polite">
          {labels.showing.replace("{count}", String(filtered.length)).replace("{total}", String(sites.length))}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="card mt-5 p-8 text-center text-ink-500">{labels.noResults}</p>
      ) : (
        <>
          <div className="card mt-5 hidden overflow-x-auto md:block">
            <table className="table-reg min-w-[760px]">
              <thead>
                <tr>
                  <th className="!pl-5">{labels.siteNo}</th>
                  <th>{labels.dimension}</th>
                  <th>{labels.area}</th>
                  <th>{labels.facing}</th>
                  <th>{labels.road}</th>
                  <th>{labels.status}</th>
                  <th className="text-right">{labels.price}</th>
                  <th className="!pr-5" aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id} className={cn("group transition-colors hover:bg-gold-50", s.status === "sold" && "text-ink-400")}>
                    <td className="!pl-5">
                      <Link href={s.href} className="num font-semibold text-navy-900 hover:underline">
                        {s.refText}
                      </Link>
                      {s.corner ? <span className="badge ml-2 bg-gold-100 text-gold-800">{labels.corner}</span> : null}
                    </td>
                    <td className="num">{s.dimension ? `${s.dimension} ${labels.ft}` : ""}</td>
                    <td className="num">{s.areaSqft ? `${formatNumber(s.areaSqft)} ${labels.sqft}` : ""}</td>
                    <td>{s.facing ? labels.facingLabels[s.facing] : ""}</td>
                    <td className="num">{s.roadWidthFt ? `${s.roadWidthFt} ${labels.ft}` : ""}</td>
                    <td>
                      <ListingStatusBadge status={s.status} label={labels.statusLabels[s.status]} />
                    </td>
                    <td className="num text-right font-semibold text-navy-900">{s.price ? formatINRShort(s.price, locale) : <span className="font-normal text-ink-500">{labels.onRequest}</span>}</td>
                    <td className="!pr-5 text-right">
                      <Link
                        href={s.href}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-[3px] text-navy-800 transition-colors group-hover:bg-navy-800 group-hover:text-gold-200"
                        aria-label={s.refText}
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 md:hidden">
            {shown.map((s) => (
              <li key={s.id}>
                <Link href={s.href} className="card flex flex-col gap-3 p-4 active:bg-gold-50">
                  <span className="flex items-center justify-between gap-2">
                    <span className="ref">{s.refText}</span>
                    <ListingStatusBadge status={s.status} label={labels.statusLabels[s.status]} />
                  </span>
                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    {s.dimension ? (
                      <span className="num text-[16px] font-semibold text-navy-900">
                        {s.dimension} {labels.ft}
                      </span>
                    ) : null}
                    {s.areaSqft ? (
                      <span className="num text-[13.5px] text-ink-600">
                        {formatNumber(s.areaSqft)} {labels.sqft}
                      </span>
                    ) : null}
                    {s.corner ? <span className="badge bg-gold-100 text-gold-800">{labels.corner}</span> : null}
                  </span>
                  <span className="flex items-center justify-between gap-2 border-t border-navy-900/8 pt-3 text-[13.5px] text-ink-600">
                    <span>
                      {s.facing ? labels.facingLabels[s.facing] : ""}
                      {s.facing && s.roadWidthFt ? " · " : ""}
                      {s.roadWidthFt ? `${s.roadWidthFt} ${labels.ft} ${labels.road.toLowerCase()}` : ""}
                    </span>
                    <span className="num font-semibold text-navy-900">{s.price ? formatINRShort(s.price, locale) : labels.onRequest}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {filtered.length > FOLD && !expanded ? (
            <div className="mt-5 text-center">
              <button type="button" onClick={() => setExpanded(true)} className="btn-outline btn-sm">
                {labels.showAll.replace("{total}", String(filtered.length))}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
