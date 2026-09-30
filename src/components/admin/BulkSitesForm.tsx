"use client";

import { useActionState } from "react";
import { FACINGS, LISTING_STATUSES } from "@/lib/db/enums";
import type { ActionState } from "@/lib/forms";
import { en } from "@/lib/i18n/dictionaries/en";
import { MeasureInput } from "./MeasureInput";
import { Checkbox, FormStatus, Input, Select, SubmitButton } from "./ui";
import { ActionForm } from "@/components/ActionForm";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** Creates a run of sites that share their size, facing and rate, which is how most layouts are laid out. */
export function BulkSitesForm({ action, from }: { action: Action; from: number }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);
  return (
    <ActionForm action={formAction} pending={pending} className="space-y-5">
      <FormStatus state={state} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input label="From site number" name="from" type="number" min="1" inputMode="numeric" defaultValue={from} required className="num" />
        <Input label="To site number" name="to" type="number" min="1" inputMode="numeric" defaultValue={from + 9} required className="num" />
        <MeasureInput label="Width" name="widthFt" defaultValue={30} />
        <MeasureInput label="Depth" name="depthFt" defaultValue={40} />
        <Select label="Facing" name="facing" defaultValue="" options={[{ value: "", label: "Not specified" }, ...FACINGS.map((f) => ({ value: f, label: en.facing[f] }))]} />
        <MeasureInput label="Road in front" name="roadWidthFt" defaultValue={30} />
        <Input label="Rate per sq ft (₹)" name="pricePerSqft" type="number" min="0" inputMode="numeric" hint="The price is worked out from the area." />
        <Select label="Availability" name="status" defaultValue="available" options={LISTING_STATUSES.map((s) => ({ value: s, label: en.status.listing[s] }))} />
      </div>
      <Checkbox label="Show “Call for price” for these sites" name="callForPrice" hint="The rate is kept for your own reference and is not shown to visitors." />
      <p className="text-[13px] text-ink-600">Numbers that already exist are skipped, so it is safe to run this again for a range that is partly filled.</p>
      <SubmitButton variant="outline">Create these sites</SubmitButton>
    </ActionForm>
  );
}
