"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Phone } from "lucide-react";
import { useActionState, useState } from "react";
import { submitEnquiry, type EnquiryState } from "@/lib/actions/enquiry";
import { LEAD_PURPOSES } from "@/lib/db/enums";
import { fill, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { cn, formatPhoneDisplay, telHref, whatsappHref } from "@/lib/utils";
import { CloseEnquiryLink } from "./EnquireOverlay";
import type { EnquirySubject } from "./EnquiryForm";
import { WhatsAppIcon } from "./PhoneLinks";
import { ActionForm } from "@/components/ActionForm";

type Props = {
  locale: Locale;
  t: Dictionary["interest"];
  e: Dictionary["enquiry"];
  whatsappLabel: string;
  subject: EnquirySubject & { ref: string };
  phone: string;
  whatsapp: string;
  source: string;
  detailsHref: string;
};

const initial: EnquiryState = { status: "idle" };

/** One question answered by tapping, as a row of choices. Each choice is an ordinary radio button. */
function Choices({ name, legend, note, options, value, onChange }: { name: string; legend: string; note?: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="label">
        {legend}
        {note ? <span className="ml-1.5 font-normal text-ink-400">({note})</span> : null}
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value === o.value;
          return (
            <label
              key={o.value}
              className={cn(
                "cursor-pointer select-none rounded-[3px] border px-3.5 py-2.5 text-[14px] font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold-500",
                on ? "border-navy-900 bg-navy-900 text-gold-200" : "border-navy-900/15 bg-paper-0 text-navy-800 hover:border-navy-800",
              )}
            >
              <input type="radio" name={name} value={o.value} checked={on} onChange={() => onChange(o.value)} className="sr-only" />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * The quick enquiry for one listing, in two short steps: three questions answered by tapping,
 * then a name and a number. The answers come first because they cost nothing to give; by the
 * time the number is asked for, the visitor has already said what they want.
 */
export function InterestForm({ locale, t, e, whatsappLabel, subject, phone, whatsapp, source, detailsHref }: Props) {
  const [state, action, pending] = useActionState(submitEnquiry, initial);
  const [step, setStep] = useState<1 | 2>(1);
  const [purpose, setPurpose] = useState("");
  const [timeline, setTimeline] = useState("");
  const [budget, setBudget] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [consent, setConsent] = useState(true);
  const [nudge, setNudge] = useState(false);

  if (state.status === "success") {
    return (
      <div className="py-2" role="status">
        <CheckCircle2 className="h-10 w-10 text-success-600" aria-hidden="true" />
        <h3 className="mt-4 text-[1.4rem] leading-snug">{t.successTitle}</h3>
        <p className="mt-2 text-[15px] text-ink-700">{fill(t.successText, { ref: subject.ref })}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {phone ? (
            <a href={telHref(phone)} className="btn-primary">
              <Phone className="h-4 w-4" aria-hidden="true" /> <span className="num">{formatPhoneDisplay(phone)}</span>
            </a>
          ) : null}
          {whatsapp ? (
            <a href={whatsappHref(whatsapp, fill(e.whatsappPrefill, { subject: subject.label }))} target="_blank" rel="noopener noreferrer" className="btn-outline">
              <WhatsAppIcon /> {whatsappLabel}
            </a>
          ) : null}
        </div>
        <CloseEnquiryLink href={detailsHref} className="link-arrow mt-6 inline-flex">
          {t.viewDetails} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </CloseEnquiryLink>
      </div>
    );
  }

  const error = state.status === "error" ? state.code : null;
  const errorText =
    error === "invalid_phone" ? e.invalidPhone : error === "invalid_name" ? e.invalidName : error === "consent_required" ? e.consentRequired : error === "too_many" ? e.tooMany : error ? e.errorGeneric : null;
  const ready = Boolean(purpose && timeline);

  return (
    <ActionForm action={action} pending={pending} className="relative" noValidate>
      <input type="hidden" name="kind" value="buy" />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="ref" value={subject.ref} />
      {subject.propertyId ? <input type="hidden" name="propertyId" value={subject.propertyId} /> : null}
      {subject.siteId ? <input type="hidden" name="siteId" value={subject.siteId} /> : null}
      {subject.projectId ? <input type="hidden" name="projectId" value={subject.projectId} /> : null}
      {/* Honeypot: hidden from people, filled by bots. */}
      <div className="absolute -left-[9999px] top-0" aria-hidden="true">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <p className="label-mono" aria-live="polite">
        {fill(t.step, { n: String(step) })}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-1.5" aria-hidden="true">
        <span className="h-1 rounded-full bg-gold-500" />
        <span className={cn("h-1 rounded-full", step === 2 ? "bg-gold-500" : "bg-navy-900/10")} />
      </div>

      {/* Step one stays in the form while hidden, so its answers are sent with step two. */}
      <div hidden={step !== 1} className="mt-6 space-y-6" data-step="1">
        <div>
          <h3 className="text-[1.2rem] leading-snug">{t.qualifyTitle}</h3>
          <p className="mt-1 text-[14px] text-ink-600">{t.qualifyText}</p>
        </div>
        <Choices name="purpose" legend={t.purposeQ} value={purpose} onChange={setPurpose} options={LEAD_PURPOSES.map((p) => ({ value: p, label: e.purposes[p] }))} />
        <Choices name="timeline" legend={t.timelineQ} value={timeline} onChange={setTimeline} options={e.timelines.map((x) => ({ value: x, label: x }))} />
        <Choices name="budget" legend={t.budgetQ} note={t.optional} value={budget} onChange={setBudget} options={e.budgets.map((x) => ({ value: x, label: x }))} />
        {nudge && !ready ? (
          <p className="text-[14px] font-medium text-danger-700" role="alert">
            {t.chooseOne}
          </p>
        ) : null}
        <button
          type="button"
          className="btn-primary w-full sm:w-auto sm:min-w-44"
          onClick={() => {
            if (!ready) return setNudge(true);
            setStep(2);
          }}
        >
          {t.next} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div hidden={step !== 2} className="mt-6 space-y-4" data-step="2">
        <div>
          <h3 className="text-[1.2rem] leading-snug">{t.detailsTitle}</h3>
          <p className="mt-1 text-[14px] text-ink-600">{t.detailsText}</p>
        </div>
        <div>
          <label htmlFor="int-name" className="label">
            {e.name} <span className="text-danger-600">*</span>
          </label>
          <input id="int-name" name="name" value={name} onChange={(ev) => setName(ev.target.value)} autoComplete="name" maxLength={80} className={cn("field", error === "invalid_name" && "field-error")} />
        </div>
        <div>
          <label htmlFor="int-phone" className="label">
            {e.phone} <span className="text-danger-600">*</span>
          </label>
          <input
            id="int-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="98765 43210"
            value={mobile}
            onChange={(ev) => setMobile(ev.target.value)}
            maxLength={16}
            className={cn("field num", error === "invalid_phone" && "field-error")}
          />
          <p className="help">{e.phoneHint}</p>
        </div>
        <label className="flex items-start gap-3 text-[14px] text-ink-700">
          <input type="checkbox" name="consent" checked={consent} onChange={(ev) => setConsent(ev.target.checked)} className="check" />
          <span>{e.consent}</span>
        </label>
        {errorText ? (
          <p className="rounded-[3px] border border-danger-600/25 bg-danger-100 px-4 py-3 text-[14px] font-medium text-danger-700" role="alert">
            {errorText}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:items-center">
          <button type="button" onClick={() => setStep(1)} className="btn-ghost">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t.back}
          </button>
          <button type="submit" disabled={pending} className="btn-primary sm:min-w-52">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {pending ? e.submitting : t.submit}
          </button>
        </div>
      </div>
    </ActionForm>
  );
}
