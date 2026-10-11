"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ActionForm";
import type { ActionState } from "@/lib/forms";
import { DEFAULT_TEMPLATES, TEMPLATE_INFO, TEMPLATE_KEYS } from "@/lib/instagram/templates";
import { Checkbox, FormStatus, SubmitButton } from "../ui";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  values: { dmAuto: boolean; commentAuto: boolean; commentAll: boolean; commentWords: string; linkLocale: "en" | "kn"; templates: Record<string, string> };
  defaultWords: string;
};

/** The switches for the automatic replies, and their wording. */
export function InstagramSettingsForm({ action, values, defaultWords }: Props) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  return (
    <ActionForm action={dispatch} pending={pending} className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        <Checkbox label="Answer messages automatically" name="dmAuto" defaultChecked={values.dmAuto} hint="Shared reels, property numbers, price, location and visit questions. Anything else is handed to you. Switch your other reply tool off first." />
        <Checkbox label="Answer comments automatically" name="commentAuto" defaultChecked={values.commentAuto} hint="A short public reply under the comment, and the details by private message. Only comments made after this is switched on." />
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_14rem]">
        <div>
          <label htmlFor="commentWords" className="label">
            Comments that get the details
          </label>
          <textarea id="commentWords" name="commentWords" defaultValue={values.commentWords} rows={2} maxLength={1000} placeholder={defaultWords} className="field text-[14px]" />
          <p className="help">Words separated by commas. Leave blank to use the usual ones shown in grey.</p>
          <div className="mt-2">
            <Checkbox label="Answer every comment on a reel" name="commentAll" defaultChecked={values.commentAll} hint="Not only the ones with these words." />
          </div>
        </div>
        <div>
          <label htmlFor="linkLocale" className="label">
            Language of the links sent
          </label>
          <select id="linkLocale" name="linkLocale" defaultValue={values.linkLocale} className="field">
            <option value="kn">Kannada</option>
            <option value="en">English</option>
          </select>
          <p className="help">Property names and places in replies follow this too.</p>
        </div>
      </div>

      <div className="space-y-5 border-t border-navy-900/8 pt-5">
        <div>
          <h3 className="text-[1.05rem]">Wording of the replies</h3>
          <p className="mt-1 text-[13.5px] text-ink-600">Leave a box empty to use the text shown in grey. Words in braces are filled in when the reply is sent.</p>
        </div>
        {TEMPLATE_KEYS.map((key) => (
          <div key={key}>
            <label htmlFor={`template.${key}`} className="label">
              {TEMPLATE_INFO[key].label}
            </label>
            <p className="mb-1.5 text-[12.5px] text-ink-500">{TEMPLATE_INFO[key].when}</p>
            <textarea
              id={`template.${key}`}
              name={`template.${key}`}
              defaultValue={values.templates[key] ?? ""}
              rows={Math.min(9, DEFAULT_TEMPLATES[key].split("\n").length + 1)}
              maxLength={1000}
              placeholder={DEFAULT_TEMPLATES[key]}
              className="field text-[14px] leading-relaxed"
            />
            <p className="help">
              Can use: <span className="num">{TEMPLATE_INFO[key].fields}</span>
            </p>
          </div>
        ))}
      </div>

      <FormStatus state={state} />
      <SubmitButton>Save</SubmitButton>
    </ActionForm>
  );
}

/** A button that runs a check or a sync and says how it went. */
export function StatusButton({ action, children }: { action: () => Promise<ActionState>; children: React.ReactNode }) {
  const [state, dispatch] = useActionState(action, undefined);
  return (
    <form action={dispatch} className="flex flex-wrap items-center gap-3">
      <SubmitButton className="btn-sm" variant="outline">
        {children}
      </SubmitButton>
      {state?.success ? <span className="text-[13.5px] font-medium text-success-700">{state.success}</span> : null}
      {state?.error ? <span className="text-[13.5px] font-medium text-danger-700">{state.error}</span> : null}
    </form>
  );
}
