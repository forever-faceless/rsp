"use client";

import { Pencil, Plus, X } from "lucide-react";
import { useActionState, useState } from "react";
import { LANDMARK_CATEGORIES } from "@/lib/db/enums";
import type { Landmark } from "@/lib/db/schema";
import type { ActionState } from "@/lib/forms";
import { estimateDriveMinutes, formatDistance, haversineKm } from "@/lib/geo";
import { en } from "@/lib/i18n/dictionaries/en";
import { CoordinateFields } from "./CoordinateFields";
import { ConfirmButton, FormStatus, Input, Select, SubmitButton } from "./ui";
import { ActionForm } from "@/components/ActionForm";

type Props = {
  landmarks: Landmark[];
  origin: { lat: number; lng: number } | null;
  saveAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  deleteAction: (id: number) => Promise<void>;
};

export function LandmarkEditor({ landmarks, origin, saveAction, deleteAction }: Props) {
  const [editing, setEditing] = useState<Landmark | null>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveAction, undefined);
  const [seenState, setSeenState] = useState<ActionState>(state);
  const [round, setRound] = useState(0);
  if (state !== seenState) {
    // After a successful save, leave edit mode and start a fresh blank form.
    setSeenState(state);
    if (state?.success) {
      setEditing(null);
      setRound((n) => n + 1);
    }
  }
  const e = state?.fieldErrors ?? {};

  return (
    <div className="space-y-6">
      {landmarks.length ? (
        <ul className="divide-y divide-navy-900/8 rounded-[4px] border border-navy-900/12 bg-paper-0">
          {landmarks.map((l) => {
            const km = origin ? haversineKm(origin.lat, origin.lng, l.lat, l.lng) : null;
            return (
              <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold text-navy-900">
                    {l.nameEn} {l.nameKn ? <span className="font-normal text-ink-500">· {l.nameKn}</span> : null}
                  </p>
                  <p className="num text-xs text-ink-500">
                    {en.landmark[l.category]} · {l.lat.toFixed(5)}, {l.lng.toFixed(5)}
                    {km != null ? ` · ${formatDistance(km, "en")} · ${l.driveMinutes ?? estimateDriveMinutes(km)} min${l.driveMinutes ? "" : " (estimated)"}` : ""}
                  </p>
                </div>
                <button type="button" onClick={() => setEditing(l)} className="btn-outline btn-sm">
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                </button>
                <ConfirmButton action={() => deleteAction(l.id)} label="Remove" confirmLabel="Confirm" />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13.5px] text-ink-600">No landmarks yet. Add the bus stand, railway station, hospital, highway and schools nearby. Distances are worked out automatically.</p>
      )}

      <ActionForm key={`${editing?.id ?? "new"}-${round}`} action={formAction} pending={pending} className="space-y-5 rounded-[4px] border border-navy-900/12 bg-paper-50 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-[14.5px] font-semibold text-navy-900">{editing ? `Edit “${editing.nameEn}”` : "Add a landmark"}</h3>
          {editing ? (
            <button type="button" onClick={() => setEditing(null)} className="btn-ghost btn-sm">
              <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancel
            </button>
          ) : null}
        </div>
        <FormStatus state={state} />
        <input type="hidden" name="id" value={editing?.id ?? 0} />
        <div className="grid gap-4 md:grid-cols-3">
          <Input label="Name (English)" name="nameEn" required defaultValue={editing?.nameEn} error={e.nameEn} placeholder="KSRTC Bus Stand" />
          <Input label="Name (ಕನ್ನಡ)" name="nameKn" defaultValue={editing?.nameKn} lang="kn" />
          <Select label="Type" name="category" defaultValue={editing?.category ?? "other"} options={LANDMARK_CATEGORIES.map((c) => ({ value: c, label: en.landmark[c] }))} />
        </div>
        <CoordinateFields lat={editing?.lat ?? null} lng={editing?.lng ?? null} label="Where the landmark is" required />
        <Input label="Drive time in minutes (optional)" name="driveMinutes" type="number" min="0" inputMode="numeric" defaultValue={editing?.driveMinutes ?? ""} hint="Leave blank to estimate it from the distance." wrapperClassName="max-w-xs" />
        <SubmitButton variant="outline">
          <Plus className="h-4 w-4" aria-hidden="true" /> {editing ? "Save landmark" : "Add landmark"}
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
