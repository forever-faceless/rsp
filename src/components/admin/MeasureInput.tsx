"use client";

import { useState, useSyncExternalStore } from "react";
import { fromFeet, fromSqft, M_PER_FT, toFeet, toSqft, type LengthUnit } from "@/lib/units";
import { cn } from "@/lib/utils";

const figure = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

// ---------------------------------------------------------------- the chosen unit

const KEY = "rsp-measure-unit";
const listeners = new Set<() => void>();
let chosen: LengthUnit | null = null;

function read(): LengthUnit {
  if (chosen) return chosen;
  try {
    return localStorage.getItem(KEY) === "m" ? "m" : "ft";
  } catch {
    return "ft";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Switches every measurement box on the page between feet and metres, and remembers the choice. */
export function setLengthUnit(unit: LengthUnit) {
  chosen = unit;
  try {
    localStorage.setItem(KEY, unit);
  } catch {
    // No storage: the choice still holds until the page is left.
  }
  for (const listener of listeners) listener();
}

/** The unit measurements are being typed in. Feet until the person chooses metres. */
export function useLengthUnit(): LengthUnit {
  return useSyncExternalStore(
    subscribe,
    read,
    () => "ft",
  );
}

/** The small feet or metres switch that sits beside a measurement. */
export function UnitSwitch({ kind = "length", className }: { kind?: "length" | "area"; className?: string }) {
  const unit = useLengthUnit();
  const options: [LengthUnit, string][] = kind === "area" ? [["ft", "sq ft"], ["m", "sq m"]] : [["ft", "ft"], ["m", "m"]];
  return (
    <span role="group" aria-label="Unit to type in" className={cn("inline-flex shrink-0 overflow-hidden rounded-[3px] border border-navy-900/20 align-middle", className)}>
      {options.map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={unit === value}
          onClick={() => setLengthUnit(value)}
          className={cn("h-[18px] px-1.5 font-mono text-[10.5px] font-semibold leading-none transition-colors", unit === value ? "bg-navy-900 text-gold-200" : "bg-paper-0 text-ink-600 hover:bg-navy-50")}
        >
          {label}
        </button>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------- typing a measurement

type Kind = "length" | "area";

const convert = {
  length: { to: toFeet, from: fromFeet },
  area: { to: toSqft, from: fromSqft },
} as const;

/**
 * What is typed is kept exactly as typed while the box is in use; the stored figure is
 * always feet. Switching the unit re-expresses the stored figure instead of re-reading the text.
 */
function useEntry(kind: Kind, valueFt: number | null, follow = false) {
  const unit = useLengthUnit();
  const [entry, setEntry] = useState<{ unit: LengthUnit; text: string; feet: number | null } | null>(null);
  // With `follow`, the typed text is shown only while it still stands for the stored figure,
  // so a figure that is changed from outside (an area worked out from width and depth) shows through.
  const live = entry && entry.unit === unit && (!follow || entry.feet === valueFt);
  const text = live ? entry.text : valueFt == null ? "" : String(convert[kind].from(valueFt, unit));
  const parse = (raw: string): number | null => {
    const n = raw.trim() === "" ? null : Number(raw);
    return n != null && Number.isFinite(n) && n > 0 ? convert[kind].to(n, unit) : null;
  };
  /** Records what was typed and returns the figure it stands for, in feet. */
  const typed = (raw: string): number | null => {
    const feet = parse(raw);
    setEntry({ unit, text: raw, feet });
    return feet;
  };
  return { unit, entry, setEntry, text, parse, typed };
}

type EntryProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onBlur" | "defaultValue"> & {
  kind?: Kind;
  /** The figure in feet or square feet. */
  valueFt: number | null;
  /** Called on every keystroke with the figure in feet. */
  onChangeFt?: (feet: number | null) => void;
  /** Called when the box is left, and only if the figure changed. */
  onCommitFt?: (feet: number | null) => void;
};

/** A bare measurement box that follows the chosen unit. Used where a field has its own label. */
export function LengthEntry({ kind = "length", valueFt, onChangeFt, onCommitFt, ...rest }: EntryProps) {
  const { unit, entry, setEntry, text, parse, typed } = useEntry(kind, valueFt);
  return (
    <input
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const feet = typed(e.target.value);
        onChangeFt?.(feet);
      }}
      onBlur={() => {
        if (entry && entry.unit === unit) {
          const feet = parse(entry.text);
          if (feet !== valueFt) onCommitFt?.(feet);
        }
        // A box that commits on leaving follows the stored figure afterwards; one that reports
        // every keystroke keeps showing what was typed.
        if (onCommitFt) setEntry(null);
      }}
      {...rest}
    />
  );
}

type MetresProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onBlur" | "defaultValue"> & {
  /** The distance as stored, in feet. */
  valueFt: number | null;
  /** Called when the box is left, and only if the distance changed. */
  onCommitFt: (feet: number | null) => void;
};

/**
 * A distance between two places, which is always typed and shown in metres. There is no
 * unit switch here on purpose: only the sides of a plot are quoted in feet.
 */
export function MetresEntry({ valueFt, onCommitFt, ...rest }: MetresProps) {
  const [typed, setTyped] = useState<string | null>(null);
  const round = (n: number) => Math.round(n * 100) / 100;
  const stored = valueFt == null ? null : round(valueFt * M_PER_FT);
  return (
    <input
      inputMode="decimal"
      value={typed ?? (stored == null ? "" : String(stored))}
      onChange={(e) => setTyped(e.target.value)}
      onBlur={() => {
        if (typed != null) {
          const n = typed.trim() === "" ? null : Number(typed);
          const metres = n != null && Number.isFinite(n) && n > 0 ? round(n) : null;
          if (metres !== stored) onCommitFt(metres == null ? null : metres / M_PER_FT);
        }
        setTyped(null);
      }}
      {...rest}
    />
  );
}

type MeasureProps = {
  label: string;
  /** Form field name. The value submitted is always in feet or square feet. */
  name: string;
  kind?: Kind;
  defaultValue?: number | null;
  /** Pass these two to hold the figure outside, for fields that depend on each other. */
  valueFt?: number | null;
  onChangeFt?: (feet: number | null) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
};

/**
 * A measurement in a form, with a feet or metres switch. Type the figure as the document
 * gives it; it is converted and saved in feet, and the line beneath shows the other unit.
 */
export function MeasureInput({ label, name, kind = "length", defaultValue, valueFt, onChangeFt, onBlur, error, hint, wrapperClassName }: MeasureProps) {
  const [inner, setInner] = useState<number | null>(typeof defaultValue === "number" ? defaultValue : null);
  const held = valueFt !== undefined;
  const feet = held ? valueFt : inner;
  const { unit, text, typed } = useEntry(kind, feet, true);
  const id = `${name}-entry`;
  const names = kind === "area" ? { ft: "sq ft", m: "sq m" } : { ft: "ft", m: "m" };
  const other = feet == null ? "" : unit === "m" ? `Saved as ${figure(feet)} ${names.ft}.` : `That is ${figure(convert[kind].from(feet, "m"))} ${names.m}.`;

  return (
    <div className={wrapperClassName}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="label !mb-0">
          {label}
        </label>
        <UnitSwitch kind={kind} />
      </div>
      <input
        id={id}
        data-measure={name}
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(e) => {
          const next = typed(e.target.value);
          if (!held) setInner(next);
          onChangeFt?.(next);
        }}
        onBlur={onBlur}
        className={cn("field num", error && "field-error")}
      />
      <input type="hidden" name={name} value={feet ?? ""} />
      {error ? <p className="mt-1.5 text-xs font-medium text-danger-700">{error}</p> : hint || other ? <p className="help">{[hint, other].filter(Boolean).join(" ")}</p> : null}
    </div>
  );
}
