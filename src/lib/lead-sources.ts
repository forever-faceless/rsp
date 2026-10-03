/** How a lead the office adds by hand reached it. Stored on the lead as `office:<key>`. */
export const LEAD_CHANNELS = [
  ["instagram", "Instagram DM"],
  ["whatsapp", "WhatsApp"],
  ["call", "Phone call"],
  ["walk_in", "Walk-in"],
  ["advocate", "Through the advocate"],
  ["referral", "Referral"],
  ["facebook", "Facebook"],
  ["other", "Other"],
] as const;
export type LeadChannel = (typeof LEAD_CHANNELS)[number][0];

export function isLeadChannel(value: string): value is LeadChannel {
  return LEAD_CHANNELS.some(([key]) => key === value);
}

/** Where a lead came from, in a few words for the office. Blank for an ordinary website form. */
export function leadSourceLabel(source: string): string {
  const office = /^office:([a-z_]+)$/.exec(source);
  if (office) {
    const channel = LEAD_CHANNELS.find(([key]) => key === office[1]);
    return `Added by the office: ${channel ? channel[1] : "Other"}`;
  }
  if (source.includes("/interest")) {
    const from = /[?&]from=([a-z0-9_-]+)/i.exec(source);
    return `Through the quick enquiry link${from ? `, shared on ${from[1]}` : ""}`;
  }
  return "";
}
