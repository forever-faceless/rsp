import "server-only";
import { and, desc, eq, gt, gte, inArray, isNull, lte, sql } from "drizzle-orm";
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

/** What this site sent in a conversation in the last few minutes, newest first: Instagram echoes those back. */
export async function recentOwn(threadId: number): Promise<IgMessage[]> {
  const db = await getDb();
  return db
    .select()
    .from(igMessages)
    .where(and(eq(igMessages.threadId, threadId), eq(igMessages.direction, "out"), inArray(igMessages.sender, ["auto", "office"]), gte(igMessages.createdAt, new Date(Date.now() - 5 * 60 * 1000))))
    .orderBy(desc(igMessages.id))
    .limit(20);
}

export async function getMessage(id: number): Promise<IgMessage | null> {
  const db = await getDb();
  const [row] = await db.select().from(igMessages).where(eq(igMessages.id, id));
  return row ?? null;
}

/** The last message that went out in a conversation, whoever sent it. */
export async function lastSent(threadId: number): Promise<IgMessage | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(igMessages)
    .where(and(eq(igMessages.threadId, threadId), eq(igMessages.direction, "out")))
    .orderBy(desc(igMessages.id))
    .limit(1);
  return row ?? null;
}

/**
 * They opened the conversation. Instagram names the last message they saw; everything sent
 * to them up to it has been seen too.
 */
export async function markSeen(threadId: number, mid: string, when: Date): Promise<void> {
  const db = await getDb();
  const [last] = mid
    ? await db
        .select({ id: igMessages.id })
        .from(igMessages)
        .where(and(eq(igMessages.threadId, threadId), eq(igMessages.mid, mid)))
        .limit(1)
    : [];
  await db
    .update(igMessages)
    .set({ seenAt: when })
    .where(and(eq(igMessages.threadId, threadId), eq(igMessages.direction, "out"), eq(igMessages.failed, ""), isNull(igMessages.seenAt), last ? lte(igMessages.id, last.id) : lte(igMessages.createdAt, when)));
}

/** The price messages sent between `oldest` and `newest` that have not been looked at for a reminder yet. */
export async function priceMessagesDue(oldest: Date, newest: Date): Promise<IgMessage[]> {
  const db = await getDb();
  return db
    .select()
    .from(igMessages)
    .where(and(eq(igMessages.direction, "out"), eq(igMessages.sender, "auto"), eq(igMessages.failed, ""), gte(igMessages.createdAt, oldest), lte(igMessages.createdAt, newest), sql`${igMessages.raw} like '%"is":"askNumber"%'`, sql`${igMessages.raw} not like '%"reminded"%'`))
    .orderBy(igMessages.id)
    .limit(50);
}

/** What they have written in a conversation since one message. */
export async function wroteSince(threadId: number, afterId: number): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ text: igMessages.text })
    .from(igMessages)
    .where(and(eq(igMessages.threadId, threadId), eq(igMessages.direction, "in"), gt(igMessages.id, afterId)));
  return rows.map((r) => r.text);
}

/** Takes a price message for its one look. False when another run of the check got there first. */
export async function claimReminder(message: IgMessage): Promise<boolean> {
  const db = await getDb();
  const kept = (() => {
    try {
      return JSON.parse(message.raw || "{}") as Record<string, unknown>;
    } catch {
      return {};
    }
  })();
  const moved = await db
    .update(igMessages)
    .set({ raw: JSON.stringify({ ...kept, reminded: true }) })
    .where(and(eq(igMessages.id, message.id), sql`${igMessages.raw} not like '%"reminded"%'`))
    .returning({ id: igMessages.id });
  return moved.length > 0;
}

/** True when this conversation has had its one reminder already. */
export async function wasReminded(threadId: number): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select({ id: igMessages.id })
    .from(igMessages)
    .where(and(eq(igMessages.threadId, threadId), eq(igMessages.direction, "out"), sql`${igMessages.raw} like '%"is":"remind"%'`))
    .limit(1);
  return Boolean(row);
}

export async function getThreadById(id: number): Promise<IgThread | null> {
  const db = await getDb();
  const [row] = await db.select().from(igThreads).where(eq(igThreads.id, id));
  return row ?? null;
}

export type Reach = { since: Date; written: number; opened: number; answered: number };

/**
 * How far the automatic messages get. Counted from the first time Instagram reported a
 * message as read, since nothing earlier can be told: the people the automation wrote to,
 * how many of them opened it (or answered, which says the same), and how many answered.
 * Null until Instagram has reported one message as read.
 */
export async function reachOfAutomation(): Promise<Reach | null> {
  const db = await getDb();
  const [first] = await db.select({ at: sql<number | null>`min(${igMessages.seenAt})` }).from(igMessages);
  if (!first?.at) return null;
  const since = new Date(Number(first.at) * 1000);
  const rows = await db
    .select({ id: igMessages.id, threadId: igMessages.threadId, direction: igMessages.direction, kind: igMessages.kind, sender: igMessages.sender, failed: igMessages.failed, seenAt: igMessages.seenAt })
    .from(igMessages)
    .where(gte(igMessages.createdAt, since))
    .orderBy(igMessages.id)
    .limit(20000);
  const people = new Map<number, { opened: boolean; answered: boolean }>();
  for (const m of rows) {
    const person = people.get(m.threadId);
    if (m.direction === "out") {
      if (m.failed) continue;
      // Counted from the automation's first message to them; what the office sends after counts as opened too.
      if (!person && m.sender !== "auto") continue;
      const p = person ?? { opened: false, answered: false };
      if (m.seenAt) p.opened = true;
      people.set(m.threadId, p);
    } else if (person && m.kind !== "comment") {
      person.opened = true;
      person.answered = true;
    }
  }
  const all = [...people.values()];
  return { since, written: all.length, opened: all.filter((p) => p.opened).length, answered: all.filter((p) => p.answered).length };
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
