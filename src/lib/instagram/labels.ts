import type { IgState, IgTopic } from "@/lib/db/enums";

/** The office's words for where a conversation stands and what it is about. */
export const STATE_LABEL: Record<IgState, string> = {
  needs_you: "Needs you",
  auto: "Answered automatically",
  replied: "You replied",
  closed: "Closed",
  spam: "Spam",
};

export const STATE_TONE: Record<IgState, string> = {
  needs_you: "bg-danger-100 text-danger-700",
  auto: "bg-success-100 text-success-700",
  replied: "bg-navy-100 text-navy-700",
  closed: "bg-muted-100 text-muted-600",
  spam: "bg-muted-100 text-muted-600",
};

export const TOPIC_LABEL: Record<IgTopic, string> = {
  reel: "Sent a reel",
  property: "Asked about a property",
  price: "Price",
  location: "Location",
  visit: "Site visit",
  sell: "Wants to sell",
  number: "Gave a number",
  greeting: "Said hello",
  other: "Something else",
};

/** How long the office can still reply: Instagram allows 24 hours from the person's last message. */
export function replyWindow(lastInboundAt: Date | null, now = Date.now()): { open: boolean; until: Date | null } {
  if (!lastInboundAt) return { open: false, until: null };
  const until = new Date(lastInboundAt.getTime() + 24 * 60 * 60 * 1000);
  return { open: until.getTime() > now, until };
}
