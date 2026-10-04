"use client";

import { Check, CheckCircle2, Loader2, Phone } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { submitEnquiry, type EnquiryState } from "@/lib/actions/enquiry";
import { identifyLead, track, visitId } from "@/lib/analytics";
import { LEAD_PURPOSES } from "@/lib/db/enums";
import { fill, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { cn, formatPhoneDisplay, isIndianMobile, normalisePhone, telHref, whatsappHref } from "@/lib/utils";
import type { EnquirySubject } from "./EnquiryForm";
import { WhatsAppIcon } from "./PhoneLinks";

type Props = {
  locale: Locale;
  t: Dictionary["interest"];
  e: Dictionary["enquiry"];
  whatsappLabel: string;
  subject: EnquirySubject & { ref: string };
  phone: string;
  whatsapp: string;
  source: string;
};

/** Where the visitor is on the card: their number, then the questions, then done. */
type Stage = "details" | "answers" | "done";

/** Everything on the card, kept in the tab so a change of language or a reopened card carries on. */
type Card = {
  key: string;
  source: string;
  stage: Stage;
  name: string;
  mobile: string;
  consent: boolean;
  purpose: string;
  timeline: string;
  budget: string;
  at: number;
};

const PROGRESS_URL = "/api/enquiry/progress";
/** A card left longer than this starts afresh. */
const KEEP_MS = 12 * 60 * 60 * 1000;

/** A random key that ties every save from this card to one enquiry. */
function newKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

/** Sends what the card holds. On the way out of the page a beacon is used, since it outlives the page. */
function sendProgress(body: string, leaving: boolean): Promise<void> {
  if (leaving && typeof navigator.sendBeacon === "function" && navigator.sendBeacon(PROGRESS_URL, new Blob([body], { type: "text/plain" }))) {
    return Promise.resolve();
  }
  return fetch(PROGRESS_URL, { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).then(
    () => undefined,
    () => undefined,
  );
}

/** How the visitor reached the card, for the figures: a shared link, or the listing's own button. */
function via(source: string): "shared_link" | "listing" {
  return source.includes("/interest") ? "shared_link" : "listing";
}

/** One question answered by tapping, as a row of choices. Each choice is an ordinary radio button. */
function Choices({ name, legend, options, value, onChange }: { name: string; legend: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="label">{legend}</legend>
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
 * The quick enquiry for one listing. The name and number come first, since they are what the
 * office needs; the number is kept as soon as it is typed, even if send is never pressed. Once
 * sent, a tick confirms it and a few questions follow, each answer kept as it is tapped.
 */
export function InterestForm({ locale, t, e, whatsappLabel, subject, phone, whatsapp, source }: Props) {
  const storeKey = `rsp-enquiry:${subject.ref}`;
  const [card, setCard] = useState<Card>({ key: "", source, stage: "details", name: "", mobile: "", consent: true, purpose: "", timeline: "", budget: "", at: 0 });
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<EnquiryState>({ status: "idle" });
  const [pending, start] = useTransition();
  const [nudge, setNudge] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const honeypot = useRef<HTMLInputElement>(null);
  const update = (patch: Partial<Card>) => setCard((c) => ({ ...c, ...patch }));

  // Carries on from where this tab left the card: after a change of language, or when it is opened again.
  useEffect(() => {
    let saved: Partial<Card> | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(storeKey) ?? "null");
    } catch {}
    const fresh = saved && typeof saved.key === "string" && saved.key && typeof saved.at === "number" && Date.now() - saved.at < KEEP_MS;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the tab's copy can only be read after hydration
    setCard((c) => (fresh ? { ...c, ...saved } : { ...c, key: newKey(), at: Date.now() }));
    setLoaded(true);
    track("enquiry_opened", { ref: subject.ref, via: via((fresh && saved?.source) || source), stage: (fresh && saved?.stage) || "details" });
  }, [storeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loaded) return;
    try {
      sessionStorage.setItem(storeKey, JSON.stringify(card));
    } catch {}
  }, [card, loaded, storeKey]);

  // What the office does not have yet. Before sending, that is the name and a valid number
  // (only while the consent box is ticked); after, the answers to the questions.
  const before = card.stage === "details";
  const unsaved =
    !loaded || !card.key
      ? null
      : before
        ? card.consent && isIndianMobile(card.mobile)
          ? { sig: `d|${card.name.trim()}|${normalisePhone(card.mobile)}`, answers: false }
          : null
        : card.purpose || card.timeline || card.budget
          ? { sig: `a|${card.purpose}|${card.timeline}|${card.budget}`, answers: true }
          : null;
  const body = unsaved
    ? JSON.stringify({
        draftKey: card.key,
        name: card.name.trim(),
        phone: card.mobile,
        consent: card.consent,
        ref: subject.ref,
        projectId: subject.projectId ?? "",
        siteId: subject.siteId ?? "",
        propertyId: subject.propertyId ?? "",
        locale,
        source: card.source,
        sessionId: visitId(),
        ...(unsaved.answers ? { purpose: card.purpose, timeline: card.timeline, budget: card.budget } : {}),
      })
    : "";

  const latest = useRef<{ sig: string; body: string } | null>(null);
  const savedSig = useRef("");
  const numberCounted = useRef(false);
  const stage = useRef<Stage>(card.stage);
  useEffect(() => {
    stage.current = card.stage;
  }, [card.stage]);
  const flush = useCallback(
    (leaving: boolean): Promise<void> => {
      const next = latest.current;
      // A filled honeypot is a bot: nothing it types is kept.
      if (!next || next.sig === savedSig.current || honeypot.current?.value) return Promise.resolve();
      savedSig.current = next.sig;
      if (next.sig.startsWith("d|") && !numberCounted.current) {
        numberCounted.current = true;
        track("enquiry_number_entered", { ref: subject.ref }, { leaving });
      }
      return sendProgress(next.body, leaving);
    },
    [subject.ref],
  );

  // Saved a moment after the typing or tapping stops.
  useEffect(() => {
    latest.current = unsaved ? { sig: unsaved.sig, body } : null;
    if (!unsaved || unsaved.sig === savedSig.current) return;
    const timer = window.setTimeout(() => void flush(false), 800);
    return () => window.clearTimeout(timer);
  }, [unsaved?.sig, body, flush]); // eslint-disable-line react-hooks/exhaustive-deps

  // And at once when the card is closed, the page is left or the phone switches to another app.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush(true);
    };
    const onLeave = () => void flush(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onLeave);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onLeave);
      void flush(true);
      track("enquiry_closed", { ref: subject.ref, stage: stage.current });
    };
  }, [flush, subject.ref]);

  const contactButtons = (
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
  );

  if (card.stage === "done") {
    return (
      <div className="py-2" role="status" data-stage="done">
        <CheckCircle2 className="h-10 w-10 text-success-600" aria-hidden="true" />
        <h3 className="mt-4 text-[1.4rem] leading-snug">{t.successTitle}</h3>
        <p className="mt-2 text-[15px] text-ink-700">{fill(t.successText, { ref: subject.ref })}</p>
        {contactButtons}
      </div>
    );
  }

  if (card.stage === "answers") {
    const firstName = card.name.trim().split(/\s+/)[0] ?? "";
    const finish = () => {
      if (!card.purpose && !card.timeline && !card.budget) return setNudge(true);
      setFinishing(true);
      track("enquiry_answered", { ref: subject.ref, purpose: card.purpose, timeline: card.timeline, budget: card.budget });
      void flush(false).then(() => {
        setFinishing(false);
        update({ stage: "done" });
      });
    };
    return (
      <div data-stage="answers">
        <div className="flex items-start gap-3.5 rounded-[4px] border border-success-600/20 bg-success-100 p-4" role="status">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-600 text-paper-0">
            <Check className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[1.05rem] font-semibold leading-snug text-navy-900" data-private>
              {fill(t.sentTitle, { name: firstName })}
            </p>
            <p className="mt-1 text-[14px] text-ink-700" data-private>
              {fill(t.sentText, { phone: formatPhoneDisplay(card.mobile), ref: subject.ref })}
            </p>
          </div>
        </div>

        <div className="mt-7 space-y-6">
          <div>
            <h3 className="text-[1.2rem] leading-snug">{t.qualifyTitle}</h3>
            <p className="mt-1 text-[14px] text-ink-600">{t.qualifyText}</p>
          </div>
          <Choices name="purpose" legend={t.purposeQ} value={card.purpose} onChange={(v) => update({ purpose: v })} options={LEAD_PURPOSES.map((p) => ({ value: p, label: e.purposes[p] }))} />
          <Choices name="timeline" legend={t.timelineQ} value={card.timeline} onChange={(v) => update({ timeline: v })} options={e.timelines.map((x) => ({ value: x, label: x }))} />
          <Choices name="budget" legend={t.budgetQ} value={card.budget} onChange={(v) => update({ budget: v })} options={e.budgets.map((x) => ({ value: x, label: x }))} />
          {nudge && !card.purpose && !card.timeline && !card.budget ? (
            <p className="text-[14px] font-medium text-danger-700" role="alert">
              {t.chooseOne}
            </p>
          ) : null}
          <button type="button" onClick={finish} disabled={finishing} className="btn-primary w-full sm:w-auto sm:min-w-44">
            {finishing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {t.sendAnswers}
          </button>
        </div>
      </div>
    );
  }

  const error = state.status === "error" ? state.code : null;
  const errorText =
    error === "invalid_phone" ? e.invalidPhone : error === "invalid_name" ? e.invalidName : error === "consent_required" ? e.consentRequired : error === "too_many" ? e.tooMany : error ? e.errorGeneric : null;

  return (
    <form
      className="relative space-y-4"
      data-stage="details"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        const data = new FormData(ev.currentTarget);
        data.set("sessionId", visitId());
        start(async () => {
          const result = await submitEnquiry({ status: "idle" }, data);
          setState(result);
          if (result.status === "success") {
            track("enquiry_sent", { form: "quick_enquiry", ref: subject.ref, via: via(card.source) });
            identifyLead(result.leadId, subject.ref);
            // Sending covered the name and number; nothing is left to save until the answers.
            savedSig.current = "";
            latest.current = null;
            update({ stage: "answers" });
          }
        });
      }}
    >
      <input type="hidden" name="kind" value="buy" />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="source" value={card.source} />
      <input type="hidden" name="ref" value={subject.ref} />
      <input type="hidden" name="draftKey" value={card.key} />
      {subject.propertyId ? <input type="hidden" name="propertyId" value={subject.propertyId} /> : null}
      {subject.siteId ? <input type="hidden" name="siteId" value={subject.siteId} /> : null}
      {subject.projectId ? <input type="hidden" name="projectId" value={subject.projectId} /> : null}
      {/* Honeypot: hidden from people, filled by bots. */}
      <div className="absolute -left-[9999px] top-0" aria-hidden="true">
        <label>
          Website <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {phone ? (
        <div data-call-first>
          <a href={telHref(phone)} className="btn-primary btn-lg w-full">
            <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
            {/* Only the number is set in the figures' type; the words around it stay in the text face. */}
            <span>
              {t.callNow.split("{phone}")[0]}
              <span className="num whitespace-nowrap">{formatPhoneDisplay(phone)}</span>
              {t.callNow.split("{phone}")[1]}
            </span>
          </a>
          <p className="mt-2 text-center text-[13px] text-ink-500">{t.callText}</p>
          {/* Letter spacing would pull Kannada's joined letters apart, so it is for English only. */}
          <p className={cn("mt-5 flex items-center gap-3 text-[12px] font-semibold text-ink-400", locale === "en" && "uppercase tracking-[0.18em]")} aria-hidden="true">
            <span className="h-px flex-1 bg-navy-900/12" />
            {t.or}
            <span className="h-px flex-1 bg-navy-900/12" />
          </p>
        </div>
      ) : null}
      <div>
        <h3 className="text-[1.2rem] leading-snug">{t.detailsTitle}</h3>
        <p className="mt-1 text-[14px] text-ink-600">{t.detailsText}</p>
      </div>
      <div>
        <label htmlFor="int-name" className="label">
          {e.name} <span className="text-danger-600">*</span>
        </label>
        <input id="int-name" name="name" value={card.name} onChange={(ev) => update({ name: ev.target.value })} autoComplete="name" maxLength={80} className={cn("field", error === "invalid_name" && "field-error")} />
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
          value={card.mobile}
          onChange={(ev) => update({ mobile: ev.target.value })}
          maxLength={16}
          className={cn("field num", error === "invalid_phone" && "field-error")}
        />
        <p className="help">{e.phoneHint}</p>
      </div>
      <label className="flex items-start gap-3 text-[14px] text-ink-700">
        <input type="checkbox" name="consent" checked={card.consent} onChange={(ev) => update({ consent: ev.target.checked })} className="check" />
        <span>{e.consent}</span>
      </label>
      {errorText ? (
        <p className="rounded-[3px] border border-danger-600/25 bg-danger-100 px-4 py-3 text-[14px] font-medium text-danger-700" role="alert">
          {errorText}
        </p>
      ) : null}
      <div className="pt-1">
        <button type="submit" disabled={pending} className="btn-primary w-full sm:w-auto sm:min-w-52">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? e.submitting : t.submit}
        </button>
      </div>
    </form>
  );
}
