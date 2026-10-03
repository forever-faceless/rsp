import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";
import { isIndianMobile, normalisePhone } from "@/lib/utils";
import type { CardProgress } from "@/lib/validation";

const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;

/** True once `key` has been seen more than `max` times in ten minutes. */
export function rateLimited(key: string, max = 6): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > max;
}

/**
 * Keeps what the quick enquiry card holds, without the visitor pressing send. The first valid
 * number starts an enquiry marked as not sent; later saves update it. Once the visitor has
 * sent the form, only the answers to the questions after it are added.
 */
export async function saveCardProgress(input: CardProgress, ip: string): Promise<void> {
  if (rateLimited(`card:${input.draftKey}`, 120)) return;
  const db = await getDb();
  const answers = {
    ...(input.purpose !== undefined ? { purpose: input.purpose } : {}),
    ...(input.timeline !== undefined ? { timeline: input.timeline } : {}),
    ...(input.budget !== undefined ? { budget: input.budget } : {}),
  };
  const contact = input.consent && isIndianMobile(input.phone) ? { name: input.name, phone: normalisePhone(input.phone) } : null;
  const visit = input.sessionId ? { sessionId: input.sessionId } : {};

  const [existing] = await db.select({ id: leads.id, sent: leads.sent }).from(leads).where(eq(leads.draftKey, input.draftKey)).limit(1);
  if (existing) {
    if (Object.keys(answers).length) await db.update(leads).set({ ...answers, ...visit }).where(eq(leads.id, existing.id));
    // Until it is sent, the enquiry follows the number as it is corrected.
    if (contact && !existing.sent) await db.update(leads).set({ ...contact, ...visit }).where(and(eq(leads.id, existing.id), eq(leads.sent, false)));
    return;
  }
  if (!contact || rateLimited(ip)) return;

  const base = {
    kind: "buy" as const,
    ...contact,
    ref: input.ref,
    purpose: input.purpose ?? "",
    budget: input.budget ?? "",
    timeline: input.timeline ?? "",
    locale: input.locale,
    source: input.source,
    draftKey: input.draftKey,
    sent: false,
    sessionId: input.sessionId,
  };
  try {
    await db
      .insert(leads)
      .values({ ...base, projectId: input.projectId, siteId: input.siteId, propertyId: input.propertyId })
      .onConflictDoNothing();
  } catch {
    // The listing may have been deleted since the card was opened; the property number still says which it was.
    await db.insert(leads).values(base).onConflictDoNothing();
  }
}
