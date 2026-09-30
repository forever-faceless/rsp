"use client";

import { MapPinned, Pencil } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { ListingStatusBadge } from "@/components/site/StatusBadge";
import { LISTING_STATUSES, type ListingStatus } from "@/lib/db/enums";
import type { Site } from "@/lib/db/schema";
import { en } from "@/lib/i18n/dictionaries/en";
import { formatSiteRef } from "@/lib/refs";
import { cn, formatINRShort, formatNumber } from "@/lib/utils";

type Props = {
  projectId: number;
  projectNo: number;
  prefix: string;
  sites: Site[];
  /** Ids of the sites whose boundary has been surveyed. */
  surveyed: number[];
  setStatusAction: (id: number, status: ListingStatus) => Promise<void>;
  bulkAction: (formData: FormData) => Promise<void>;
};

export function SitesTable({ projectId, projectNo, prefix, sites, surveyed, setStatusAction, bulkAction }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();
  const allSelected = sites.length > 0 && selected.size === sites.length;
  const plotted = new Set(surveyed);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <form action={bulkAction} className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-navy-900/8 bg-paper-50 px-4 py-3 text-[14px]">
        <label className="inline-flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(sites.map((s) => s.id)))} className="check !mt-0" />
          Select all
        </label>
        <span className="num text-ink-500">{selected.size} selected</span>
        <div className="ml-auto flex items-center gap-2">
          <select name="status" className="field !w-auto !py-1.5 text-[13.5px]" defaultValue="available" aria-label="New status">
            {LISTING_STATUSES.map((s) => (
              <option key={s} value={s}>
                Mark as {en.status.listing[s].toLowerCase()}
              </option>
            ))}
          </select>
          <button type="submit" disabled={selected.size === 0} className="btn-primary btn-sm">
            Apply
          </button>
        </div>
      </div>
      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name="siteId" value={id} />
      ))}
      <div className="overflow-x-auto">
        <table className="table-reg min-w-[860px]">
          <thead>
            <tr>
              <th className="w-10 !pl-4" />
              <th>Number</th>
              <th>Dimensions</th>
              <th>Area</th>
              <th>Facing</th>
              <th>Price</th>
              <th>Status</th>
              <th>Survey</th>
              <th className="!pr-4" />
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id} className={cn(selected.has(s.id) && "bg-gold-50")}>
                <td className="!pl-4">
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="check !mt-0" aria-label={`Select site ${s.siteNo}`} />
                </td>
                <td className="num font-semibold text-navy-900">
                  {formatSiteRef(prefix, projectNo, s.siteNo)}
                  {s.corner ? <span className="badge ml-2 bg-gold-100 text-gold-800">Corner</span> : null}
                </td>
                <td className="num">{s.dimension}</td>
                <td className="num">{s.areaSqft ? `${formatNumber(s.areaSqft)} sq ft` : ""}</td>
                <td>{s.facing ? en.facing[s.facing] : ""}</td>
                <td className="num">
                  {s.price ? formatINRShort(s.price) : ""}
                  {s.callForPrice ? <span className="ml-1.5 font-sans text-[11px] text-ink-500">on call</span> : null}
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <ListingStatusBadge status={s.status} label={en.status.listing[s.status]} />
                    <select
                      value={s.status}
                      disabled={pending}
                      onChange={(e) => start(() => setStatusAction(s.id, e.target.value as ListingStatus))}
                      className="field !w-auto !py-1 !pl-2 !pr-8 text-xs"
                      aria-label={`Change status of site ${s.siteNo}`}
                    >
                      {LISTING_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {en.status.listing[st]}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td>
                  {plotted.has(s.id) ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success-700">
                      <MapPinned className="h-3.5 w-3.5" aria-hidden="true" /> Plotted
                    </span>
                  ) : (
                    <span className="text-xs text-ink-400">Not yet</span>
                  )}
                </td>
                <td className="!pr-4 text-right">
                  <Link href={`/admin/projects/${projectId}/sites/${s.id}`} className="btn-outline btn-sm">
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}
