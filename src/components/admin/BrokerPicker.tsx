"use client";

import { Check, Plus, Search, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type BrokerOption = { id: number; name: string; phone: string; firm: string };

type Props = {
  source: "seller" | "broker";
  brokerId: number | null;
  dealTerms: string;
  brokers: BrokerOption[];
  error?: string;
};

const digits = (s: string) => s.replace(/\D/g, "");

/**
 * Who brought the property in. A seller is the owner, whose details go in the owner fields
 * below. A broker is picked from the office's own list by searching name, firm or number; one
 * not on the list yet is typed in here and added to the list when the property is saved.
 */
export function BrokerPicker({ source: initialSource, brokerId, dealTerms, brokers, error }: Props) {
  const [source, setSource] = useState(initialSource);
  const [picked, setPicked] = useState<number | null>(brokerId);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(brokers.length === 0);
  const chosen = brokers.find((b) => b.id === picked) ?? null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qd = digits(q);
    if (!q) return brokers.slice(0, 6);
    return brokers.filter((b) => b.name.toLowerCase().includes(q) || b.firm.toLowerCase().includes(q) || (qd.length >= 3 && digits(b.phone).includes(qd))).slice(0, 8);
  }, [brokers, query]);

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="label">Came through</legend>
        <div className="mt-1.5 inline-grid grid-cols-2 rounded-[3px] border border-navy-900/15 bg-paper-0 p-1">
          {(["seller", "broker"] as const).map((value) => (
            <label
              key={value}
              className={cn(
                "cursor-pointer rounded-[2px] px-5 py-2 text-center text-[14px] font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold-500",
                source === value ? "bg-navy-900 text-gold-200" : "text-ink-700 hover:bg-paper-100",
              )}
            >
              <input type="radio" name="source" value={value} checked={source === value} onChange={() => setSource(value)} className="sr-only" />
              {value === "seller" ? "Seller (owner)" : "Broker"}
            </label>
          ))}
        </div>
      </fieldset>

      {source === "broker" ? (
        <div className="rounded-[4px] border border-navy-900/12 bg-paper-50 p-4" data-broker-picker>
          <input type="hidden" name="brokerId" value={!adding && chosen ? chosen.id : ""} />
          {!adding && chosen ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2.5 text-[14.5px] text-navy-900">
                <UserRound className="h-4 w-4 text-gold-600" aria-hidden="true" />
                <span className="font-semibold">{chosen.name}</span>
                {chosen.firm ? <span className="text-ink-600">{chosen.firm}</span> : null}
                {chosen.phone ? <span className="num text-ink-600">{chosen.phone}</span> : null}
              </p>
              <button type="button" onClick={() => setPicked(null)} className="btn-ghost btn-sm">
                <X className="h-3.5 w-3.5" aria-hidden="true" /> Change
              </button>
            </div>
          ) : adding ? (
            <div>
              <p className="text-[13.5px] font-semibold text-navy-900">New broker</p>
              <div className="mt-2 grid gap-3 md:grid-cols-3">
                <input name="newBrokerName" placeholder="Name" aria-label="Broker's name" autoComplete="off" maxLength={120} className="field" />
                <input name="newBrokerPhone" placeholder="Mobile number" aria-label="Broker's mobile number" type="tel" inputMode="tel" autoComplete="off" maxLength={20} className="field num" />
                <input name="newBrokerFirm" placeholder="Firm (optional)" aria-label="Broker's firm" autoComplete="off" maxLength={120} className="field" />
              </div>
              <p className="help">Added to the brokers list when you save. A number already on the list picks that broker instead.</p>
              {brokers.length ? (
                <button type="button" onClick={() => setAdding(false)} className="mt-2 text-[13px] font-semibold text-navy-800 underline decoration-gold-500 decoration-2 underline-offset-2">
                  Pick from the list instead
                </button>
              ) : null}
            </div>
          ) : (
            <div>
              <label htmlFor="broker-search" className="label">
                Find the broker
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                <input id="broker-search" value={query} onChange={(ev) => setQuery(ev.target.value)} placeholder="Name, firm or number" autoComplete="off" className="field !pl-9" />
              </div>
              <ul className="mt-2 divide-y divide-navy-900/8 rounded-[3px] border border-navy-900/10 bg-paper-0">
                {matches.map((b) => (
                  <li key={b.id}>
                    <button type="button" onClick={() => setPicked(b.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[14px] hover:bg-navy-50">
                      <Check className={cn("h-4 w-4 shrink-0", picked === b.id ? "text-gold-600" : "text-transparent")} aria-hidden="true" />
                      <span className="font-semibold text-navy-900">{b.name}</span>
                      {b.firm ? <span className="text-ink-600">{b.firm}</span> : null}
                      {b.phone ? <span className="num ml-auto text-ink-500">{b.phone}</span> : null}
                    </button>
                  </li>
                ))}
                {matches.length === 0 ? <li className="px-3 py-2.5 text-[13.5px] text-ink-500">No broker by that name or number yet.</li> : null}
              </ul>
              <button type="button" onClick={() => setAdding(true)} className="btn-outline btn-sm mt-3">
                <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add a new broker
              </button>
            </div>
          )}
          {error ? <p className="mt-2 text-[13px] font-medium text-danger-700">{error}</p> : null}
        </div>
      ) : null}

      <div>
        <label htmlFor="deal-terms" className="label">
          {source === "broker" ? "Commission agreed" : "Agreement with the owner"}
        </label>
        <textarea
          id="deal-terms"
          name="dealTerms"
          rows={2}
          defaultValue={dealTerms}
          maxLength={2000}
          className="field"
          placeholder={source === "broker" ? "For example 1% of the sale price, paid on registration" : "For example sole selling rights for 6 months, agreement signed on 2 October"}
        />
      </div>
    </div>
  );
}
