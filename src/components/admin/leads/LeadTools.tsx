"use client";

import { Loader2, Mic, Phone, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { LEAD_KINDS, type LeadKind } from "@/lib/db/enums";
import type { ActionState } from "@/lib/forms";
import { formatPhoneDisplay, telHref } from "@/lib/utils";
import { FormStatus, SubmitButton } from "../ui";
import { CALLED_EVENT } from "./LogForm";

/**
 * Opens the dialler. When the office comes back to this page after the call, the history form
 * opens on "Call" and asks how it went.
 */
export function CallLink({ phone, className }: { phone: string; className?: string }) {
  const called = useRef(false);
  useEffect(() => {
    const back = () => {
      if (document.visibilityState !== "visible" || !called.current) return;
      called.current = false;
      window.dispatchEvent(new Event(CALLED_EVENT));
    };
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, []);
  return (
    <a
      href={telHref(phone)}
      className={className}
      data-call
      onClick={() => {
        called.current = true;
        // On a computer the page never goes away, so ask straight after the click.
        setTimeout(() => {
          if (called.current && document.visibilityState === "visible") {
            called.current = false;
            window.dispatchEvent(new Event(CALLED_EVENT));
          }
        }, 1500);
      }}
    >
      <Phone className="h-4 w-4" aria-hidden="true" /> <span className="num">{formatPhoneDisplay(phone)}</span>
    </a>
  );
}

const MAX_SECONDS = 120;

/** Records a spoken note and files it in the lead's history. */
export function VoiceNote({ leadId }: { leadId: number }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "recording" | "saving">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    recorder.current?.stop();
  };
  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);

  const start = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { audioBitsPerSecond: 16000 });
      const parts: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setPhase("saving");
        const blob = new Blob(parts, { type: rec.mimeType || "audio/webm" });
        const res = await fetch(`/admin/leads/${leadId}/audio`, { method: "POST", headers: { "content-type": blob.type }, body: blob }).catch(() => null);
        setPhase("idle");
        setSeconds(0);
        if (!res?.ok) setError("The recording could not be saved. Try again.");
        else router.refresh();
      };
      recorder.current = rec;
      rec.start();
      setPhase("recording");
      setSeconds(0);
      timer.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setError("The microphone is not available. Allow it for this page and try again.");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3" data-voice-note>
      {phase === "recording" ? (
        <button type="button" onClick={stop} className="btn-danger btn-sm">
          <Square className="h-3.5 w-3.5" aria-hidden="true" /> Stop and save <span className="num">{`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}</span>
        </button>
      ) : (
        <button type="button" onClick={start} disabled={phase === "saving"} className="btn-outline btn-sm">
          {phase === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Mic className="h-3.5 w-3.5" aria-hidden="true" />} Record a spoken note
        </button>
      )}
      <span className="text-[12.5px] text-ink-500">{error || "Up to two minutes. Only people signed in here can play it."}</span>
    </div>
  );
}

type Details = { name: string; kind: LeadKind; purpose: string; budget: string; timeline: string; notes: string };

/** The facts about the person: name, buying or selling, budget, and a note that stays at the top. */
export function LeadDetailsForm({ action, values }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState>; values: Details }) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  return (
    <ActionForm action={dispatch} pending={pending} className="space-y-3.5" data-lead-details>
      <div>
        <label htmlFor="lead-name" className="label">
          Name
        </label>
        <input id="lead-name" name="name" defaultValue={values.name} maxLength={80} className="field" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="lead-kind" className="label">
            Buying or selling
          </label>
          <select id="lead-kind" name="kind" defaultValue={values.kind} className="field">
            {LEAD_KINDS.map((k) => (
              <option key={k} value={k}>
                {k === "sell" ? "Wants to sell" : "Wants to buy"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="lead-purpose" className="label">
            For
          </label>
          <select id="lead-purpose" name="purpose" defaultValue={values.purpose} className="field">
            <option value="">Not said</option>
            <option value="self_use">Own use</option>
            <option value="investment">Investment</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="lead-budget" className="label">
            Budget
          </label>
          <input id="lead-budget" name="budget" defaultValue={values.budget} maxLength={60} className="field" placeholder="25 to 30 lakh" />
        </div>
        <div>
          <label htmlFor="lead-timeline" className="label">
            Buying when
          </label>
          <input id="lead-timeline" name="timeline" defaultValue={values.timeline} maxLength={60} className="field" placeholder="Within 3 months" />
        </div>
      </div>
      <div>
        <label htmlFor="lead-notes" className="label">
          Keep in mind
        </label>
        <textarea id="lead-notes" name="notes" defaultValue={values.notes} rows={3} maxLength={2000} className="field text-[14px]" placeholder="Wants east facing, wife decides, has a loan sanctioned" />
      </div>
      <FormStatus state={state} />
      <SubmitButton className="btn-sm" variant="outline">
        Save details
      </SubmitButton>
    </ActionForm>
  );
}
