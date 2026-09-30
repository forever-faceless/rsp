"use client";

import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { useFormPending } from "@/components/ActionForm";

export function PageHeader({
  title,
  description,
  actions,
  back,
  refText,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  refText?: string;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-600 hover:text-navy-900">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {back.label}
          </Link>
        ) : null}
        <div className={cn("flex flex-wrap items-center gap-3", back && "mt-2")}>
          {refText ? <span className="ref ref-lg">{refText}</span> : null}
          <h1 className="text-[1.6rem] leading-tight sm:text-[1.9rem]">{title}</h1>
        </div>
        {description ? <p className="mt-2 max-w-2xl text-[14px] text-ink-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Section({ title, description, children, className, id, aside }: { title: string; description?: string; children: React.ReactNode; className?: string; id?: string; aside?: React.ReactNode }) {
  return (
    <section id={id} className={cn("card scroll-mt-24 p-4 sm:p-6", className)}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-navy-900/8 pb-4">
        <div>
          <h2 className="text-[1.15rem] leading-snug">{title}</h2>
          {description ? <p className="mt-1 max-w-2xl text-[13.5px] text-ink-600">{description}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, name, error, hint, children, className }: { label: string; name: string; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-xs font-medium text-danger-700">{error}</p> : hint ? <p className="help">{hint}</p> : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; error?: string; hint?: string; wrapperClassName?: string };
export function Input({ label, name, error, hint, wrapperClassName, className, ...rest }: InputProps) {
  return (
    <Field label={label} name={name} error={error} hint={hint} className={wrapperClassName}>
      <input id={name} name={name} className={cn("field", error && "field-error", className)} {...rest} />
    </Field>
  );
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; name: string; error?: string; hint?: string; wrapperClassName?: string };
export function Textarea({ label, name, error, hint, wrapperClassName, className, ...rest }: TextareaProps) {
  return (
    <Field label={label} name={name} error={error} hint={hint} className={wrapperClassName}>
      <textarea id={name} name={name} className={cn("field min-h-24", error && "field-error", className)} {...rest} />
    </Field>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string; error?: string; hint?: string; wrapperClassName?: string; options: { value: string; label: string }[] };
export function Select({ label, name, error, hint, wrapperClassName, className, options, ...rest }: SelectProps) {
  return (
    <Field label={label} name={name} error={error} hint={hint} className={wrapperClassName}>
      <select id={name} name={name} className={cn("field", error && "field-error", className)} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Checkbox({ label, name, defaultChecked, hint }: { label: string; name: string; defaultChecked?: boolean; hint?: string }) {
  return (
    <label className="flex min-h-11 items-start gap-3 rounded-[3px] border border-navy-900/15 bg-paper-0 px-3.5 py-3 text-[14px]">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="check" />
      <span>
        <span className="font-semibold text-ink-900">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-ink-500">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Notice({ tone, children }: { tone: "error" | "success" | "info"; children: React.ReactNode }) {
  const styles = {
    error: "border-danger-600/25 bg-danger-100 text-danger-700",
    success: "border-success-600/25 bg-success-100 text-success-700",
    info: "border-navy-900/15 bg-navy-50 text-navy-800",
  }[tone];
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <p className={cn("flex items-start gap-2 rounded-[3px] border px-4 py-3 text-[14px] font-medium", styles)} role={tone === "error" ? "alert" : "status"}>
      {tone === "info" ? null : <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
      <span>{children}</span>
    </p>
  );
}

export function FormStatus({ state }: { state: ActionState }) {
  const [hidden, setHidden] = useState(false);
  const [seen, setSeen] = useState<ActionState>(state);
  if (state !== seen) {
    // A new result arrived: show it again.
    setSeen(state);
    setHidden(false);
  }
  useEffect(() => {
    if (!state?.success) return;
    const t = setTimeout(() => setHidden(true), 4000);
    return () => clearTimeout(t);
  }, [state]);
  if (!state || hidden) return null;
  if (state.error) return <Notice tone="error">{state.error}</Notice>;
  if (state.success) return <Notice tone="success">{state.success}</Notice>;
  return null;
}

export function SubmitButton({ children, className, variant = "primary" }: { children: React.ReactNode; className?: string; variant?: "primary" | "gold" | "outline" }) {
  // Forms submitted through ActionForm report their state through context; plain forms through React.
  const status = useFormStatus();
  const pending = useFormPending() || status.pending;
  const cls = variant === "gold" ? "btn-gold" : variant === "outline" ? "btn-outline" : "btn-primary";
  return (
    <button type="submit" disabled={pending} className={cn(cls, className)}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

/** Two-step delete: first click arms, second click runs the action. No native dialogs. */
export function ConfirmButton({
  action,
  label = "Delete",
  confirmLabel = "Confirm delete",
  className,
  size = "sm",
  icon = true,
}: {
  action: () => Promise<void>;
  label?: string;
  confirmLabel?: string;
  className?: string;
  size?: "sm" | "md";
  icon?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => (armed ? start(() => action()) : setArmed(true))}
      className={cn("btn-danger", size === "sm" && "btn-sm", armed && "!border-danger-600 !bg-danger-600 !text-paper-0", className)}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon ? <Trash2 className="h-4 w-4" aria-hidden="true" /> : null}
      {armed ? confirmLabel : label}
    </button>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="card bg-grid flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="font-display text-[1.25rem] font-semibold text-navy-900 [font-stretch:110%]">{title}</p>
      {text ? <p className="mt-2 max-w-md text-[14px] text-ink-600">{text}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, hint, href }: { label: string; value: string | number; hint?: string; href?: string }) {
  const body = (
    <>
      <p className="label-mono">{label}</p>
      <p className="mt-2 font-display text-[2rem] font-semibold leading-none text-navy-900 [font-stretch:110%]">{value}</p>
      {hint ? <p className="mt-2 text-xs text-ink-500">{hint}</p> : null}
    </>
  );
  return href ? (
    <Link href={href} className="card card-hover block p-4 sm:p-5">
      {body}
    </Link>
  ) : (
    <div className="card p-4 sm:p-5">{body}</div>
  );
}

export function SectionNav({ items }: { items: [string, string][] }) {
  return (
    <nav className="mb-6 flex gap-2 overflow-x-auto pb-1 text-[13px]" aria-label="Sections">
      {items.map(([href, label]) => (
        <a key={href} href={href} className="shrink-0 rounded-[3px] border border-navy-900/15 bg-paper-0 px-3.5 py-2 font-semibold text-ink-700 hover:border-navy-800 hover:text-navy-900">
          {label}
        </a>
      ))}
    </nav>
  );
}
