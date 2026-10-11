"use client";

import { ChevronRight } from "lucide-react";
import { useActionState } from "react";
import { ActionForm } from "@/components/ActionForm";
import type { ActionState } from "@/lib/forms";
import { FormStatus, SubmitButton } from "../ui";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  post: { id: number; caption: string; when: string; ref: string };
  options: { value: string; label: string }[];
  minWhen: string;
};

/** The caption, time and property of a post that has not gone out yet, folded away until wanted. */
export function ChangePost({ action, post, options, minWhen }: Props) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  return (
    <details className="group mt-3" data-post-change>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-navy-800 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden="true" />
        Change the caption or the time
      </summary>
      <ActionForm action={dispatch} pending={pending} className="mt-3 space-y-3 rounded-[3px] border border-navy-900/12 bg-paper-100 p-3.5">
        <textarea name="caption" defaultValue={post.caption} rows={4} maxLength={2200} aria-label="Caption" className="field text-[14px] leading-relaxed" />
        <div className="grid gap-3 sm:grid-cols-2">
          <input type="datetime-local" name="when" defaultValue={post.when} min={minWhen} aria-label="When it goes out, Indian time" className="field" />
          <select name="ref" defaultValue={post.ref} aria-label="Which property it is about" className="field">
            <option value="">Not about one property</option>
            {post.ref && !options.some((o) => o.value === post.ref) ? <option value={post.ref}>{post.ref}</option> : null}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <FormStatus state={state} />
        <SubmitButton className="btn-sm">Save</SubmitButton>
      </ActionForm>
    </details>
  );
}
