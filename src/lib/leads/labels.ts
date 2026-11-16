import type { ContactOutcome, LeadEventKind, LeadKind, LeadStatus, LeadTemperature, LostReason, NextKind } from "@/lib/db/enums";

const BUY_STAGE: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Talked",
  visit_booked: "Visit booked",
  visited: "Visited",
  negotiating: "Negotiating",
  advance: "Advance paid",
  registered: "Registered",
  lost: "Lost",
};
const SELL_STAGE: Record<LeadStatus, string> = { ...BUY_STAGE, visit_booked: "Visit fixed", visited: "Site seen", negotiating: "Agreeing terms", advance: "Listed", registered: "Sold" };

/** The name of a stage. Someone selling moves through the same steps under other names. */
export function stageLabel(status: LeadStatus, kind: LeadKind = "buy"): string {
  return (kind === "sell" ? SELL_STAGE : BUY_STAGE)[status];
}

export const STAGE_TONE: Record<LeadStatus, string> = {
  new: "bg-gold-100 text-gold-800",
  contacted: "bg-navy-100 text-navy-700",
  visit_booked: "bg-navy-900 text-gold-200",
  visited: "bg-navy-100 text-navy-700",
  negotiating: "bg-success-100 text-success-700",
  advance: "bg-success-100 text-success-700",
  registered: "bg-success-600 text-paper-0",
  lost: "bg-muted-100 text-muted-600",
};

export const TEMPERATURE_LABEL: Record<LeadTemperature, string> = { "": "Not set", hot: "Hot", warm: "Warm", cold: "Cold" };
export const TEMPERATURE_TONE: Record<LeadTemperature, string> = { "": "", hot: "bg-danger-100 text-danger-700", warm: "bg-warning-100 text-warning-700", cold: "bg-paper-200 text-ink-600" };

export const NEXT_LABEL: Record<NextKind, string> = { "": "Nothing planned", call: "Call", visit: "Site visit", send: "Send details", other: "Other" };

export const EVENT_LABEL: Record<LeadEventKind, string> = { call: "Call", visit: "Site visit", whatsapp: "WhatsApp", note: "Note", stage: "Stage changed" };

export const OUTCOME_LABEL: Record<ContactOutcome, string> = {
  talked: "Talked",
  no_answer: "No answer",
  busy: "Busy, call later",
  wrong_number: "Wrong number",
  came: "They came",
  did_not_come: "Did not come",
};
/** The outcomes offered for each kind of contact. */
export const OUTCOMES_FOR: Record<"call" | "visit", ContactOutcome[]> = { call: ["talked", "no_answer", "busy", "wrong_number"], visit: ["came", "did_not_come"] };

export const LOST_LABEL: Record<LostReason, string> = {
  budget: "Budget does not fit",
  bought_elsewhere: "Bought elsewhere",
  location: "Wants another location",
  unreachable: "Cannot be reached",
  just_looking: "Was only looking",
  other: "Other",
};

const DAY = 24 * 60 * 60 * 1000;
const IST = 5.5 * 60 * 60 * 1000;

/** Midnight in India at the start of the day `now` falls in. */
export function startOfIstDay(now: Date = new Date()): Date {
  return new Date(Math.floor((now.getTime() + IST) / DAY) * DAY - IST);
}

/** "Today 6:00 pm", "Tomorrow 11:00 am", "Sun 23 Nov, 11:00 am", in Indian time. */
export function formatWhen(date: Date, now: Date = new Date()): string {
  const days = Math.round((startOfIstDay(date).getTime() - startOfIstDay(now).getTime()) / DAY);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(date);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Tomorrow ${time}`;
  if (days === -1) return `Yesterday ${time}`;
  const day = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(date);
  return `${day}, ${time}`;
}

/** "3 days ago", "today": how long since something happened, in whole Indian days. */
export function daysAgo(date: Date, now: Date = new Date()): string {
  const days = Math.round((startOfIstDay(now).getTime() - startOfIstDay(date).getTime()) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
