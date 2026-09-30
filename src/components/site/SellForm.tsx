"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useActionState } from "react";
import { submitEnquiry, type EnquiryState } from "@/lib/actions/enquiry";
import { PROPERTY_TYPES } from "@/lib/db/enums";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { ActionForm } from "@/components/ActionForm";

const initial: EnquiryState = { status: "idle" };

type Props = { locale: Locale; t: Dictionary["sell"]; e: Dictionary["enquiry"]; types: Dictionary["types"]; source: string };

/**
 * Owners describe what they want to sell. The server folds the answers into one readable
 * note, so the office sees the whole request at a glance in the enquiries list.
 */
export function SellForm({ locale, t, e, types, source }: Props) {
  const [state, action, pending] = useActionState(submitEnquiry, initial);

  if (state.status === "success") {
    return (
      <div className="rounded-[4px] border border-success-600/25 bg-success-100/70 p-6 sm:p-8" role="status">
        <CheckCircle2 className="h-9 w-9 text-success-600" aria-hidden="true" />
        <h3 className="mt-4 text-[1.35rem] leading-snug">{t.successTitle}</h3>
        <p className="mt-2 text-[15px] text-ink-700">{t.successText}</p>
      </div>
    );
  }

  const error = state.status === "error" ? state.code : null;
  const errorText =
    error === "invalid_phone" ? e.invalidPhone : error === "invalid_name" ? e.invalidName : error === "consent_required" ? e.consentRequired : error === "too_many" ? e.tooMany : error ? e.errorGeneric : null;

  return (
    <ActionForm action={action} pending={pending} className="relative space-y-4" noValidate>
      <input type="hidden" name="kind" value="sell" />
      <input type="hidden" name="purpose" value="other" />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="source" value={source} />
      <div className="absolute -left-[9999px] top-0" aria-hidden="true">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="sell-name" className="label">
            {e.name} <span className="text-danger-600">*</span>
          </label>
          <input id="sell-name" name="name" required autoComplete="name" className={cn("field", error === "invalid_name" && "field-error")} maxLength={80} />
        </div>
        <div>
          <label htmlFor="sell-phone" className="label">
            {e.phone} <span className="text-danger-600">*</span>
          </label>
          <input
            id="sell-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="98765 43210"
            className={cn("field num", error === "invalid_phone" && "field-error")}
            maxLength={16}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="sell-type" className="label">
            {t.propertyType}
          </label>
          <select id="sell-type" name="sellType" className="field" defaultValue="residential_site">
            {PROPERTY_TYPES.map((p) => (
              <option key={p} value={p}>
                {types[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sell-size" className="label">
            {t.size}
          </label>
          <input id="sell-size" name="sellSize" className="field" placeholder={t.sizePlaceholder} maxLength={80} />
        </div>
      </div>

      <div>
        <label htmlFor="sell-location" className="label">
          {t.location}
        </label>
        <input id="sell-location" name="sellLocation" className="field" placeholder={t.locationPlaceholder} maxLength={160} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="sell-price" className="label">
            {t.expectedPrice}
          </label>
          <input id="sell-price" name="sellPrice" className="field" inputMode="text" maxLength={60} />
        </div>
        <div>
          <label htmlFor="sell-email" className="label">
            {e.email}
          </label>
          <input id="sell-email" name="email" type="email" autoComplete="email" className="field" maxLength={120} />
        </div>
      </div>

      <div>
        <label htmlFor="sell-details" className="label">
          {t.details}
        </label>
        <textarea id="sell-details" name="sellDetails" rows={3} className="field" placeholder={t.detailsPlaceholder} maxLength={900} />
      </div>

      <label className="flex items-start gap-3 text-[14px] text-ink-700">
        <input type="checkbox" name="consent" defaultChecked className="check" />
        <span>{t.consent}</span>
      </label>

      {errorText ? (
        <p className="rounded-[3px] border border-danger-600/25 bg-danger-100 px-4 py-3 text-[14px] font-medium text-danger-700" role="alert">
          {errorText}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn-primary sm:min-w-44">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {pending ? e.submitting : t.submit}
      </button>
    </ActionForm>
  );
}
