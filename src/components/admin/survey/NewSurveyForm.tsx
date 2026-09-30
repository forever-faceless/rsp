"use client";

import { useActionState } from "react";
import { createSurvey } from "@/lib/actions/surveys";
import type { ActionState } from "@/lib/forms";
import { FormStatus, Input, SubmitButton } from "../ui";
import type { SurveyTargetChoice } from "./SurveyTool";
import { ActionForm } from "@/components/ActionForm";

const groups = ["Properties", "Projects", "Sites"] as const;

export function NewSurveyForm({ targets, preselected }: { targets: SurveyTargetChoice[]; preselected: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createSurvey, undefined);
  return (
    <ActionForm action={action} pending={pending} className="space-y-5">
      <FormStatus state={state} />
      <Input label="Name of this survey" name="title" placeholder="Corner site near Dairy Circle" maxLength={140} hint="Something you will recognise later. It can be changed." autoFocus />
      <div>
        <label htmlFor="target" className="label">
          Which listing is it for?
        </label>
        <select id="target" name="target" defaultValue={preselected} className="field">
          <option value="">A new property, not listed yet</option>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {targets
                .filter((t) => t.group === g)
                .map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.refText} · {t.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <p className="help">For a new property, leave this as it is. You can turn the survey into a listing once it is done.</p>
      </div>
      <SubmitButton className="w-full sm:w-auto">Start the survey</SubmitButton>
    </ActionForm>
  );
}
