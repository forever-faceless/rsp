"use client";

import { CheckCircle2, Loader2, Phone } from "lucide-react";
import { useActionState } from "react";
import { submitEnquiry, type EnquiryState } from "@/lib/actions/enquiry";
import type { LeadPurpose } from "@/lib/db/enums";
import { fill, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { cn, formatPhoneDisplay, telHref, whatsappHref } from "@/lib/utils";
import { WhatsAppIcon } from "./PhoneLinks";
import { ActionForm } from "@/components/ActionForm";

export type EnquirySubject = {
  /** Property number shown to the visitor and stored with the lead, for example HSN-0034(012). */
  ref?: string;
  /** Plain description used in the WhatsApp message, for example "HSN-0007, corner site on Salagame Road". */
  label: string;
  projectId?: number | null;
  siteId?: number | null;
  propertyId?: number | null;
};

export type EnquiryFormProps = {
  locale: Locale;
  t: Dictionary["enquiry"];
  whatsappLabel: string;
  projects: { id: number; name: string }[];
  subject: EnquirySubject;
  phone: string;
  whatsapp: string;
  source: string;
  /** Single column, fewer optional questions. Used in the sidebar of a property page. */
  compact?: boolean;
  tone?: "light" | "dark";
};

const initial: EnquiryState = { status: "idle" };

export function EnquiryForm({ locale, t, whatsappLabel, projects, subject, phone, whatsapp, source, compact, tone = "light" }: EnquiryFormProps) {
  const [state, action, pending] = useActionState(submitEnquiry, initial);
  const dark = tone === "dark";
  const fixed = Boolean(subject.ref);

  if (state.status === "success") {
    return (
      <div className={cn("rounded-[4px] border p-6 sm:p-8", dark ? "border-gold-300/30 bg-navy-950/40" : "border-success-600/25 bg-success-100/70")} role="status">
        <CheckCircle2 className={cn("h-9 w-9", dark ? "text-gold-300" : "text-success-600")} aria-hidden="true" />
        <h3 className={cn("mt-4 text-[1.35rem] leading-snug", dark && "!text-paper-50")}>{t.successTitle}</h3>
        <p className={cn("mt-2 text-[15px]", dark ? "text-navy-200" : "text-ink-700")}>{t.successText}</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {phone ? (
            <a href={telHref(phone)} className={dark ? "btn-gold" : "btn-primary"}>
              <Phone className="h-4 w-4" aria-hidden="true" /> <span className="num">{formatPhoneDisplay(phone)}</span>
            </a>
          ) : null}
          {whatsapp ? (
            <a href={whatsappHref(whatsapp, fill(t.whatsappPrefill, { subject: subject.label }))} target="_blank" rel="noopener noreferrer" className={dark ? "btn-outline-light" : "btn-outline"}>
              <WhatsAppIcon /> {whatsappLabel}
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  const error = state.status === "error" ? state.code : null;
  const errorText =
    error === "invalid_phone" ? t.invalidPhone : error === "invalid_name" ? t.invalidName : error === "consent_required" ? t.consentRequired : error === "too_many" ? t.tooMany : error ? t.errorGeneric : null;

  const purposes: LeadPurpose[] = ["self_use", "investment", "other"];
  const label = cn("label", dark && "!text-navy-100");
  const field = cn("field", dark && "border-paper-0/15 !bg-navy-950/50 !text-paper-50 placeholder:!text-navy-400 focus:!border-gold-400");
  const two = cn("grid gap-4", !compact && "sm:grid-cols-2");

  return (
    <ActionForm action={action} pending={pending} className="relative space-y-4" noValidate>
      <input type="hidden" name="kind" value="buy" />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="ref" value={subject.ref ?? ""} />
      {subject.siteId ? <input type="hidden" name="siteId" value={subject.siteId} /> : null}
      {subject.propertyId ? <input type="hidden" name="propertyId" value={subject.propertyId} /> : null}
      {/* Honeypot: hidden from people, filled by bots. */}
      <div className="absolute -left-[9999px] top-0" aria-hidden="true">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className={two}>
        <div>
          <label htmlFor="enq-name" className={label}>
            {t.name} <span className="text-danger-600">*</span>
          </label>
          <input id="enq-name" name="name" required autoComplete="name" className={cn(field, error === "invalid_name" && "field-error")} maxLength={80} />
        </div>
        <div>
          <label htmlFor="enq-phone" className={label}>
            {t.phone} <span className="text-danger-600">*</span>
          </label>
          <input
            id="enq-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="98765 43210"
            className={cn(field, "num", error === "invalid_phone" && "field-error")}
            maxLength={16}
            aria-describedby="enq-phone-hint"
          />
          {!compact ? (
            <p id="enq-phone-hint" className={cn("help", dark && "!text-navy-300")}>
              {t.phoneHint}
            </p>
          ) : null}
        </div>
      </div>

      <div className={two}>
        <div>
          <label htmlFor="enq-interest" className={label}>
            {t.interest}
          </label>
          {fixed ? (
            <>
              {subject.projectId ? <input type="hidden" name="projectId" value={subject.projectId} /> : null}
              <div id="enq-interest" className={cn(field, "num flex items-center", dark ? "!bg-navy-950/70" : "!bg-paper-100")}>
                {subject.ref}
              </div>
            </>
          ) : (
            <select id="enq-interest" name="projectId" defaultValue={subject.projectId ?? ""} className={field}>
              <option value="">{t.anything}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label htmlFor="enq-purpose" className={label}>
            {t.purpose}
          </label>
          <select id="enq-purpose" name="purpose" className={field} defaultValue="self_use">
            {purposes.map((p) => (
              <option key={p} value={p}>
                {t.purposes[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!compact ? (
        <div className={two}>
          <div>
            <label htmlFor="enq-budget" className={label}>
              {t.budget}
            </label>
            <select id="enq-budget" name="budget" className={field} defaultValue="">
              <option value=""></option>
              {t.budgets.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="enq-timeline" className={label}>
              {t.timeline}
            </label>
            <select id="enq-timeline" name="timeline" className={field} defaultValue="">
              <option value=""></option>
              {t.timelines.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {!compact ? (
        <div>
          <label htmlFor="enq-email" className={label}>
            {t.email}
          </label>
          <input id="enq-email" name="email" type="email" autoComplete="email" className={field} maxLength={120} />
        </div>
      ) : null}

      <div>
        <label htmlFor="enq-message" className={label}>
          {t.message}
        </label>
        <textarea id="enq-message" name="message" rows={compact ? 2 : 3} className={field} placeholder={t.messagePlaceholder} maxLength={1500} />
      </div>

      <label className={cn("flex items-start gap-3 text-[14px]", dark ? "text-navy-200" : "text-ink-700")}>
        <input type="checkbox" name="consent" defaultChecked className="check" />
        <span>{t.consent}</span>
      </label>

      {errorText ? (
        <p className="rounded-[3px] border border-danger-600/25 bg-danger-100 px-4 py-3 text-[14px] font-medium text-danger-700" role="alert">
          {errorText}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
        <button type="submit" disabled={pending} className={cn(dark ? "btn-gold" : "btn-primary", "sm:min-w-44", compact && "w-full sm:w-auto")}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? t.submitting : t.submit}
        </button>
        {phone && !compact ? (
          <p className={cn("text-[14px]", dark ? "text-navy-300" : "text-ink-500")}>
            {t.orCall}{" "}
            <a href={telHref(phone)} className={cn("num font-semibold hover:underline", dark ? "text-paper-50" : "text-navy-900")}>
              {formatPhoneDisplay(phone)}
            </a>
          </p>
        ) : null}
      </div>
    </ActionForm>
  );
}
