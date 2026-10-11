"use client";

import { Loader2, Send } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import type { ActionState } from "@/lib/forms";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Ready-made replies, filled in for this conversation. */
  quick: { label: string; text: string }[];
  /** False once Instagram's 24 hours have passed. */
  open: boolean;
  closedNote: string;
};

/** Where the office writes back. A ready-made reply can be dropped in and changed before sending. */
export function ReplyBox({ action, quick, open, closedNote }: Props) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  const [text, setText] = useState("");
  const sent = useRef<ActionState>(undefined);
  useEffect(() => {
    // Empty the box once a message has gone.
    if (state?.success && sent.current !== state) {
      sent.current = state;
      setText("");
    }
  }, [state]);

  if (!open) return <p className="rounded-[3px] border border-navy-900/15 bg-navy-50 px-4 py-3 text-[14px] text-navy-800">{closedNote}</p>;

  return (
    <form action={dispatch} className="space-y-3" data-reply-box>
      <div className="flex flex-wrap gap-1.5">
        {quick.map((q) => (
          <button key={q.label} type="button" onClick={() => setText(q.text)} className="rounded-[3px] border border-navy-900/15 bg-paper-0 px-2.5 py-1.5 text-[12.5px] font-semibold text-navy-800 hover:border-navy-800">
            {q.label}
          </button>
        ))}
      </div>
      <textarea name="text" value={text} onChange={(ev) => setText(ev.target.value)} rows={4} maxLength={1000} placeholder="Write a reply" aria-label="Reply" className="field text-[15px]" />
      {state?.error ? (
        <p className="rounded-[3px] border border-danger-600/25 bg-danger-100 px-3 py-2 text-[13.5px] font-medium text-danger-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <span className="num text-[12px] text-ink-400">{text.length} / 1000</span>
        <button type="submit" disabled={pending || !text.trim()} className="btn-primary">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
          Send
        </button>
      </div>
    </form>
  );
}
