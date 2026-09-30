"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { LEAD_STATUSES, leads, type LeadStatus } from "@/lib/db/schema";

export async function updateLeadNotes(id: number, formData: FormData): Promise<void> {
  await requireAdmin();
  const notes = String(formData.get("notes") ?? "").slice(0, 2000);
  const statusRaw = String(formData.get("status") ?? "");
  const db = await getDb();
  await db
    .update(leads)
    .set({
      notes,
      ...(LEAD_STATUSES.includes(statusRaw as LeadStatus) ? { status: statusRaw as LeadStatus } : {}),
    })
    .where(eq(leads.id, id));
  revalidatePath("/admin", "layout");
}

export async function deleteLead(id: number): Promise<void> {
  await requireAdmin();
  const db = await getDb();
  await db.delete(leads).where(eq(leads.id, id));
  revalidatePath("/admin", "layout");
}
