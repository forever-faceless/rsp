"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/forms";
import { SubmitButton } from "../ui";

/** Saves a number the office has learnt some other way (a call, a photo of a card) as a lead for this conversation. */
export function LeadFromThread({ action, name }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState>; name: string }) {
  const [state, dispatch] = useActionState(action, undefined);
  return (
    <form action={dispatch} className="space-y-2">
      <input name="name" defaultValue={name} maxLength={80} placeholder="Name" aria-label="Name" autoComplete="off" className="field !py-2 text-[14px]" />
      <input name="phone" type="tel" inputMode="tel" maxLength={16} placeholder="Mobile number" aria-label="Mobile number" autoComplete="off" className="field num !py-2 text-[14px]" />
      {state?.error ? <p className="text-[12.5px] font-medium text-danger-700">{state.error}</p> : null}
      {state?.success ? <p className="text-[12.5px] font-medium text-success-700">{state.success}</p> : null}
      <SubmitButton className="btn-sm" variant="outline">
        Save as a lead
      </SubmitButton>
    </form>
  );
}
