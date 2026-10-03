"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import type { ActionState } from "@/lib/forms";
import { LEAD_CHANNELS } from "@/lib/lead-sources";
import { cn } from "@/lib/utils";
import { FormStatus, Input, Select, SubmitButton, Textarea } from "./ui";

type Option = { value: string; label: string };
type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Listings grouped for the "which property" picker. */
  subjects: { label: string; options: Option[] }[];
  budgets: string[];
  timelines: string[];
};

const notSaid = { value: "", label: "Not said" };

/** A lead the office adds by hand. Only the number is required; the rest can be filled in later on the list. */
export function LeadForm({ action, subjects, budgets, timelines }: Props) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  const [kind, setKind] = useState<"buy" | "sell">("buy");
  const errors = state?.fieldErrors ?? {};
  const buying = kind === "buy";

  return (
    <ActionForm action={dispatch} pending={pending} className="space-y-5" noValidate>
      <fieldset>
        <legend className="label">They want to</legend>
        <div className="mt-1 inline-flex rounded-[3px] border border-navy-900/15 bg-paper-0 p-0.5">
          {(
            [
              ["buy", "Buy"],
              ["sell", "Sell"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={cn(
                "cursor-pointer rounded-[2px] px-4 py-2 text-[14px] font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold-500",
                kind === value ? "bg-navy-900 text-gold-200" : "text-navy-800 hover:bg-navy-900/6",
              )}
            >
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Name" name="name" maxLength={80} autoComplete="off" />
        <Input
          label="Mobile number"
          name="phone"
          type="tel"
          inputMode="tel"
          maxLength={20}
          autoComplete="off"
          placeholder="98765 43210"
          className="num"
          error={errors.phone}
          hint="A number from abroad starts with +, for example +971 50 123 4567."
        />
        <Select label="How they came to you" name="channel" defaultValue="instagram" options={LEAD_CHANNELS.map(([value, label]) => ({ value, label }))} />
        <Input label="Email" name="email" type="email" maxLength={120} autoComplete="off" error={errors.email} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="about" className="label">
            {buying ? "Which property they asked about" : "Their listing, once it is up"}
          </label>
          <select id="about" name="about" defaultValue="" className="field">
            <option value="">{buying ? "None in particular" : "Not listed yet"}</option>
            {subjects.map((group) =>
              group.options.length ? (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ) : null,
            )}
          </select>
        </div>
        <Select
          label="They speak"
          name="locale"
          defaultValue="en"
          options={[
            { value: "en", label: "English" },
            { value: "kn", label: "Kannada" },
          ]}
        />
      </div>

      {buying ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Select
            label="What it is for"
            name="purpose"
            defaultValue=""
            options={[notSaid, { value: "self_use", label: "Own use" }, { value: "investment", label: "Investment" }, { value: "other", label: "Other" }]}
          />
          <Select label="Budget" name="budget" defaultValue="" options={[notSaid, ...budgets.map((b) => ({ value: b, label: b }))]} />
          <Select label="How soon" name="timeline" defaultValue="" options={[notSaid, ...timelines.map((t) => ({ value: t, label: t }))]} />
        </div>
      ) : null}

      <Textarea
        label={buying ? "What they said" : "About their property"}
        name="message"
        maxLength={1500}
        rows={3}
        placeholder={buying ? "What they asked, what they are looking for" : "Where it is, the size, the price they expect"}
      />

      <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
        <Select
          label="Status"
          name="status"
          defaultValue="new"
          options={[
            { value: "new", label: "New" },
            { value: "contacted", label: "Contacted" },
            { value: "qualified", label: "Qualified" },
            { value: "closed", label: "Closed" },
          ]}
        />
        <Input label="Follow-up notes" name="notes" maxLength={2000} autoComplete="off" placeholder="Call back on Saturday, sent to the advocate" />
      </div>

      <FormStatus state={state} />
      <SubmitButton>Add lead</SubmitButton>
    </ActionForm>
  );
}
