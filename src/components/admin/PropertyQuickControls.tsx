"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTransition } from "react";
import { setPropertyPublished, setPropertyStatus } from "@/lib/actions/properties";
import { LISTING_STATUSES, type ListingStatus } from "@/lib/db/enums";
import { en } from "@/lib/i18n/dictionaries/en";

/** Change availability or hide a listing straight from the list, which is what a phone call usually requires. */
export function PropertyQuickControls({ id, status, published }: { id: number; status: ListingStatus; published: boolean }) {
  const [pending, start] = useTransition();
  return (
    <>
      <select
        value={status}
        disabled={pending}
        onChange={(e) => start(() => setPropertyStatus(id, e.target.value as ListingStatus))}
        className="field !w-auto !py-1.5 !pl-2.5 !pr-8 text-[13px]"
        aria-label="Availability"
      >
        {LISTING_STATUSES.map((s) => (
          <option key={s} value={s}>
            {en.status.listing[s]}
          </option>
        ))}
      </select>
      <button type="button" disabled={pending} onClick={() => start(() => setPropertyPublished(id, !published))} className="btn-ghost btn-sm" aria-label={published ? "Hide from the website" : "Publish on the website"} title={published ? "Hide from the website" : "Publish on the website"}>
        {published ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4 text-ink-400" aria-hidden="true" />}
      </button>
    </>
  );
}
