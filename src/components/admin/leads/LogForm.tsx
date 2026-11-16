"use client";

import { Footprints, MessageCircle, Phone, StickyNote } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { LEAD_STATUSES, LOST_REASONS, OPEN_LEAD_STATUSES, type ContactOutcome, type LeadKind, type LeadStatus, type LeadTemperature, type NextKind } from "@/lib/db/enums";
import type { ActionState } from "@/lib/forms";
import { LOST_LABEL, NEXT_LABEL, OUTCOME_LABEL, OUTCOMES_FOR, stageLabel, TEMPERATURE_LABEL } from "@/lib/leads/labels";
import { cn } from "@/lib/utils";
import { FormStatus, SubmitButton } from "../ui";

type Kind = "call" | "visit" | "whatsapp" | "note";
const KINDS: { key: Kind; label: string; icon: typeof Phone }[] = [
  { key: "call", label: "Call", icon: Phone },
  { key: "visit", label: "Site visit", icon: Footprints },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "note", label: "Note", icon: StickyNote },
];

/** The event the call button fires, so the form opens on "Call" when the office comes back from the dialler. */
export const CALLED_EVENT = "rsp:called";

const pad = (n: number) => String(n).padStart(2, "0");
/** A moment as the date-and-time box wants it, in Indian time whatever the device is set to. */
function istValue(date: Date): string {
  const d = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
/** `days` from today at a given hour in India, or `hours` from now rounded to the quarter hour. */
function later({ hours, days, at }: { hours?: number; days?: number; at?: number }): string {
  if (hours) {
    const t = Date.now() + hours * 60 * 60 * 1000;
    return istValue(new Date(Math.ceil(t / (15 * 60 * 1000)) * 15 * 60 * 1000));
  }
  const today = istValue(new Date()).slice(0, 10);
  const day = new Date(`${today}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + (days ?? 0));
  return `${day.toISOString().slice(0, 10)}T${pad(at ?? 10)}:00`;
}
const QUICK: { label: string; make: () => string }[] = [
  { label: "In 3 hours", make: () => later({ hours: 3 }) },
  { label: "Tomorrow 10 am", make: () => later({ days: 1, at: 10 }) },
  { label: "Tomorrow 6 pm", make: () => later({ days: 1, at: 18 }) },
  { label: "In 3 days", make: () => later({ days: 3, at: 10 }) },
  { label: "In a week", make: () => later({ days: 7, at: 10 }) },
  { label: "In a month", make: () => later({ days: 30, at: 10 }) },
];

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  lead: { kind: LeadKind; status: LeadStatus; temperature: LeadTemperature; nextKind: NextKind; nextNote: string; nextAt: string };
};

const chip = (on: boolean) =>
  cn("inline-flex min-h-10 items-center gap-1.5 rounded-[3px] border px-3 text-[13.5px] font-semibold transition-colors", on ? "border-navy-900 bg-navy-900 text-gold-200" : "border-navy-900/15 bg-paper-0 text-ink-700 hover:border-navy-800");

/** What happened, where the lead stands now, and what happens next: filled in after every call or visit. */
export function LogForm({ action, lead }: Props) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  const [kind, setKind] = useState<Kind>("call");
  const [outcome, setOutcome] = useState<ContactOutcome | "">("");
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [temperature, setTemperature] = useState<LeadTemperature>(lead.temperature);
  const [nextKind, setNextKind] = useState<NextKind>(lead.nextKind || "call");
  const [nextAt, setNextAt] = useState(lead.nextAt);
  const [nextNote, setNextNote] = useState(lead.nextNote);
  const [text, setText] = useState("");
  const [flash, setFlash] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  // Back from the dialler: open on "Call" and bring the form into view.
  useEffect(() => {
    const open = () => {
      setKind("call");
      setFlash(true);
      box.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener(CALLED_EVENT, open);
    return () => window.removeEventListener(CALLED_EVENT, open);
  }, []);

  // Once saved, the form is ready for the next entry, showing the lead as it now stands.
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.success) {
      setOutcome("");
      setText("");
      setFlash(false);
    }
  }

  const pick = (o: ContactOutcome) => {
    setOutcome(o);
    // A call that did not connect is tried again the same day; the office can change it.
    if (o === "no_answer" || o === "busy") {
      setNextKind("call");
      setNextAt(later({ hours: 3 }));
    }
    if (o === "wrong_number") setStatus("lost");
    if (o === "came") {
      setNextKind("call");
      setNextAt(later({ days: 1, at: 10 }));
    }
  };
  const open = (OPEN_LEAD_STATUSES as readonly string[]).includes(status);
  const errors = state?.fieldErrors ?? {};

  return (
    <div ref={box} className={cn("card scroll-mt-20 p-4 sm:p-5", flash && "ring-2 ring-gold-400")} data-log-form>
      <h2 className="text-[1.15rem] leading-snug">{flash ? "How did the call go?" : "Add to the history"}</h2>
      <ActionForm action={dispatch} pending={pending} className="mt-4 space-y-5">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="outcome" value={outcome} />
        <input type="hidden" name="temperature" value={temperature} />
        <input type="hidden" name="nextKind" value={open ? nextKind : ""} />

        <div className="flex flex-wrap gap-2" role="group" aria-label="What happened">
          {KINDS.map((k) => (
            <button key={k.key} type="button" onClick={() => (setKind(k.key), setOutcome(""))} className={chip(kind === k.key)} aria-pressed={kind === k.key} data-log-kind={k.key}>
              <k.icon className="h-4 w-4" aria-hidden="true" /> {k.label}
            </button>
          ))}
        </div>

        {kind === "call" || kind === "visit" ? (
          <div>
            <p className="label">How did it go?</p>
            <div className="flex flex-wrap gap-2">
              {OUTCOMES_FOR[kind].map((o) => (
                <button key={o} type="button" onClick={() => pick(o)} className={chip(outcome === o)} aria-pressed={outcome === o} data-outcome={o}>
                  {OUTCOME_LABEL[o]}
                </button>
              ))}
            </div>
            {errors.outcome ? <p className="mt-1.5 text-xs font-medium text-danger-700">{errors.outcome}</p> : null}
          </div>
        ) : null}

        <div>
          <label htmlFor="log-text" className="label">
            {kind === "note" ? "Note" : "What was said"}
          </label>
          <textarea
            id="log-text"
            name="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={2000}
            className="field text-[15px]"
            placeholder="Budget, what they liked, who else decides. The microphone on your keyboard types this for you."
          />
          {errors.text ? <p className="mt-1.5 text-xs font-medium text-danger-700">{errors.text}</p> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="log-status" className="label">
              Stage
            </label>
            <select id="log-status" name="status" value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)} className="field">
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {stageLabel(s, lead.kind)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="label">How likely</p>
            <div className="flex gap-2">
              {(["hot", "warm", "cold"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTemperature(temperature === t ? "" : t)} className={cn(chip(temperature === t), "flex-1 justify-center")} aria-pressed={temperature === t} data-temperature={t}>
                  {TEMPERATURE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {status === "lost" ? (
          <div>
            <label htmlFor="log-lost" className="label">
              Why it is lost
            </label>
            <select id="log-lost" name="lostReason" defaultValue="" className={cn("field", errors.lostReason && "field-error")}>
              <option value="">Choose</option>
              {LOST_REASONS.map((r) => (
                <option key={r} value={r}>
                  {LOST_LABEL[r]}
                </option>
              ))}
            </select>
            {errors.lostReason ? <p className="mt-1.5 text-xs font-medium text-danger-700">{errors.lostReason}</p> : null}
          </div>
        ) : null}

        {open ? (
          <div className="rounded-[4px] border border-navy-900/12 bg-paper-100 p-3.5 sm:p-4" data-next-step>
            <p className="label">What happens next</p>
            <div className="flex flex-wrap gap-2">
              {(["call", "visit", "send", "other"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setNextKind(k)} className={chip(nextKind === k)} aria-pressed={nextKind === k} data-next-kind={k}>
                  {NEXT_LABEL[k]}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button key={q.label} type="button" onClick={() => setNextAt(q.make())} className="min-h-9 rounded-[3px] border border-navy-900/15 bg-paper-0 px-2.5 text-[12.5px] font-semibold text-ink-700 hover:border-navy-800" data-quick-time>
                  {q.label}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="log-next-at" className="label">
                  When
                </label>
                <input id="log-next-at" type="datetime-local" name="nextAt" value={nextAt} onChange={(e) => setNextAt(e.target.value)} className={cn("field", errors.nextAt && "field-error")} />
              </div>
              <div>
                <label htmlFor="log-next-note" className="label">
                  About what
                </label>
                <input id="log-next-note" name="nextNote" value={nextNote} onChange={(e) => setNextNote(e.target.value)} maxLength={200} className="field" placeholder="Bring the family, send the khata copy" />
              </div>
            </div>
            {errors.nextAt ? <p className="mt-1.5 text-xs font-medium text-danger-700">{errors.nextAt}</p> : null}
          </div>
        ) : null}

        <FormStatus state={state} />
        <SubmitButton>Save</SubmitButton>
      </ActionForm>
    </div>
  );
}
