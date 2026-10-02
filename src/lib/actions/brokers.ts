"use server";

import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { brokers, properties } from "@/lib/db/schema";
import { normalisePhone } from "@/lib/utils";
import { brokerSchema } from "@/lib/validation";
import { revalidateAll } from "./shared";

function readBroker(formData: FormData) {
  const parsed = brokerSchema.safeParse({
    name: formData.get("name") ?? "",
    phone: normalisePhone(String(formData.get("phone") ?? "")),
    firm: formData.get("firm") ?? "",
    notes: formData.get("notes") ?? "",
  });
  return parsed.success ? parsed.data : null;
}

/** Adds a broker to the office list, or changes one already on it. */
export async function saveBroker(id: number | null, formData: FormData): Promise<void> {
  await requireAdmin();
  const data = readBroker(formData);
  if (!data) return;
  const db = await getDb();
  if (id) await db.update(brokers).set({ ...data, updatedAt: new Date() }).where(eq(brokers.id, id));
  else await db.insert(brokers).values(data);
  revalidateAll();
}

/** Removes a broker. Their listings stay, marked as from a broker no longer on the list. */
export async function deleteBroker(id: number): Promise<void> {
  await requireAdmin();
  const db = await getDb();
  await db.update(properties).set({ brokerId: null }).where(eq(properties.brokerId, id));
  await db.delete(brokers).where(eq(brokers.id, id));
  revalidateAll();
}
