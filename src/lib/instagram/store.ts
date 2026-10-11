import "server-only";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import type { IgMessageKind, IgSender, IgState } from "@/lib/db/enums";
import { igMedia, igMessages, igSettings, igThreads, IG_STATES, type IgMediaRow, type IgMessage, type IgSettings, type IgThread } from "@/lib/db/schema";

/** The settings row, made on first use. */
export async function getIgSettings(): Promise<IgSettings> {
  const db = await getDb();
  const [row] = await db.select().from(igSettings).where(eq(igSettings.id, 1));
  if (row) return row;
  await db.insert(igSettings).values({ id: 1 }).onConflictDoNothing();
  const [made] = await db.select().from(igSettings).where(eq(igSettings.id, 1));
  return made;
}

export async function saveIgSettings(patch: Partial<typeof igSettings.$inferInsert>): Promise<void> {
  const db = await getDb();
  await getIgSettings();
  await db
    .update(igSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(igSettings.id, 1));
}

/** The access token: the one kept once the connection was checked, else the one given at set-up. */
export function tokenOf(s: IgSettings): string {
  return s.accessToken || process.env.IG_ACCESS_TOKEN?.trim() || "";
}

/** True when the site has what it needs to trust what Instagram sends it. */
export function webhookConfigured(): boolean {
  return Boolean(process.env.IG_APP_SECRET?.trim() && process.env.IG_VERIFY_TOKEN?.trim());
}

// ---------------------------------------------------------------- threads and messages

export async function findThread(igUserId: string): Promise<IgThread | null> {
  const db = await getDb();
  const [row] = await db.select().from(igThreads).where(eq(igThreads.igUserId, igUserId));
  return row ?? null;
}

export async function findThreadByUsername(username: string): Promise<IgThread | null> {
  if (!username) return null;
  const db = await getDb();
  const [row] = await db.select().from(igThreads).where(eq(igThreads.username, username));
  return row ?? null;
}

export async function createThread(values: { igUserId: string; username?: string; name?: string }): Promise<IgThread> {
  const db = await getDb();
  await db
    .insert(igThreads)
    // A new conversation starts with nothing waiting; what arrives next decides where it stands.
    .values({ igUserId: values.igUserId, username: values.username ?? "", name: values.name ?? "", state: "auto" })
    .onConflictDoNothing();
  return (await findThread(values.igUserId)) as IgThread;
}

export async function updateThread(id: number, patch: Partial<typeof igThreads.$inferInsert>): Promise<void> {
  const db = await getDb();
  await db.update(igThreads).set(patch).where(eq(igThreads.id, id));
}

export type NewMessage = {
  threadId: number;
  direction: "in" | "out";
  kind?: IgMessageKind;
  sender: IgSender;
  text?: string;
  mid?: string;
  mediaId?: string;
  mediaUrl?: string;
  mediaTitle?: string;
  failed?: string;
  raw?: string;
  createdAt?: Date;
};

/** Stores a message. Returns null when Instagram's id for it is already on file (a repeat delivery). */
export async function addMessage(m: NewMessage): Promise<IgMessage | null> {
  const db = await getDb();
  const [row] = await db
    .insert(igMessages)
    .values({ ...m, text: (m.text ?? "").slice(0, 4000), raw: (m.raw ?? "").slice(0, 4000) })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function updateMessage(id: number, patch: Partial<typeof igMessages.$inferInsert>): Promise<void> {
  const db = await getDb();
  await db.update(igMessages).set(patch).where(eq(igMessages.id, id));
}

/** A message this site sent a moment ago with the same words: Instagram echoes those back. */
export async function findRecentOwn(threadId: number, text: string): Promise<IgMessage | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(igMessages)
    .where(and(eq(igMessages.threadId, threadId), eq(igMessages.direction, "out"), inArray(igMessages.sender, ["auto", "office"]), eq(igMessages.text, text), gte(igMessages.createdAt, new Date(Date.now() - 5 * 60 * 1000))))
    .orderBy(desc(igMessages.id))
    .limit(1);
  return row ?? null;
}

/** How many automatic replies this conversation has had in the last hour, to stop a runaway exchange. */
export async function recentAutoCount(threadId: number): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(igMessages)
    .where(and(eq(igMessages.threadId, threadId), eq(igMessages.sender, "auto"), gte(igMessages.createdAt, new Date(Date.now() - 60 * 60 * 1000))));
  return Number(row?.n ?? 0);
}

export async function messageExists(mid: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.select({ id: igMessages.id }).from(igMessages).where(eq(igMessages.mid, mid)).limit(1);
  return Boolean(row);
}

// ---------------------------------------------------------------- for the admin

export async function listThreads(state?: IgState): Promise<IgThread[]> {
  const db = await getDb();
  return db
    .select()
    .from(igThreads)
    .where(state ? eq(igThreads.state, state) : undefined)
    .orderBy(desc(igThreads.lastMessageAt))
    .limit(200);
}

export async function countThreads(): Promise<Record<IgState, number>> {
  const db = await getDb();
  const rows = await db.select({ state: igThreads.state, n: sql<number>`count(*)` }).from(igThreads).groupBy(igThreads.state);
  const out = Object.fromEntries(IG_STATES.map((s) => [s, 0])) as Record<IgState, number>;
  for (const r of rows) out[r.state] = Number(r.n);
  return out;
}

export async function getThread(id: number): Promise<{ thread: IgThread; messages: IgMessage[] } | null> {
  const db = await getDb();
  const [thread] = await db.select().from(igThreads).where(eq(igThreads.id, id));
  if (!thread) return null;
  const messages = await db.select().from(igMessages).where(eq(igMessages.threadId, id)).orderBy(igMessages.id).limit(500);
  return { thread, messages };
}

// ---------------------------------------------------------------- reels and posts

export async function listIgMedia(): Promise<IgMediaRow[]> {
  const db = await getDb();
  return db
    .select()
    .from(igMedia)
    .orderBy(desc(sql`coalesce(${igMedia.postedAt}, ${igMedia.createdAt})`))
    .limit(300);
}

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * The reel or post Instagram is talking about. Its id is tried first; when a shared reel
 * arrives under an id not seen before, its caption is compared with the known ones.
 */
export async function findMedia(ids: string[], title = ""): Promise<IgMediaRow | null> {
  const db = await getDb();
  const wanted = ids.filter(Boolean);
  if (wanted.length) {
    const [row] = await db.select().from(igMedia).where(inArray(igMedia.mediaId, wanted)).limit(1);
    if (row) return row;
  }
  const want = squash(title);
  if (want.length < 12) return null;
  const all = await db.select().from(igMedia).limit(500);
  return all.find((m) => m.caption && (squash(m.caption).startsWith(want.slice(0, 60)) || want.startsWith(squash(m.caption).slice(0, 60)))) ?? null;
}

export async function upsertMedia(values: typeof igMedia.$inferInsert): Promise<void> {
  const db = await getDb();
  const rest = { ...values, mediaId: undefined };
  await db
    .insert(igMedia)
    .values(values)
    .onConflictDoUpdate({ target: igMedia.mediaId, set: { ...rest, updatedAt: new Date() } });
}

export async function updateMedia(id: number, patch: Partial<typeof igMedia.$inferInsert>): Promise<void> {
  const db = await getDb();
  await db
    .update(igMedia)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(igMedia.id, id));
}
