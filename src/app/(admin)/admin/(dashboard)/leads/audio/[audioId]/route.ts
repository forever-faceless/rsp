import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { leadAudio } from "@/lib/db/schema";

/** Plays a spoken note back, to someone signed in to the register and to nobody else. */
export async function GET(_request: NextRequest, { params }: RouteContext<"/admin/leads/audio/[audioId]">) {
  if (!(await getSession())) return new Response("Not signed in", { status: 401 });
  const id = Number((await params).audioId);
  if (!Number.isInteger(id)) return new Response("Not found", { status: 404 });
  const db = await getDb();
  const [row] = await db.select().from(leadAudio).where(eq(leadAudio.id, id));
  if (!row) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(row.data, "base64"), { headers: { "content-type": row.mime, "cache-control": "private, max-age=86400" } });
}
