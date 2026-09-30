"use client";

import { ArrowRight, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import { parseRef } from "@/lib/refs";
import { cn } from "@/lib/utils";

type Props = {
  locale: Locale;
  labels: { byNumber: string; placeholder: string; go: string; notFound: string; invalid: string; hint?: string };
  /** "bar" is the compact field in the header; "panel" is the larger one used in the hero. */
  variant?: "bar" | "panel";
  tone?: "light" | "dark";
  className?: string;
  onNavigate?: () => void;
};

/** Jumps straight to a property from its number, the way a register is looked up by entry. */
export function RefSearch({ locale, labels, variant = "bar", tone = "light", className, onNavigate }: Props) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dark = tone === "dark";
  const panel = variant === "panel";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const q = value.trim();
    if (!q) return;
    if (!parseRef(q)) {
      setError(labels.invalid);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/ref?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const data = (await res.json()) as { ok: boolean; path?: string };
      if (data.ok && data.path) {
        onNavigate?.();
        router.push(`/${locale}${data.path}`);
        setValue("");
      } else {
        setError(labels.notFound);
      }
    } catch {
      setError(labels.notFound);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={cn("relative", className)} role="search" noValidate>
      {panel ? (
        <label htmlFor={id} className={cn("label-mono mb-2 block", dark && "!text-navy-300")}>
          {labels.byNumber}
        </label>
      ) : (
        <label htmlFor={id} className="sr-only">
          {labels.byNumber}
        </label>
      )}
      <div
        className={cn(
          "flex items-stretch overflow-hidden rounded-[3px] border transition-colors focus-within:border-gold-500",
          dark ? "border-paper-0/20 bg-navy-950/50" : "border-navy-900/18 bg-paper-0",
          error && "!border-danger-600",
        )}
      >
        <span className={cn("flex items-center pl-3", dark ? "text-navy-300" : "text-ink-400")}>
          <Search className="h-4 w-4" aria-hidden="true" />
        </span>
        <input
          id={id}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError("");
          }}
          placeholder={labels.placeholder}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "min-w-0 flex-1 bg-transparent px-2.5 font-mono tracking-[0.05em] uppercase outline-none placeholder:normal-case",
            panel ? "h-12 text-[15px]" : "h-10 w-32 text-[13px]",
            dark ? "text-paper-50 placeholder:text-navy-400" : "text-navy-900 placeholder:text-ink-300",
          )}
        />
        <button
          type="submit"
          disabled={busy}
          className={cn(
            "flex shrink-0 items-center justify-center gap-1.5 font-semibold transition-colors",
            panel ? "px-5 text-[14px]" : "w-10",
            dark ? "bg-gold-400 text-navy-950 hover:bg-gold-300" : "bg-navy-800 text-paper-0 hover:bg-navy-700",
          )}
          aria-label={labels.go}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : panel ? labels.go : null}
          {!busy ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
        </button>
      </div>
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className={cn(
            "text-[12.5px] leading-snug",
            panel ? "mt-2" : "absolute left-0 top-full z-10 mt-1.5 w-64 rounded-[3px] border border-danger-600/25 bg-paper-0 p-2.5 shadow-card",
            dark && panel ? "text-gold-200" : "text-danger-700",
          )}
        >
          {error}
        </p>
      ) : panel && labels.hint ? (
        <p className={cn("mt-2 text-[12.5px]", dark ? "text-navy-300" : "text-ink-500")}>{labels.hint}</p>
      ) : null}
    </form>
  );
}
