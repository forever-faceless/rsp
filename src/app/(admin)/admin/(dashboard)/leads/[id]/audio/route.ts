import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { leadAudio, leadEvents, leads } from "@/lib/db/schema";

/** About two minutes of speech at the rate the page records it, with room to spare. */
const MAX_BYTES = 1_500_000;

/** Files a spoken note in a lead's history. The sound is kept in the register, not at a public address. */
export async function POST(request: NextRequest, { params }: RouteContext<"/admin/leads/[id]/audio">) {
  const session = await getSession();
  if (!session) return new Response("Not signed in", { status: 401 });
  const id = Number((await params).id);
  const mime = (request.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!Number.isInteger(id) || !/^audio\/(webm|mp4|ogg|mpeg|aac)$/.test(mime)) return new Response("Not a recording", { status: 400 });
  const body = Buffer.from(await request.arrayBuffer());
  if (!body.length || body.length > MAX_BYTES) return new Response("Too long", { status: 413 });
  const db = await getDb();
  const [lead] = await db.select({ id: leads.id }).from(leads).where(eq(leads.id, id));
  if (!lead) return new Response("No such lead", { status: 404 });
  const [event] = await db.insert(leadEvents).values({ leadId: id, kind: "note", by: session.user }).returning({ id: leadEvents.id });
  await db.insert(leadAudio).values({ eventId: event.id, mime, data: body.toString("base64") });
  revalidatePath(`/admin/leads/${id}`);
  return Response.json({ ok: true });
}
