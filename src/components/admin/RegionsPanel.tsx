"use client";

import { Plus } from "lucide-react";
import { useActionState } from "react";
import { addRegion, deleteRegion, updateRegion } from "@/lib/actions/regions";
import type { Region } from "@/lib/db/schema";
import type { ActionState } from "@/lib/forms";
import { formatPropertyNo } from "@/lib/refs";
import { ConfirmButton, FormStatus, Input, Section, SubmitButton } from "./ui";
import { ActionForm } from "@/components/ActionForm";

type Props = { regions: Region[]; mainCode: string; usage: Record<string, number> };

function RegionRow({ region, isMain, used }: { region: Region; isMain: boolean; used: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateRegion.bind(null, region.code), undefined);
  const e = state?.fieldErrors ?? {};
  return (
    <li className="border-t border-navy-900/10 py-4 first:border-t-0 first:pt-0">
      <ActionForm action={action} pending={pending} className="grid gap-3 sm:grid-cols-[6rem_1fr_1fr_auto] sm:items-end">
        <div>
          <p className="label">Code</p>
          <p className="field num !bg-paper-100">{region.code}</p>
        </div>
        <Input label="District (English)" name="nameEn" defaultValue={region.nameEn} error={e.nameEn} placeholder="Hassan" />
        <Input label="District (ಕನ್ನಡ)" name="nameKn" defaultValue={region.nameKn} error={e.nameKn} lang="kn" />
        <div className="flex gap-2 sm:pb-[1px]">
          <SubmitButton variant="outline" className="btn-sm">
            Save
          </SubmitButton>
          {!isMain && used === 0 ? <ConfirmButton action={deleteRegion.bind(null, region.code)} label="Remove" confirmLabel="Remove this district" icon={false} /> : null}
        </div>
        <div className="num text-[12.5px] text-ink-500 sm:col-span-4">
          {isMain ? "Main district · " : ""}
          {used === 1 ? "1 listing" : `${used} listings`} · next number {formatPropertyNo(region.code, region.nextNo)}
          {state?.success ? <span className="ml-3 text-success-700">{state.success}</span> : null}
          {state?.error && !state.fieldErrors ? <span className="ml-3 text-danger-700">{state.error}</span> : null}
        </div>
      </ActionForm>
    </li>
  );
}

function AddRegion() {
  const [state, action, pending] = useActionState<ActionState, FormData>(addRegion, undefined);
  const e = state?.fieldErrors ?? {};
  return (
    <ActionForm action={action} pending={pending} className="mt-6 border-t border-navy-900/10 pt-5">
      <p className="label-mono mb-3 !text-navy-800">Add a district</p>
      <FormStatus state={state} />
      <div className="grid gap-3 sm:grid-cols-[6rem_1fr_1fr_auto] sm:items-end">
        <Input label="Code" name="code" placeholder="MYS" maxLength={5} error={e.code} className="num uppercase" autoCapitalize="characters" autoComplete="off" hint="3 letters works best." />
        <Input label="District (English)" name="nameEn" placeholder="Mysuru" error={e.nameEn} />
        <Input label="District (ಕನ್ನಡ)" name="nameKn" placeholder="ಮೈಸೂರು" error={e.nameKn} lang="kn" />
        <SubmitButton className="btn-sm sm:mb-[22px]">
          <Plus className="h-4 w-4" aria-hidden="true" /> Add
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

/**
 * The district registers. Each code heads its own run of property numbers, so Hassan and
 * Mysuru count separately: HSN-0001, HSN-0002 and MYS-0001, MYS-0002.
 */
export function RegionsPanel({ regions, mainCode, usage }: Props) {
  return (
    <Section id="districts" title="Districts" description="Add a district with a short code of your own, such as MYS for Mysuru. Each district has its own run of numbers. A code cannot be changed or removed once a listing carries it.">
      <ul>
        {regions.map((r) => (
          <RegionRow key={r.code} region={r} isMain={r.code === mainCode} used={usage[r.code] ?? 0} />
        ))}
      </ul>
      <AddRegion />
    </Section>
  );
}
